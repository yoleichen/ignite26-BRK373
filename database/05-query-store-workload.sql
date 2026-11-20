-- Generates a little Query Store history so the Query Performance Dashboard has something to show.
-- Run after the embeddings exist. Takes a few seconds and returns one summary result set.
-- Connect to the CaseDesk database before running.

SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 50002, N'Connect to the CaseDesk database, not master.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.kb_article_embeddings)
    THROW 50003, N'No embeddings found. Run "npm run embed" in app/ai-service first.', 1;

-- AUTO capture skips cheap, infrequent queries. Capture everything in this demo database only;
-- the end of the script sets it back to AUTO.
ALTER DATABASE CURRENT SET QUERY_STORE = ON (OPERATION_MODE = READ_WRITE, QUERY_CAPTURE_MODE = ALL);

DECLARE @model nvarchar(100) = (SELECT TOP (1) embedding_model FROM dbo.kb_article_embeddings);
DECLARE @article_count int = (SELECT COUNT(*) FROM dbo.kb_article_embeddings);
DECLARE @i int = 0, @open_cases int, @match_id int, @query_vector vector(768);

WHILE @i < 60
BEGIN
    -- The agent queue: open high-priority cases with their account.
    SELECT @open_cases = COUNT(*)
    FROM dbo.support_cases AS c
    JOIN dbo.accounts AS a ON a.id = c.account_id
    WHERE c.status <> N'Resolved'
      AND c.priority IN (N'High', N'Critical');

    -- The retrieval step of the RAG service: exact nearest-neighbor search over all embeddings.
    SELECT @query_vector = embedding
    FROM dbo.kb_article_embeddings
    WHERE article_id = (SELECT article_id FROM dbo.kb_article_embeddings
                        ORDER BY article_id
                        OFFSET (@i % @article_count) ROWS FETCH NEXT 1 ROWS ONLY);

    SELECT TOP (3) @match_id = e.article_id
    FROM dbo.kb_article_embeddings AS e
    WHERE e.embedding_model = @model
    ORDER BY VECTOR_DISTANCE('cosine', e.embedding, @query_vector);

    SET @i += 1;
END;

EXEC sys.sp_query_store_flush_db;

ALTER DATABASE CURRENT SET QUERY_STORE (QUERY_CAPTURE_MODE = AUTO);

-- Only this script's two queries, matched by their variable names, so other activity doesn't show up.
SELECT q.query_id,
       SUM(rs.count_executions) AS executions,
       LEFT(t.query_sql_text, 120) AS query_text
FROM sys.query_store_query AS q
JOIN sys.query_store_query_text AS t ON t.query_text_id = q.query_text_id
JOIN sys.query_store_plan AS p ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats AS rs ON rs.plan_id = p.plan_id
WHERE t.query_sql_text LIKE N'%@open[_]cases%' OR t.query_sql_text LIKE N'%@match[_]id%'
GROUP BY q.query_id, t.query_sql_text
ORDER BY q.query_id;
