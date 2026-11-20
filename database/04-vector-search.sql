-- Native vector search with VECTOR_DISTANCE, no external vector database.
-- Run after `npm run embed` in app/ai-service has stored the article embeddings.
-- Connect to the CaseDesk database before running.

SET NOCOUNT ON;

-- 1. Coverage: every article should have an embedding for the active model.
SELECT e.embedding_model,
       COUNT(*) AS embedded_articles,
       (SELECT COUNT(*) FROM dbo.kb_articles) AS total_articles,
       MAX(e.embedded_at) AS last_embedded_at
FROM dbo.kb_article_embeddings AS e
GROUP BY e.embedding_model;

-- 2. Which articles are semantically closest to the SCIM provisioning article?
--    The query vector is an embedding already stored in the table, so no AI call is needed here.
DECLARE @source_id int =
    (SELECT id FROM dbo.kb_articles WHERE title LIKE N'Fix SCIM provisioning errors%');
DECLARE @model nvarchar(100);
DECLARE @query_vector vector(768);

SELECT @model = embedding_model, @query_vector = embedding
FROM dbo.kb_article_embeddings
WHERE article_id = @source_id;

IF @query_vector IS NULL
    THROW 50003, N'No embedding found. Run "npm run embed" in app/ai-service first.', 1;

SELECT TOP (5)
       a.id,
       a.title,
       a.product_area,
       VECTOR_DISTANCE('cosine', e.embedding, @query_vector) AS cosine_distance  -- smaller is closer
FROM dbo.kb_article_embeddings AS e
JOIN dbo.kb_articles AS a ON a.id = e.article_id
WHERE e.embedding_model = @model          -- never compare vectors from different models
  AND e.article_id <> @source_id
ORDER BY cosine_distance;
