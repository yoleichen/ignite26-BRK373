-- Walkthrough step 9: fills dbo.product_areas with the product areas already in use, so the foreign
-- keys you add next in Schema Designer can validate every existing row. Data only; safe to re-run.
-- Connect to the CaseDesk database before running.

SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 50002, N'Connect to the CaseDesk database, not master.', 1;

IF OBJECT_ID(N'dbo.product_areas', N'U') IS NULL
    THROW 50004, N'dbo.product_areas does not exist. Add it in Schema Designer first (step 9).', 1;

INSERT INTO dbo.product_areas (name)
SELECT v.product_area
FROM (SELECT product_area FROM dbo.support_cases
      UNION
      SELECT product_area FROM dbo.kb_articles) AS v
WHERE NOT EXISTS (SELECT 1 FROM dbo.product_areas AS p WHERE p.name = v.product_area);

SELECT name AS product_area
FROM dbo.product_areas
ORDER BY name;
