// One interface over Azure OpenAI and Ollama. The database never sees which one you use:
// both are asked for 768-dimensional vectors, and every stored vector records its model.

import OpenAI from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { EMBEDDING_DIMENSIONS, type Settings } from "./config.js";

export type EmbeddingPurpose = "document" | "query";
export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface AiClient {
  readonly provider: Settings["ai"]["provider"];
  /** Identifies the vector space; stored in kb_article_embeddings.embedding_model. */
  readonly embeddingModel: string;
  readonly chatModel: string;
  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]>;
  chat(messages: ChatMessage[]): Promise<string>;
}

export function assertDimensions(vectors: number[][], expectedCount: number): number[][] {
  if (vectors.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} embeddings but received ${vectors.length}.`);
  }
  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `The embedding model returned ${vector.length} dimensions; the database column is VECTOR(${EMBEDDING_DIMENSIONS}).`,
      );
    }
  }
  return vectors;
}

function createAzureClient(settings: Settings["ai"]["azure"]): AiClient {
  // Azure OpenAI v1 API: no api-version; the token provider signs requests with Microsoft Entra ID.
  const client = new OpenAI({
    baseURL: `${settings.endpoint.replace(/\/+$/, "")}/openai/v1/`,
    apiKey: getBearerTokenProvider(new DefaultAzureCredential(), "https://ai.azure.com/.default"),
  });

  return {
    provider: "azure",
    embeddingModel: `azure-openai:${settings.embeddingDeployment}:${EMBEDDING_DIMENSIONS}`,
    chatModel: `azure-openai:${settings.chatDeployment}`,
    async embed(texts) {
      const response = await client.embeddings.create({
        model: settings.embeddingDeployment,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
      });
      const ordered = [...response.data].sort((a, b) => a.index - b.index);
      return assertDimensions(
        ordered.map((item) => item.embedding),
        texts.length,
      );
    },
    async chat(messages) {
      // No temperature or token cap: reasoning deployments reject them. The prompt keeps replies short.
      const response = await client.chat.completions.create({
        model: settings.chatDeployment,
        messages,
      });
      return response.choices[0]?.message.content?.trim() ?? "";
    },
  };
}

function createOllamaClient(settings: Settings["ai"]["ollama"]): AiClient {
  // nomic-embed-text was trained with task prefixes; other models do not use them.
  const usesNomicPrefixes = settings.embeddingModel.startsWith("nomic-embed-text");

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${settings.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      throw new Error(`Ollama ${path} returned HTTP ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  return {
    provider: "ollama",
    embeddingModel: `ollama:${settings.embeddingModel}:${EMBEDDING_DIMENSIONS}`,
    chatModel: `ollama:${settings.chatModel}`,
    async embed(texts, purpose) {
      const prefix = usesNomicPrefixes
        ? purpose === "query"
          ? "search_query: "
          : "search_document: "
        : "";
      const result = await post<{ embeddings: number[][] }>("/api/embed", {
        model: settings.embeddingModel,
        input: texts.map((text) => prefix + text),
      });
      return assertDimensions(result.embeddings, texts.length);
    },
    async chat(messages) {
      const result = await post<{ message?: { content?: string } }>("/api/chat", {
        model: settings.chatModel,
        messages,
        stream: false,
        options: { temperature: 0.2, num_predict: 400 },
      });
      return result.message?.content?.trim() ?? "";
    },
  };
}

export function createAiClient(settings: Settings["ai"]): AiClient {
  return settings.provider === "azure"
    ? createAzureClient(settings.azure)
    : createOllamaClient(settings.ollama);
}
