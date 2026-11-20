// Reads and validates settings from the environment (.env locally, .env.cloud for Azure).

export const EMBEDDING_DIMENSIONS = 768; // must match VECTOR(768) in database/03-vectors.sql

export type AiProvider = "azure" | "ollama";
export type SqlAuth = "sql" | "entra";

export interface Settings {
  sql: {
    server: string;
    port: number;
    database: string;
    auth: SqlAuth;
    user?: string;
    password?: string;
    trustServerCertificate: boolean;
  };
  ai: {
    provider: AiProvider;
    azure: {
      endpoint: string;
      embeddingDeployment: string;
      chatDeployment: string;
    };
    ollama: {
      url: string;
      embeddingModel: string;
      chatModel: string;
    };
  };
  rag: { topK: number; maxDistance: number };
  port: number;
}

function read(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing setting ${name}. Copy .env.example to .env and fill it in.`);
}

function readNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Setting ${name} must be a number between ${min} and ${max}.`);
  }
  return value;
}

function readChoice<T extends string>(name: string, choices: readonly T[], fallback: T): T {
  const value = (process.env[name]?.trim() || fallback) as T;
  if (!choices.includes(value)) {
    throw new Error(`Setting ${name} must be one of: ${choices.join(", ")}.`);
  }
  return value;
}

export function loadSettings(): Settings {
  const auth = readChoice<SqlAuth>("SQL_AUTH", ["sql", "entra"], "sql");
  const provider = readChoice<AiProvider>("AI_PROVIDER", ["azure", "ollama"], "azure");
  const server = read("SQL_SERVER");
  const trustServerCertificate = read("SQL_TRUST_SERVER_CERTIFICATE", "false") === "true";

  if (trustServerCertificate && !/^(localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(server)) {
    throw new Error("SQL_TRUST_SERVER_CERTIFICATE=true is only allowed for a local server.");
  }

  return {
    sql: {
      server,
      port: readNumber("SQL_PORT", 1433, 1, 65535),
      database: read("SQL_DATABASE", "CaseDesk"),
      auth,
      user: auth === "sql" ? read("SQL_USER") : undefined,
      password: auth === "sql" ? read("SQL_PASSWORD") : undefined,
      trustServerCertificate,
    },
    ai: {
      provider,
      azure: {
        endpoint: provider === "azure" ? read("AZURE_OPENAI_ENDPOINT") : "",
        embeddingDeployment: read("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small"),
        chatDeployment: read("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-5.4-mini"),
      },
      ollama: {
        url: read("OLLAMA_URL", "http://localhost:11434").replace(/\/+$/, ""),
        embeddingModel: read("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
        chatModel: read("OLLAMA_CHAT_MODEL", "llama3.2:3b"),
      },
    },
    rag: {
      topK: readNumber("RAG_TOP_K", 3, 1, 10),
      maxDistance: readNumber("RAG_MAX_DISTANCE", 0.5, 0, 2),
    },
    port: readNumber("PORT", 8000, 1, 65535),
  };
}
