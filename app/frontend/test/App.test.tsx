import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { loadCaseData, suggestReply } from "../src/api";
import { SAMPLE_ACCOUNTS, SAMPLE_SUPPORT_CASES } from "../src/data/sampleData";
import type { AssistResult } from "../src/types";

vi.mock("../src/config", () => ({ DATA_SOURCE: "sample" }));
vi.mock("../src/api", () => ({ loadCaseData: vi.fn(), suggestReply: vi.fn() }));

const reply: AssistResult = {
  status: "answered",
  answer: "Review the single sign-on configuration [KB-3].",
  notice: null,
  citations: [3],
  sources: [
    {
      id: 3,
      title: "Single sign-on configuration",
      product_area: "Single sign-on",
      distance: 0.21,
      cited: true,
      within_threshold: true,
    },
  ],
  embedding_model: "test:embeddings:768",
  chat_model: "test:chat",
  max_distance: 0.5,
  timings_ms: { embed: 10, search: 2, generate: 100, total: 112 },
};

async function openWorkspace() {
  render(<App />);
  await screen.findByRole("heading", { name: "Sample case: cannot sign in" });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadCaseData).mockResolvedValue({
    accounts: SAMPLE_ACCOUNTS,
    cases: SAMPLE_SUPPORT_CASES,
  });
  vi.mocked(suggestReply).mockResolvedValue(reply);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});
afterEach(cleanup);

describe("CaseDesk inbox", () => {
  it("preserves the demo data badge and shows real counts", async () => {
    await openWorkspace();
    expect(screen.getByText("Hardcoded sample data")).toBeTruthy();
    expect(screen.getByText("2 of 3 cases")).toBeTruthy();
    expect(screen.getByText("2 open")).toBeTruthy();
    expect(screen.getByText("1 high priority")).toBeTruthy();
  });

  it("searches cases and accounts and recovers from an empty search", async () => {
    await openWorkspace();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search cases" }), {
      target: { value: "Demo Corp" },
    });
    expect(screen.getByText("1 of 3 cases")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Sample case: report export fails" }),
    ).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "not-a-real-account" },
    });
    expect(screen.getByText("No cases found")).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear search" })[0]!,
    );
    expect(screen.getByText("2 of 3 cases")).toBeTruthy();
  });

  it("selects a visible case when a status filter hides the previous selection", async () => {
    await openWorkspace();
    fireEvent.click(
      screen.getByRole("button", { name: /Sample case: report export fails/ }),
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by status" }),
      { target: { value: "Resolved" } },
    );
    expect(
      screen.getByRole("heading", { name: "Sample case: invoice question" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Sample case: report export fails",
      }),
    ).toBeNull();
    expect(screen.getByText("1 of 3 cases")).toBeTruthy();
  });

  it("uses navigation filters and can sort by newest", async () => {
    await openWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "All cases" }));
    expect(screen.getByText("3 of 3 cases")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort cases" }), {
      target: { value: "newest" },
    });
    const rows = within(
      screen.getByRole("region", { name: "Case queue" }),
    ).getAllByRole("listitem");
    expect(rows[0]!.textContent).toContain("Sample case: report export fails");
    fireEvent.click(screen.getByRole("button", { name: "Resolved cases" }));
    expect(
      screen.getByRole("heading", { name: "Sample case: invoice question" }),
    ).toBeTruthy();
  });

  it("retains existing cases if refreshing fails", async () => {
    await openWorkspace();
    vi.mocked(loadCaseData).mockRejectedValueOnce(
      new Error("Connection unavailable"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh cases" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("Connection unavailable"),
    );
    expect(screen.getByRole("alert").textContent).toContain("DAB_URL");
    expect(
      screen.getByRole("heading", { name: "Sample case: cannot sign in" }),
    ).toBeTruthy();
  });
});

describe("CaseDesk reply workspace", () => {
  it("submits edited context and disables submission for a short question", async () => {
    await openWorkspace();
    fireEvent.click(screen.getByText("Case context"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    expect(
      screen.getByRole("button", { name: "Suggest reply" }),
    ).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Please investigate the sign-in failure" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest reply" }));
    await screen.findByText("Draft grounded in knowledge articles");
    expect(suggestReply).toHaveBeenCalledWith(
      "Please investigate the sign-in failure",
    );
  });

  it("links citations to evidence and copies the original draft text", async () => {
    await openWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Suggest reply" }));
    const citation = await screen.findByRole("link", { name: "KB-3" });
    expect(citation.getAttribute("href")).toBe("#kb-3");
    expect(
      screen.getByText("Single sign-on configuration").closest("li")?.id,
    ).toBe("kb-3");
    fireEvent.click(screen.getByRole("button", { name: "Copy draft" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(reply.answer),
    );
    expect(
      await screen.findByRole("button", { name: "Draft copied" }),
    ).toBeTruthy();
  });

  it("renders an abstention without inventing a draft", async () => {
    vi.mocked(suggestReply).mockResolvedValueOnce({
      ...reply,
      status: "no_match",
      answer: null,
      citations: [],
      notice: "No approved article answers this case.",
    });
    await openWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Suggest reply" }));
    expect(
      await screen.findByText("No matching knowledge article"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy draft" })).toBeNull();
    expect(screen.queryByRole("link", { name: "KB-3" })).toBeNull();
  });

  it("shows retrieval-only and uncited states distinctly", async () => {
    vi.mocked(suggestReply).mockResolvedValueOnce({
      ...reply,
      status: "retrieval_only",
      answer: null,
    });
    await openWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Suggest reply" }));
    expect(
      await screen.findByText("Sources only: answer model unavailable"),
    ).toBeTruthy();
    vi.mocked(suggestReply).mockResolvedValueOnce({
      ...reply,
      status: "uncited",
      citations: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Regenerate reply" }));
    expect(
      await screen.findByText(
        "Draft without citations: review every statement",
      ),
    ).toBeTruthy();
  });

  it("shows a loading state and handles an unavailable AI service", async () => {
    let rejectRequest: (error: Error) => void = () => {};
    vi.mocked(suggestReply).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
    );
    await openWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Suggest reply" }));
    expect(
      screen.getByRole("button", { name: "Searching knowledge base..." }),
    ).toHaveProperty("disabled", true);
    rejectRequest(new Error("Model offline"));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("Model offline"),
    );
    expect(screen.getByRole("alert").textContent).toContain("AI_SERVICE_URL");
    expect(
      screen.getByRole("button", { name: "Suggest reply" }),
    ).toHaveProperty("disabled", false);
  });
});
