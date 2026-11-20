<#
.SYNOPSIS
    Creates the Azure OpenAI resource and model deployments for CaseDesk, grants you access, and
    writes the non-secret AI settings to app/ai-service/.env.

.DESCRIPTION
    Runs these Azure CLI steps in order:
      1. Resource group.
      2. Azure OpenAI resource with a custom subdomain, which Microsoft Entra ID sign-in requires.
      3. An embedding deployment and a chat deployment.
      4. The "Cognitive Services OpenAI User" role for the signed-in user on that resource.
    No API key is created, printed, or stored. Azure OpenAI usage is billed to your subscription.
    Model availability and quota differ by region; choose a region with -Location.
    Safe to run again: it reuses what an earlier run created. If you can't assign roles, it still
    writes the settings and prints the role assignment command for an administrator.

.EXAMPLE
    az login
    ./scripts/new-azure-openai.ps1 -Location eastus2

.EXAMPLE
    # For subscriptions whose policy requires a tag on new resource groups.
    ./scripts/new-azure-openai.ps1 -Location eastus2 -Tags Owner=<your-alias>
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $Location,
    [string] $ResourceGroup = 'rg-casedesk-ai',
    [ValidatePattern('^[^=\s]+=\S*$')]
    [string[]] $Tags,
    [ValidatePattern('^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')]
    [string] $Name,
    [string] $EmbeddingModel = 'text-embedding-3-small',
    [string] $EmbeddingModelVersion = '1',
    [string] $ChatModel = 'gpt-5.4-mini',
    [string] $ChatModelVersion = '2026-03-17',
    [string] $DeploymentSku = 'GlobalStandard',
    [int] $Capacity = 50,
    [string] $EnvFile = (Join-Path $PSScriptRoot '../app/ai-service/.env')
)

$ErrorActionPreference = 'Stop'

function Invoke-Az {
    $output = & az @args
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI step failed: az $($args[0..2] -join ' '). See the error above." }
    return $output
}

$userId = & az ad signed-in-user show --query id -o tsv 2>$null
if ($LASTEXITCODE -ne 0 -or -not $userId) { throw 'Sign in first with: az login' }

if ((Invoke-Az group exists --name $ResourceGroup) -eq 'true') {
    Write-Host "Using existing resource group $ResourceGroup."
}
else {
    Write-Host "Creating resource group $ResourceGroup in $Location..."
    $groupArgs = @('group', 'create', '--name', $ResourceGroup, '--location', $Location, '--output', 'none')
    if ($Tags) { $groupArgs += @('--tags') + $Tags }
    & az @groupArgs
    if ($LASTEXITCODE -ne 0) {
        throw 'Azure CLI step failed: az group create. See the error above. If a policy requires a tag, run this script again with -Tags Name=Value.'
    }
}

# Reuse the resource from an earlier run, so running the script again finishes its setup.
if (-not $Name) {
    $Name = Invoke-Az cognitiveservices account list --resource-group $ResourceGroup --query "[?kind=='OpenAI'].name | [0]" -o tsv
}
$exists = $false
if ($Name) {
    & az cognitiveservices account show --name $Name --resource-group $ResourceGroup --output none 2>$null
    $exists = $LASTEXITCODE -eq 0
}
if ($exists) {
    Write-Host "Using existing Azure OpenAI resource $Name."
}
else {
    if (-not $Name) { $Name = "casedesk-ai-$(-join ((97..122) | Get-Random -Count 6 | ForEach-Object { [char]$_ }))" }
    Write-Host "Creating Azure OpenAI resource $Name..."
    Invoke-Az cognitiveservices account create --name $Name --resource-group $ResourceGroup `
        --location $Location --kind OpenAI --sku S0 --custom-domain $Name --yes --output none
}

foreach ($model in @(
        @{ Name = $EmbeddingModel; Version = $EmbeddingModelVersion },
        @{ Name = $ChatModel; Version = $ChatModelVersion })) {
    & az cognitiveservices account deployment show --name $Name --resource-group $ResourceGroup `
        --deployment-name $model.Name --output none 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "Using existing deployment $($model.Name)."; continue }
    Write-Host "Deploying $($model.Name)..."
    Invoke-Az cognitiveservices account deployment create --name $Name --resource-group $ResourceGroup `
        --deployment-name $model.Name --model-name $model.Name --model-version $model.Version `
        --model-format OpenAI --sku-name $DeploymentSku --sku-capacity $Capacity --output none
}

$accountId = Invoke-Az cognitiveservices account show --name $Name --resource-group $ResourceGroup --query id -o tsv
$endpoint = (Invoke-Az cognitiveservices account show --name $Name --resource-group $ResourceGroup `
        --query properties.endpoint -o tsv).TrimEnd('/')

$role = 'Cognitive Services OpenAI User'
# Avoid parentheses in --query: az.cmd passes arguments through cmd.exe, which rejects them.
$assignments = @(Invoke-Az role assignment list --assignee $userId --role $role --scope $accountId `
        --include-inherited --query '[].id' -o tsv | Where-Object { $_ })
$roleGranted = $assignments.Count -gt 0
if ($roleGranted) {
    Write-Host "You already have the $role role on the resource."
}
else {
    Write-Host "Granting you the $role role on the resource..."
    & az role assignment create --assignee-object-id $userId --assignee-principal-type User `
        --role $role --scope $accountId --output none
    $roleGranted = $LASTEXITCODE -eq 0
}

$envPath = [IO.Path]::GetFullPath($EnvFile)
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path (Split-Path $envPath) '.env.example') $envPath
}
$settings = [ordered]@{
    AI_PROVIDER                       = 'azure'
    AZURE_OPENAI_ENDPOINT             = $endpoint
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT = $EmbeddingModel
    AZURE_OPENAI_CHAT_DEPLOYMENT      = $ChatModel
}
$lines = @(Get-Content $envPath)
foreach ($key in $settings.Keys) {
    $line = "$key=$($settings[$key])"
    $index = 0..($lines.Count - 1) | Where-Object { $lines[$_] -match "^$key=" } | Select-Object -First 1
    if ($null -ne $index) { $lines[$index] = $line } else { $lines += $line }
}
Set-Content -Path $envPath -Value $lines

Write-Host ''
Write-Host "Ready: $endpoint"
Write-Host "Deployments: $EmbeddingModel (embeddings), $ChatModel (replies)"
Write-Host "Updated AI settings in $envPath."
if ($roleGranted) {
    Write-Host 'Role assignments can take a few minutes to apply.'
}
else {
    Write-Warning "You can't assign roles here, so the AI service can't call the models yet. Ask a subscription Owner or User Access Administrator to run:"
    Write-Host "  az role assignment create --assignee-object-id $userId --assignee-principal-type User --role '$role' --scope $accountId"
    Write-Host 'Then continue; the role can take a few minutes to apply.'
}
