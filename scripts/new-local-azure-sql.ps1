<#
.SYNOPSIS
    Creates a local Azure SQL Database container and the CaseDesk database without the VS Code UI.

.DESCRIPTION
    Recovery path for the "Local container (Preview)" step in the MSSQL extension. It runs the same
    image the extension uses, waits until the engine answers, verifies EngineEdition 5, and creates
    the CaseDesk database. Sign in to the preview registry first (docker login) if the image is not
    already on this machine.

.EXAMPLE
    $env:MSSQL_SA_PASSWORD = '<a strong password>'
    ./scripts/new-local-azure-sql.ps1 -Port 1433
#>
[CmdletBinding()]
param(
    [string] $ContainerName = 'casedesk-azuresql',
    [int] $Port = 1433,
    [string] $Image = 'sqldbpreview-dpgaeqhmgphzd4bk.azurecr.io/azure-sql/db-dev:latest',
    [int] $TimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'

if (-not $env:MSSQL_SA_PASSWORD) {
    throw 'Set $env:MSSQL_SA_PASSWORD to a strong password (8+ characters with upper, lower, digit, and symbol).'
}

if (docker ps -a --filter "name=^/$ContainerName$" --format '{{.Names}}') {
    throw "A container named '$ContainerName' already exists. Remove it (docker rm -f $ContainerName) or pass -ContainerName."
}

$platform = @()
if ((docker info --format '{{.Architecture}}') -notmatch '^(x86_64|amd64)$') {
    $platform = @('--platform', 'linux/amd64')
}

docker run -d --name $ContainerName @platform `
    -e 'ACCEPT_EULA=Y' -e 'MSSQL_SA_PASSWORD' `
    -p "${Port}:1433" $Image | Out-Null
if ($LASTEXITCODE -ne 0) { throw "docker run failed. If the image is missing, run 'docker login' for the preview registry first." }

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$createDb = "IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'CaseDesk') CREATE DATABASE CaseDesk;"
do {
    Start-Sleep -Seconds 3
    docker exec --env "SQLCMDPASSWORD=$env:MSSQL_SA_PASSWORD" $ContainerName `
        /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -l 5 -Q $createDb 2>$null | Out-Null
    $ready = $LASTEXITCODE -eq 0
} until ($ready -or (Get-Date) -gt $deadline)

if (-not $ready) { throw "The engine did not become ready within $TimeoutSeconds seconds. Check: docker logs $ContainerName" }

$edition = docker exec --env "SQLCMDPASSWORD=$env:MSSQL_SA_PASSWORD" $ContainerName `
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -d CaseDesk -h -1 -W `
    -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('EngineEdition') AS int);"
if ("$edition".Trim() -ne '5') { throw "Expected EngineEdition 5 (Azure SQL Database) but got '$edition'. Check the image." }

Write-Host "Ready: server localhost,$Port  database CaseDesk  login sa  (EngineEdition 5)"
