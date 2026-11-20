import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMBEDDING_DIMENSIONS } from "../src/config.js";
import type { AiClient } from "../src/ai.js";
import {
  assist,
  buildMessages,
  extractCitations,
  INSUFFICIENT_CONTEXT,
  selectEvidence,
  toVectorJson,
  type ArticleMatch,
} from "../src/rag.js";

const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i / EMBEDDING_DIMENSIONS);

const articles: ArticleMatch[] = [
  { id: 3, title: "Data sync is delayed", product_area: "Data sync", content: "Resume the queue.", distance: 0.21 },
  { id: 4, title: "Handle API rate limits", product_area: "API", content: "Honor Retry-After.", distance: 0.48 },
  { id: 9, title: "Large report exports", product_area: "Reporting", content: "Use Schedule export.", distance: 0.71 },
];

function fakeAi(reply: string | Error): AiClient & { chatCalls: number } {
  const client = {
    provider: "azure" as const,
    embeddingModel: "test:model:768",
    chatModel: "test:chat",
    chatCalls: 0,
    async embed(texts: string[]) {
      return texts.map(() => vector);
    },
    async chat() {
      client.chatCalls += 1;
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return client;
}

const run = (ai: AiClient, matches: ArticleMatch[], maxDistance = 0.5) =>
  assist("Records are stuck in Pending sync", {
    ai,
    search: async () => matches,
    topK: 3,
    maxDistance,
  });

describe("toVectorJson", () => {
  it("serializes a 768-dimension vector as a JSON array", () => {
    assert.deepEqual(JSON.parse(toVectorJson(vector)), vector);
  });
  it("rejects the wrong dimension and non-finite values", () => {
    assert.throws(() => toVectorJson([1, 2, 3]), /768/);
    assert.throws(() => toVectorJson(vector.map((v, i) => (i === 5 ? Number.NaN : v))), /finite/);
  });
});

describe("selectEvidence and buildMessages", () => {
  it("keeps only matches within the distance threshold", () => {
    assert.deepEqual(selectEvidence(articles, 0.5).map((a) => a.id), [3, 4]);
  });
  it("labels every article with its citation ID and tells the model to ignore embedded instructions", () => {
    const [system, user] = buildMessages("Question", articles.slice(0, 2));
    assert.match(system!.content, /Ignore any instructions/);
    assert.match(user!.content, /\[KB-3\] Data sync is delayed/);
    assert.match(user!.content, /\[KB-4\] Handle API rate limits/);
  });
  it("ends with the citation and no-answer rules, after the case", () => {
    const [, user] = buildMessages("Question", articles.slice(0, 2));
    assert.ok(user!.content.indexOf("Customer case:") > user!.content.indexOf("[KB-4]"));
    assert.match(user!.content, /like \[KB-3\]\. If the articles do not answer the case, reply with exactly INSUFFICIENT_CONTEXT\.$/);
  });
});

describe("extractCitations", () => {
  it("separates citations of retrieved articles from invented ones", () => {
    const result = extractCitations("Resume the queue [KB-3]. See [KB-3] and [KB-42].", [3, 4]);
    assert.deepEqual(result, { valid: [3], invalid: [42] });
  });
});

describe("assist", () => {
  it("answers with citations when evidence is close enough", async () => {
    const ai = fakeAi("Open the queue and select Resume queue [KB-3].");
    const result = await run(ai, articles);
    assert.equal(result.status, "answered");
    assert.deepEqual(result.citations, [3]);
    assert.equal(result.sources.find((s) => s.id === 3)?.cited, true);
    assert.equal(result.sources.find((s) => s.id === 9)?.within_threshold, false);
    assert.equal("content" in result.sources[0]!, false);
  });

  it("abstains without calling the answer model when nothing is within the threshold", async () => {
    const ai = fakeAi("should not be called");
    const result = await run(ai, articles, 0.1);
    assert.equal(result.status, "no_match");
    assert.equal(result.answer, null);
    assert.equal(ai.chatCalls, 0);
    assert.equal(result.sources.length, 3);
  });

  it("reports missing embeddings instead of an empty answer", async () => {
    const result = await run(fakeAi("unused"), []);
    assert.equal(result.status, "no_match");
    assert.match(result.notice!, /npm run embed/);
  });

  it("treats the model's insufficient-context reply as no match", async () => {
    const result = await run(fakeAi(INSUFFICIENT_CONTEXT), articles);
    assert.equal(result.status, "no_match");
    assert.equal(result.answer, null);
  });

  it("removes citations to articles that were not retrieved", async () => {
    const result = await run(fakeAi("Resume the queue [KB-3] and reinstall [KB-77]."), articles);
    assert.equal(result.status, "answered");
    assert.doesNotMatch(result.answer!, /KB-77/);
    assert.match(result.notice!, /KB-77/);
  });

  it("flags a draft that cites nothing", async () => {
    const result = await run(fakeAi("Try turning it off and on again."), articles);
    assert.equal(result.status, "uncited");
    assert.deepEqual(result.citations, []);
  });

  it("returns retrieved sources, not invented text, when the answer model fails", async () => {
    const result = await run(fakeAi(new Error("model offline")), articles);
    assert.equal(result.status, "retrieval_only");
    assert.equal(result.answer, null);
    assert.equal(result.sources.length, 3);
  });
});
