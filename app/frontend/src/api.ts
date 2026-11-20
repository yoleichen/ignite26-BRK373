import { DATA_SOURCE } from "./config";
import { SAMPLE_ACCOUNTS, SAMPLE_SUPPORT_CASES } from "./data/sampleData";
import type { Account, AssistResult, SupportCase } from "./types";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    // The AI service sends { error: "..." }; Data API builder sends { error: { message } }.
    const body = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined;
    const error = body?.error;
    const detail = typeof error === "string" ? error : (error as { message?: string } | undefined)?.message;
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as T;
}

/** Reads every page of a Data API builder REST collection. */
async function getAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const page: { value: T[]; nextLink?: string } = await getJson(next);
    rows.push(...page.value);
    next = page.nextLink ? new URL(page.nextLink).pathname + new URL(page.nextLink).search : undefined;
  }
  return rows;
}

export interface CaseData {
  accounts: Account[];
  cases: SupportCase[];
}

export async function loadCaseData(): Promise<CaseData> {
  if (DATA_SOURCE === "sample") {
    return { accounts: SAMPLE_ACCOUNTS, cases: SAMPLE_SUPPORT_CASES };
  }
  const [accounts, cases] = await Promise.all([
    getAll<Account>("/api/accounts"),
    getAll<SupportCase>("/api/support_cases?$orderby=opened_at desc"),
  ]);
  return { accounts, cases };
}

export function suggestReply(question: string): Promise<AssistResult> {
  return getJson<AssistResult>("/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
