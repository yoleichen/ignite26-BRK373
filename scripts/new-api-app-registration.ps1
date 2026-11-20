<#
.SYNOPSIS
    Creates the Microsoft Entra app registration that the hosted CaseDesk API validates tokens
    against, so only signed-in callers can read it.

.DESCRIPTION
    Creates an app registration with an Application ID URI and one delegated scope,
    access_as_user, and issues v2.0 access tokens. Azure CLI is pre-authorized for that scope,
    so `az account get-access-token` can get you a token for testing without a consent prompt.
    No client secret is created. If an app registration with this name already exists, the
    script prints its details and changes nothing.

.EXAMPLE
    az login
    ./scripts/new-api-app-registration.ps1

.EXAMPLE
    # For tenants whose policy requires a service management reference on app registrations.
    ./scripts/new-api-app-registration.ps1 -ServiceManagementReference <your-service-id>
#>
[CmdletBinding()]
param(
    [string] $Name = 'casedesk-api',
    [string] $ServiceManagementReference
)

$ErrorActionPreference = 'Stop'

# Azure CLI's well-known public client ID.
$azureCliClientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'

function Invoke-Az {
    $output = & az @args
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI step failed: az $($args[0..2] -join ' '). See the error above." }
    return $output
}

$tenantId = & az account show --query tenantId -o tsv 2>$null
if ($LASTEXITCODE -ne 0 -or -not $tenantId) { throw 'Sign in first with: az login' }

$appId = Invoke-Az ad app list --display-name $Name --query '[0].appId' -o tsv
if ($appId) {
    Write-Host "App registration $Name already exists; nothing changed."
}
else {
    Write-Host "Creating app registration $Name..."
    $createArgs = @('ad', 'app', 'create', '--display-name', $Name, '--sign-in-audience', 'AzureADMyOrg', '--query', 'appId', '-o', 'tsv')
    if ($ServiceManagementReference) { $createArgs += @('--service-management-reference', $ServiceManagementReference) }
    $appId = & az @createArgs
    if ($LASTEXITCODE -ne 0) {
        throw 'Azure CLI step failed: az ad app create. See the error above. If it says ServiceManagementReference is required, run this script again with -ServiceManagementReference <your-service-id>.'
    }
    $objectId = Invoke-Az ad app show --id $appId --query id -o tsv
    Invoke-Az ad app update --id $appId --identifier-uris "api://$appId"

    $scope = @{
        id                      = [guid]::NewGuid().ToString()
        value                   = 'access_as_user'
        type                    = 'User'
        isEnabled               = $true
        adminConsentDisplayName = 'Read the CaseDesk API'
        adminConsentDescription = 'Allows the app to read CaseDesk accounts and cases as the signed-in user.'
        userConsentDisplayName  = 'Read the CaseDesk API'
        userConsentDescription  = 'Allows the app to read CaseDesk accounts and cases as you.'
    }
    $api = @{ requestedAccessTokenVersion = 2; oauth2PermissionScopes = @($scope) }
    $bodyFile = New-TemporaryFile
    try {
        # A pre-authorization can only name a scope that already exists, so this takes two updates.
        @{ api = $api } | ConvertTo-Json -Depth 6 | Set-Content $bodyFile
        Invoke-Az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
            --headers 'Content-Type=application/json' --body "@$bodyFile"

        $api.preAuthorizedApplications = @(@{ appId = $azureCliClientId; delegatedPermissionIds = @($scope.id) })
        @{ api = $api } | ConvertTo-Json -Depth 6 | Set-Content $bodyFile
        Invoke-Az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$objectId" `
            --headers 'Content-Type=application/json' --body "@$bodyFile"
    }
    finally {
        Remove-Item $bodyFile -ErrorAction SilentlyContinue
    }

    Invoke-Az ad sp create --id $appId --output none
}

Write-Host ''
Write-Host "Ready: $Name"
Write-Host "Client ID:   $appId"
Write-Host "Tenant ID:   $tenantId"
Write-Host "Token scope: api://$appId/.default"
