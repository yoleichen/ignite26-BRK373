// Shapes match the database columns exactly (snake_case), because Data API builder returns them
// unchanged. The hardcoded sample data in sampleData.ts uses the same shapes.

export interface Account {
  id: number;
  name: string;
  industry: string;
  tier: "Standard" | "Premium" | "Enterprise";
  region: string;
}

export type CasePriority = "Low" | "Medium" | "High" | "Critical";
export type CaseStatus = "New" | "In Progress" | "Waiting on Customer" | "Resolved";

export interface SupportCase {
  id: number;
  account_id: number;
  title: string;
  description: string;
  product_area: string;
  priority: CasePriority;
  status: CaseStatus;
  opened_at: string;
  resolved_at: string | null;
}

export interface KbArticle {
  id: number;
  title: string;
  product_area: string;
  content: string;
  updated_at: string;
}

export interface AssistSource {
  id: number;
  title: string;
  product_area: string;
  distance: number;
  cited: boolean;
  within_threshold: boolean;
}

export interface AssistResult {
  status: "answered" | "uncited" | "no_match" | "retrieval_only";
  answer: string | null;
  notice: string | null;
  citations: number[];
  sources: AssistSource[];
  embedding_model: string;
  chat_model: string | null;
  max_distance: number;
  timings_ms: { embed: number; search: number; generate: number; total: number };
}
