// All SQL the AI service runs. Every value is a parameter; vectors travel as JSON text and are
// cast to VECTOR(768) inside the statement.

import sql from "mssql";
import type { ArticleMatch } from "./rag.js";

const CONTENT_HASH = "HASHBYTES('SHA2_256', CONCAT(a.title, NCHAR(10), a.content))";

export async function searchArticles(
  pool: sql.ConnectionPool,
  queryVector: string,
  embeddingModel: string,
  topK: number,
): Promise<ArticleMatch[]> {
  const result = await pool
    .request()
    .input("query_vector", sql.NVarChar(sql.MAX), queryVector)
    .input("embedding_model", sql.NVarChar(100), embeddingModel)
    .input("top_k", sql.Int, topK).query<ArticleMatch>(`
      DECLARE @q vector(768) = CAST(@query_vector AS vector(768));
      SELECT TOP (@top_k)
             a.id, a.title, a.product_area, a.content,
             VECTOR_DISTANCE('cosine', e.embedding, @q) AS distance
      FROM dbo.kb_article_embeddings AS e
      JOIN dbo.kb_articles AS a ON a.id = e.article_id
      WHERE e.embedding_model = @embedding_model
      ORDER BY distance;`);
  return result.recordset;
}

export interface EmbeddingStatus {
  articles: number;
  up_to_date: number;
  stale_or_missing: number;
  other_models: string[];
}

export async function getEmbeddingStatus(
  pool: sql.ConnectionPool,
  embeddingModel: string,
): Promise<EmbeddingStatus> {
  const result = await pool.request().input("embedding_model", sql.NVarChar(100), embeddingModel)
    .query<{ articles: number; up_to_date: number; other_models: string | null }>(`
      SELECT
        (SELECT COUNT(*) FROM dbo.kb_articles) AS articles,
        (SELECT COUNT(*)
           FROM dbo.kb_article_embeddings AS e
           JOIN dbo.kb_articles AS a ON a.id = e.article_id
          WHERE e.embedding_model = @embedding_model
            AND e.content_hash = ${CONTENT_HASH}) AS up_to_date,
        (SELECT STRING_AGG(m.embedding_model, N', ')
           FROM (SELECT DISTINCT embedding_model FROM dbo.kb_article_embeddings
                  WHERE embedding_model <> @embedding_model) AS m) AS other_models;`);
  const row = result.recordset[0]!;
  return {
    articles: row.articles,
    up_to_date: row.up_to_date,
    stale_or_missing: row.articles - row.up_to_date,
    other_models: row.other_models ? row.other_models.split(", ") : [],
  };
}

export interface ArticleToEmbed {
  id: number;
  title: string;
  content: string;
  content_hash: Buffer;
}

/** Articles with no embedding, an embedding from another model, or text that changed since. */
export async function findArticlesToEmbed(
  pool: sql.ConnectionPool,
  embeddingModel: string,
): Promise<ArticleToEmbed[]> {
  const result = await pool.request().input("embedding_model", sql.NVarChar(100), embeddingModel)
    .query<ArticleToEmbed>(`
      SELECT a.id, a.title, a.content, ${CONTENT_HASH} AS content_hash
      FROM dbo.kb_articles AS a
      LEFT JOIN dbo.kb_article_embeddings AS e ON e.article_id = a.id
      WHERE e.article_id IS NULL
         OR e.embedding_model <> @embedding_model
         OR e.content_hash <> ${CONTENT_HASH}
      ORDER BY a.id;`);
  return result.recordset;
}

/** Replaces one article's embedding, unless the article text changed after it was read. */
export async function saveEmbedding(
  pool: sql.ConnectionPool,
  article: ArticleToEmbed,
  embeddingModel: string,
  vectorJson: string,
): Promise<boolean> {
  const result = await pool
    .request()
    .input("article_id", sql.Int, article.id)
    .input("embedding_model", sql.NVarChar(100), embeddingModel)
    .input("content_hash", sql.VarBinary(32), article.content_hash)
    .input("embedding", sql.NVarChar(sql.MAX), vectorJson).query<{ saved: number }>(`
      SET XACT_ABORT ON;
      DECLARE @saved int = 0;
      BEGIN TRANSACTION;
      IF EXISTS (SELECT 1 FROM dbo.kb_articles AS a WITH (UPDLOCK, HOLDLOCK)
                 WHERE a.id = @article_id AND ${CONTENT_HASH} = @content_hash)
      BEGIN
          DELETE FROM dbo.kb_article_embeddings WHERE article_id = @article_id;
          INSERT INTO dbo.kb_article_embeddings (article_id, embedding_model, content_hash, embedding)
          VALUES (@article_id, @embedding_model, @content_hash, CAST(@embedding AS vector(768)));
          SET @saved = 1;
      END;
      COMMIT TRANSACTION;
      SELECT @saved AS saved;`);
  return result.recordset[0]?.saved === 1;
}

export async function getEngineInfo(pool: sql.ConnectionPool) {
  const result = await pool.request().query<{ engine_edition: number; database_name: string }>(
    "SELECT CAST(SERVERPROPERTY('EngineEdition') AS int) AS engine_edition, DB_NAME() AS database_name;",
  );
  return result.recordset[0]!;
}
