-- Step 1 of the database checkpoints.
-- Run while connected to the server's master database.
-- The Azure SQL Database engine does not create a database when you connect to it.

-- Check sys.databases: from master, DB_ID() returns NULL for user databases on this engine.
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'CaseDesk')
    CREATE DATABASE CaseDesk;
GO

SELECT
    name,
    CAST(SERVERPROPERTY('EngineEdition') AS int) AS engine_edition,   -- 5 = Azure SQL Database
    CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) AS edition
FROM sys.databases
WHERE name = N'CaseDesk';
