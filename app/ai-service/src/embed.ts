// Backfills kb_article_embeddings for the configured provider: run with `npm run embed`.
// Only articles that are new, changed, or embedded by a different model are processed.

import { loadSettings } from "./config.js";
import { createAiClient } from "./ai.js";
import { closePool, getPool } from "./db.js";
import { toVectorJson } from "./rag.js";
import { findArticlesToEmbed, getEmbeddingStatus, getEngineInfo, saveEmbedding } from "./repository.js";

const BATCH_SIZE = 8;

const settings = loadSettings();
const ai = createAiClient(settings.ai);

try {
  const pool = await getPool(settings.sql);
  const engine = await getEngineInfo(pool);
  console.log(`Connected to ${engine.database_name} (EngineEdition ${engine.engine_edition}).`);
  console.log(`Embedding model: ${ai.embeddingModel}`);

  const pending = await findArticlesToEmbed(pool, ai.embeddingModel);
  console.log(`${pending.length} article(s) need an embedding.`);

  let saved = 0;
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const vectors = await ai.embed(
      batch.map((article) => `${article.title}\n\n${article.content}`),
      "document",
    );
    for (const [index, article] of batch.entries()) {
      if (await saveEmbedding(pool, article, ai.embeddingModel, toVectorJson(vectors[index]!))) {
        saved += 1;
        console.log(`  KB-${article.id} ${article.title}`);
      } else {
        console.warn(`  KB-${article.id} changed while embedding; run "npm run embed" again.`);
      }
    }
  }

  const status = await getEmbeddingStatus(pool, ai.embeddingModel);
  console.log(`Saved ${saved}. ${status.up_to_date}/${status.articles} articles have current embeddings.`);
  if (status.other_models.length > 0) {
    console.log(`Rows from other models were replaced: ${status.other_models.join(", ")}.`);
  }
  if (status.stale_or_missing > 0) process.exitCode = 1;
} catch (error) {
  console.error("Embedding backfill failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool();
}
