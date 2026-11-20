<#
.SYNOPSIS
    Runs a checkpoint script from the database folder inside the local Azure SQL Database container.

.DESCRIPTION
    Uses the sqlcmd that ships in the container, so nothing extra is installed on your machine.
    The database is selected on the connection (-Database), never with USE.

.EXAMPLE
    $env:MSSQL_SA_PASSWORD = '<your sa password>'
    ./scripts/invoke-sql.ps1 -File database/01-schema.sql
    ./scripts/invoke-sql.ps1 -File database/00-create-database.sql -Database master
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $File,
    [string] $Database = 'CaseDesk',
    [string] $ContainerName = 'casedesk-azuresql'
)

$ErrorActionPreference = 'Stop'

if (-not $env:MSSQL_SA_PASSWORD) { throw 'Set $env:MSSQL_SA_PASSWORD to the sa password of the container.' }
$path = (Resolve-Path $File).Path
$target = '/tmp/' + [IO.Path]::GetFileName($path)

docker cp $path "${ContainerName}:$target" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not copy $File into container '$ContainerName'. Is it running? (docker ps)" }

try {
    docker exec --env "SQLCMDPASSWORD=$env:MSSQL_SA_PASSWORD" $ContainerName `
        /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -m-1 -d $Database -i $target -W
    if ($LASTEXITCODE -ne 0) { throw "$File failed against database $Database (sqlcmd exit code $LASTEXITCODE)." }
}
finally {
    # docker cp writes the file as root; the engine runs as a non-root user.
    docker exec -u 0 $ContainerName rm -f $target | Out-Null
}
