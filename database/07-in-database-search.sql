-- Azure SQL Database turns a question into an embedding and ranks articles in one statement.
-- The same query as section 3 of embed-in-database.ipynb, as a script you can run on its own.
-- Run on CaseDesk after that notebook has created the external model casedesk_embeddings (walkthrough step 6, Azure OpenAI).
-- Each run makes one call to your Azure OpenAI embedding deployment.
-- Connect to the CaseDesk database before running.

SET NOCOUNT ON;

-- Change the question and run again.
DECLARE @question nvarchar(2000) = N'Field updates from the mobile app have been stuck in Pending since this morning.';

-- The app labels Azure OpenAI vectors azure-openai:<deployment>:768; compare only with those.
DECLARE @model nvarchar(100) =
    (SELECT N'azure-openai:' + model + N':768' FROM sys.external_models WHERE name = N'casedesk_embeddings');

DECLARE @query_vector vector(768) = AI_GENERATE_EMBEDDINGS(@question USE MODEL casedesk_embeddings);

-- Rank by meaning first, then enrich only the closest articles with business data.
WITH nearest AS (
    SELECT TOP (3)
           e.article_id,
           VECTOR_DISTANCE('cosine', e.embedding, @query_vector) AS cosine_distance
    FROM dbo.kb_article_embeddings AS e
    WHERE e.embedding_model = @model
    ORDER BY cosine_distance
)
SELECT a.id,
       a.title,
       a.product_area,
       n.cosine_distance,
       (SELECT COUNT(*)
          FROM dbo.support_cases AS c
         WHERE c.product_area = a.product_area
           AND c.status <> N'Resolved') AS open_cases
FROM nearest AS n
JOIN dbo.kb_articles AS a ON a.id = n.article_id
ORDER BY n.cosine_distance;
