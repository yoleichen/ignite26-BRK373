-- Checkpoint for the native vector step.
-- Embeddings live in their own table so the business tables never change when you switch
-- embedding providers. Switching models re-runs the backfill; it does not alter this schema
-- as long as the new model is asked for 768 dimensions.
-- Connect to the CaseDesk database before running.

SET XACT_ABORT ON;

IF DB_NAME() = N'master'
    THROW 50002, N'Connect to the CaseDesk database, not master.', 1;

IF OBJECT_ID(N'dbo.kb_article_embeddings', N'U') IS NULL
    CREATE TABLE dbo.kb_article_embeddings
    (
        article_id      int NOT NULL
                        CONSTRAINT pk_kb_article_embeddings PRIMARY KEY
                        CONSTRAINT fk_kb_article_embeddings_kb_articles
                            REFERENCES dbo.kb_articles (id) ON DELETE CASCADE,
        embedding_model nvarchar(100) NOT NULL,
        content_hash    binary(32)    NOT NULL,
        embedding       vector(768)   NOT NULL,
        embedded_at     datetime2(0)  NOT NULL
                        CONSTRAINT df_kb_article_embeddings_embedded_at DEFAULT (SYSUTCDATETIME())
    );

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type, c.vector_dimensions
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.kb_article_embeddings')
ORDER BY c.column_id;
