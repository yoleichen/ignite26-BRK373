-- Removes the CaseDesk tables so you can rehearse the demo from an empty database.
-- Destructive. Intended for the local container. Set @confirm to N'RESET CaseDesk' to run it.
-- Connect to the CaseDesk database before running.

SET XACT_ABORT ON;

DECLARE @confirm nvarchar(30) = N'';

IF @confirm <> N'RESET CaseDesk'
    THROW 50010, N'Nothing dropped. Set @confirm to N''RESET CaseDesk'' to drop the CaseDesk tables.', 1;

IF DB_NAME() <> N'CaseDesk'
    THROW 50011, N'Connect to the CaseDesk database before resetting it.', 1;

DROP TABLE IF EXISTS dbo.kb_article_embeddings;
DROP TABLE IF EXISTS dbo.support_cases;
DROP TABLE IF EXISTS dbo.kb_articles;
DROP TABLE IF EXISTS dbo.product_areas;
DROP TABLE IF EXISTS dbo.accounts;

SELECT COUNT(*) AS remaining_casedesk_tables
FROM sys.tables
WHERE name IN (N'accounts', N'support_cases', N'kb_articles', N'kb_article_embeddings', N'product_areas');
