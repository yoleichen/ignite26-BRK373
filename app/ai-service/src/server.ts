import express, { type NextFunction, type Request, type Response } from "express";
import { loadSettings } from "./config.js";
import { createAiClient } from "./ai.js";
import { closePool, getPool } from "./db.js";
import { assist } from "./rag.js";
import { getEmbeddingStatus, getEngineInfo, searchArticles } from "./repository.js";

const settings = loadSettings();
const ai = createAiClient(settings.ai);
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/health", async (_req, res) => {
  const body = {
    status: "ok" as "ok" | "degraded",
    ai: { provider: ai.provider, embedding_model: ai.embeddingModel, chat_model: ai.chatModel },
    database: { reachable: false, engine_edition: null as number | null, database: settings.sql.database },
    embeddings: null as Awaited<ReturnType<typeof getEmbeddingStatus>> | null,
    rag: settings.rag,
  };
  try {
    const pool = await getPool(settings.sql);
    const engine = await getEngineInfo(pool);
    body.database = { reachable: true, engine_edition: engine.engine_edition, database: engine.database_name };
    body.embeddings = await getEmbeddingStatus(pool, ai.embeddingModel);
    if (body.embeddings.stale_or_missing > 0) body.status = "degraded";
  } catch (error) {
    console.error("Health check failed:", error);
    body.status = "degraded";
  }
  res.status(body.status === "ok" ? 200 : 503).json(body);
});

app.post("/assist", async (req: Request, res: Response) => {
  const question: unknown = req.body?.question;
  if (typeof question !== "string" || question.trim().length < 3 || question.length > 2000) {
    res.status(400).json({ error: "Send a JSON body with a question of 3 to 2000 characters." });
    return;
  }
  try {
    const pool = await getPool(settings.sql);
    const result = await assist(question.trim(), {
      ai,
      search: (vector, model, topK) => searchArticles(pool, vector, model, topK),
      topK: settings.rag.topK,
      maxDistance: settings.rag.maxDistance,
      log: (message, error) => console.warn(message, error),
    });
    res.json(result);
  } catch (error) {
    console.error("Assist request failed:", error);
    res.status(502).json({ error: "Could not reach the embedding model or the database. Check the service log." });
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // express.json() reports oversized or malformed bodies as 4xx errors with a status.
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? "Request body is too large." : "Invalid JSON body." });
    return;
  }
  console.error("Unhandled request error:", error);
  res.status(500).json({ error: "Unexpected error." });
});

const server = app.listen(settings.port, "127.0.0.1", () => {
  console.log(`CaseDesk AI service on http://127.0.0.1:${settings.port}`);
  console.log(`Database ${settings.sql.server}:${settings.sql.port}/${settings.sql.database} (${settings.sql.auth} auth)`);
  console.log(`Embeddings ${ai.embeddingModel} | answers ${ai.chatModel} | max distance ${settings.rag.maxDistance}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EADDRINUSE") throw error;
  console.error(
    `Port ${settings.port} is already in use. Set PORT in app/ai-service/.env to a free port, ` +
      "and AI_SERVICE_URL in app/frontend/.env.local to match.",
  );
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void closePool().finally(() => process.exit(0)));
  });
}
