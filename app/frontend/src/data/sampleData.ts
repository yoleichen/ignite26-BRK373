// Hardcoded sample data the UI starts with, before the database exists.
// Copilot reads this file and docs/PRD.md to create the tables in the walkthrough.
// Field names become column names, so keep them lowercase snake_case.

import type { Account, KbArticle, SupportCase } from "../types";

export const SAMPLE_ACCOUNTS: Account[] = [
  { id: 1, name: "Sample Account (hardcoded)", industry: "Retail", tier: "Standard", region: "North America" },
  { id: 2, name: "Demo Corp (hardcoded)", industry: "Manufacturing", tier: "Enterprise", region: "Europe" },
];

export const SAMPLE_SUPPORT_CASES: SupportCase[] = [
  {
    id: 1,
    account_id: 1,
    title: "Sample case: cannot sign in",
    description: "Placeholder data from sampleData.ts. Connect the database to see real cases.",
    product_area: "Single sign-on",
    priority: "High",
    status: "New",
    opened_at: "2026-10-01T09:00:00",
    resolved_at: null,
  },
  {
    id: 2,
    account_id: 2,
    title: "Sample case: report export fails",
    description: "Placeholder data from sampleData.ts. Connect the database to see real cases.",
    product_area: "Reporting",
    priority: "Medium",
    status: "In Progress",
    opened_at: "2026-10-02T14:30:00",
    resolved_at: null,
  },
  {
    id: 3,
    account_id: 1,
    title: "Sample case: invoice question",
    description: "Placeholder data from sampleData.ts. Connect the database to see real cases.",
    product_area: "Billing",
    priority: "Low",
    status: "Resolved",
    opened_at: "2026-09-28T11:15:00",
    resolved_at: "2026-09-29T08:45:00",
  },
];

export const SAMPLE_KB_ARTICLES: KbArticle[] = [
  {
    id: 1,
    title: "Sample article: reset single sign-on",
    product_area: "Single sign-on",
    content: "Placeholder knowledge article text.",
    updated_at: "2026-09-01T10:00:00",
  },
];
