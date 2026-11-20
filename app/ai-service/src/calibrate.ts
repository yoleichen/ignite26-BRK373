// Measures RAG_MAX_DISTANCE for the configured embedding model and saves it in .env: run with `npm run calibrate`.
// Each model spreads distances differently, so a threshold tuned for one does not carry over.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { loadSettings } from "./config.js";
import { createAiClient } from "./ai.js";
import { closePool, getPool } from "./db.js";
import { toVectorJson } from "./rag.js";
import { searchArticles } from "./repository.js";

// Cases with a matching article, and plausible support cases that no article covers. Shaped like real
// cases (title, blank line, description): far-fetched or one-line questions produce a threshold that's too loose.
const answerable = [
  "Login broken after IdP certificate change\n\nAfter our identity team rolled the SAML signing certificate this morning, users get Invalid SAML response signature. Local admin accounts still work.",
  "Work orders not syncing from tablets\n\nTechnicians closed jobs hours ago, but the office dashboard still shows them as Pending sync.",
  "Nightly import throttled\n\nOur ETL job that calls the API gets HTTP 429 Too Many Requests after a few thousand records.",
  "Large CSV export never finishes\n\nExporting a full year of activity from the reports page fails with Export failed after a few minutes.",
  "Webhook signature check fails\n\nAfter we rotated the webhook secret, our receiver rejects every event with a signature mismatch.",
  "Invite emails missing\n\nNew users say they never received the invitation email, and it isn't in their spam folder.",
];
const unanswerable = [
  "Private installation on our own servers\n\nOur IT policy requires us to run the product on our own Kubernetes cluster instead of your hosted service. Is that supported?",
  "Right-to-left language support\n\nOur Arabic-speaking staff need the interface mirrored from right to left. Is that available?",
  "Accessibility conformance report\n\nOur procurement team needs your WCAG 2.2 conformance report before we can sign the renewal.",
  "Uptime guarantee and service credits\n\nWhat service credits do we receive if monthly availability drops below 99.9 percent?",
];

const settings = loadSettings();
const ai = createAiClient(settings.ai);

async function nearest(pool: Awaited<ReturnType<typeof getPool>>, question: string) {
  const [vector] = await ai.embed([question], "query");
  const [best] = await searchArticles(pool, toVectorJson(vector!), ai.embeddingModel, 1);
  if (!best) throw new Error(`No embeddings for ${ai.embeddingModel}. Run "npm run embed" first.`);
  return best;
}

try {
  const pool = await getPool(settings.sql);
  console.log(`Embedding model: ${ai.embeddingModel}\n`);

  const answerableDistances: number[] = [];
  for (const question of answerable) {
    const best = await nearest(pool, question);
    answerableDistances.push(best.distance);
    console.log(`answerable    ${best.distance.toFixed(3)}  KB-${best.id}  ${question.split("\n")[0]}`);
  }
  const unanswerableDistances: number[] = [];
  for (const question of unanswerable) {
    const best = await nearest(pool, question);
    unanswerableDistances.push(best.distance);
    console.log(`unanswerable  ${best.distance.toFixed(3)}  KB-${best.id}  ${question.split("\n")[0]}`);
  }

  const worstMatch = Math.max(...answerableDistances);
  const closestMiss = Math.min(...unanswerableDistances);
  console.log(`\nFarthest answerable: ${worstMatch.toFixed(3)}  Closest unanswerable: ${closestMiss.toFixed(3)}`);
  if (worstMatch < closestMiss) {
    const setting = `RAG_MAX_DISTANCE=${((worstMatch + closestMiss) / 2).toFixed(2)}`;
    console.log(`Suggested ${setting}`);
    if (existsSync(".env")) {
      const env = await readFile(".env", "utf8");
      const line = /^RAG_MAX_DISTANCE=.*$/m;
      await writeFile(".env", line.test(env) ? env.replace(line, setting) : `${env.trimEnd()}\n${setting}\n`);
      console.log("Saved in app/ai-service/.env. Restart the AI service if it's running.");
    }
  } else {
    console.log("The two groups overlap: no single threshold separates them for this model. Review the questions and articles.");
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Calibration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool();
}
