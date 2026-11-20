-- Checkpoint for the schema creation step.
-- GitHub Copilot creates these tables from app/frontend/src/data/sampleData.ts and docs/PRD.md.
-- For the schema design exercise, Copilot should not use or copy this script;
-- design the schema from the PRD and sample data instead. This is a fallback for users.
-- Run this script before the tables exist if you want the exact reference schema.
-- Existing tables are skipped; this script does not repair a differing schema.
-- Connect to the CaseDesk database (select it in the connection; USE is not supported).

SET XACT_ABORT ON;

IF CAST(SERVERPROPERTY('EngineEdition') AS int) <> 5
    THROW 50001, N'This lab targets Azure SQL Database (EngineEdition 5): the local Azure SQL Database container or Azure SQL Database in Azure.', 1;

IF DB_NAME() = N'master'
    THROW 50002, N'Connect to the CaseDesk database, not master.', 1;

IF OBJECT_ID(N'dbo.accounts', N'U') IS NULL
    CREATE TABLE dbo.accounts
    (
        id       int IDENTITY(1, 1) NOT NULL CONSTRAINT pk_accounts PRIMARY KEY,
        name     nvarchar(100) NOT NULL CONSTRAINT uq_accounts_name UNIQUE,
        industry nvarchar(50)  NOT NULL,
        tier     nvarchar(20)  NOT NULL
                 CONSTRAINT ck_accounts_tier CHECK (tier IN (N'Standard', N'Premium', N'Enterprise')),
        region   nvarchar(50)  NOT NULL
    );

IF OBJECT_ID(N'dbo.support_cases', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.support_cases
    (
        id           int IDENTITY(1, 1) NOT NULL CONSTRAINT pk_support_cases PRIMARY KEY,
        account_id   int NOT NULL
                     CONSTRAINT fk_support_cases_accounts REFERENCES dbo.accounts (id),
        title        nvarchar(200)  NOT NULL,
        description  nvarchar(2000) NOT NULL,
        product_area nvarchar(50)   NOT NULL,
        priority     nvarchar(20)   NOT NULL
                     CONSTRAINT ck_support_cases_priority CHECK (priority IN (N'Low', N'Medium', N'High', N'Critical')),
        status       nvarchar(30)   NOT NULL
                     CONSTRAINT ck_support_cases_status CHECK (status IN (N'New', N'In Progress', N'Waiting on Customer', N'Resolved')),
        opened_at    datetime2(0)   NOT NULL,
        resolved_at  datetime2(0)   NULL
    );

    CREATE INDEX ix_support_cases_account_id ON dbo.support_cases (account_id);
END;

IF OBJECT_ID(N'dbo.kb_articles', N'U') IS NULL
    CREATE TABLE dbo.kb_articles
    (
        id           int IDENTITY(1, 1) NOT NULL CONSTRAINT pk_kb_articles PRIMARY KEY,
        title        nvarchar(200)  NOT NULL CONSTRAINT uq_kb_articles_title UNIQUE,
        product_area nvarchar(50)   NOT NULL,
        content      nvarchar(4000) NOT NULL,
        updated_at   datetime2(0)   NOT NULL
    );

SELECT t.name AS table_name, COUNT(c.column_id) AS column_count
FROM sys.tables AS t
JOIN sys.columns AS c ON c.object_id = t.object_id
WHERE t.name IN (N'accounts', N'support_cases', N'kb_articles')
GROUP BY t.name
ORDER BY t.name;
