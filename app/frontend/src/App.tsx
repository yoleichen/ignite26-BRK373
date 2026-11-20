import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  BookOpen,
  Building2,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Clipboard,
  Clock3,
  Database,
  FileText,
  Globe2,
  Inbox,
  Layers2,
  ListFilter,
  LoaderCircle,
  MessageSquareText,
  RotateCw,
  Search,
  ShieldCheck,
  SignalHigh,
  Sparkles,
  X,
} from "lucide-react";
import { loadCaseData, suggestReply, type CaseData } from "./api";
import { DATA_SOURCE } from "./config";
import type { Account, AssistResult, CaseStatus, SupportCase } from "./types";

const STATUS_FILTERS: Array<"Open" | "All" | CaseStatus> = [
  "Open",
  "All",
  "New",
  "In Progress",
  "Waiting on Customer",
  "Resolved",
];
const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
const reference = (id: number) => `CASE-${String(id).padStart(4, "0")}`;

export function App() {
  const [data, setData] = useState<CaseData>();
  const [loadError, setLoadError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("Open");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("priority");
  const [selectedId, setSelectedId] = useState<number>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(undefined);
    loadCaseData()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const accountsById = useMemo(
    () => new Map(data?.accounts.map((account) => [account.id, account])),
    [data],
  );
  const visibleCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.cases ?? [])
      .filter((supportCase) => {
        const matchesStatus =
          filter === "All" ||
          (filter === "Open"
            ? supportCase.status !== "Resolved"
            : supportCase.status === filter);
        const text = `${reference(supportCase.id)} ${supportCase.title} ${supportCase.product_area} ${accountsById.get(supportCase.account_id)?.name ?? ""}`;
        return matchesStatus && (!query || text.toLowerCase().includes(query));
      })
      .sort(
        (first, second) =>
          (sort === "priority"
            ? PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority]
            : 0) || second.opened_at.localeCompare(first.opened_at),
      );
  }, [data, filter, search, sort, accountsById]);
  const selected =
    visibleCases.find((supportCase) => supportCase.id === selectedId) ??
    visibleCases[0];
  const openCount =
    data?.cases.filter((supportCase) => supportCase.status !== "Resolved")
      .length ?? 0;
  const resolvedCount = (data?.cases.length ?? 0) - openCount;
  const urgentCount =
    data?.cases.filter(
      (supportCase) =>
        supportCase.status !== "Resolved" &&
        ["High", "Critical"].includes(supportCase.priority),
    ).length ?? 0;

  return (
    <div className="app-shell">
      <nav className="nav-rail" aria-label="Case views">
        <button
          className="brand-mark"
          title="CaseDesk inbox"
          aria-label="CaseDesk inbox"
          onClick={() => {
            setFilter("Open");
            setSearch("");
          }}
        >
          <Layers2 size={23} strokeWidth={1.8} />
        </button>
        <div className="rail-views">
          <button
            className={`rail-button ${filter !== "All" && filter !== "Resolved" ? "active" : ""}`}
            aria-label="Open cases"
            title="Open cases"
            aria-pressed={filter !== "All" && filter !== "Resolved"}
            onClick={() => setFilter("Open")}
          >
            <Inbox size={20} />
          </button>
          <button
            className={`rail-button ${filter === "All" ? "active" : ""}`}
            aria-label="All cases"
            title="All cases"
            aria-pressed={filter === "All"}
            onClick={() => setFilter("All")}
          >
            <Layers2 size={20} />
          </button>
          <button
            className={`rail-button ${filter === "Resolved" ? "active" : ""}`}
            aria-label="Resolved cases"
            title="Resolved cases"
            aria-pressed={filter === "Resolved"}
            onClick={() => setFilter("Resolved")}
          >
            <CheckCheck size={20} />
          </button>
        </div>
        <span className="rail-footer" title="Relecloud Connect">
          RC
        </span>
      </nav>

      <div className="workspace">
        <header className="workspace-topbar">
          <div className="wordmark">
            CaseDesk
            <span className="workspace-divider" />
            <span className="workspace-name">Relecloud Connect</span>
          </div>
          <div className="topbar-actions">
            <span
              className={`data-source ${DATA_SOURCE}`}
              title={
                DATA_SOURCE === "dab"
                  ? "Live data from Azure SQL via Data API builder"
                  : "Hardcoded sample data"
              }
            >
              <span className="source-dot" />
              <Database size={13} />
              <span>
                {DATA_SOURCE === "dab"
                  ? "Live · Azure SQL via Data API builder"
                  : "Hardcoded sample data"}
              </span>
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
              aria-label="Refresh cases"
              title="Refresh cases"
            >
              <RotateCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>

        {loadError && (
          <div className="error-banner" role="alert">
            <CircleAlert size={18} />
            <div>
              <strong>Cases could not be refreshed.</strong>
              <span>Check Data API builder and DAB_URL in your frontend local settings. {loadError}</span>
            </div>
          </div>
        )}

        <main className="case-layout">
          <section
            className="case-inbox"
            aria-label="Case queue"
            aria-busy={loading}
          >
            <div className="inbox-heading">
              <div>
                <span className="section-label">Customer support</span>
                <h1>
                  Case queue{" "}
                  <span className="heading-count">
                    {data?.cases.length ?? 0}
                  </span>
                </h1>
              </div>
              <Inbox size={22} strokeWidth={1.5} />
            </div>
            <div className="inbox-stats">
              <span>
                <span className="status-dot jade" />
                {openCount} open
              </span>
              <span>
                <span className="status-dot coral" />
                {urgentCount} high priority
              </span>
            </div>
            <div className="queue-search">
              <Search size={16} />
              <input
                type="search"
                aria-label="Search cases"
                placeholder="Search cases or accounts"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  className="icon-button small"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="queue-tabs" role="group" aria-label="Quick filters">
              {(["Open", "All", "Resolved"] as const).map((status) => (
                <button
                  key={status}
                  aria-pressed={filter === status}
                  className={filter === status ? "active" : ""}
                  onClick={() => setFilter(status)}
                >
                  {status}
                  <span>
                    {status === "Open"
                      ? openCount
                      : status === "All"
                        ? (data?.cases.length ?? 0)
                        : resolvedCount}
                  </span>
                </button>
              ))}
            </div>
            <div className="queue-controls">
              <label className="select-control">
                <ListFilter size={13} />
                <select
                  aria-label="Filter by status"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as typeof filter)
                  }
                >
                  {STATUS_FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {status === "Open" ? "All open statuses" : status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="select-control">
                <ArrowDownWideNarrow size={13} />
                <select
                  aria-label="Sort cases"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="priority">Priority</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>

            <ul className="case-list">
              {loading && !data
                ? [0, 1, 2].map((item) => (
                    <li className="case-skeleton" key={item}>
                      <span />
                      <span />
                      <span />
                    </li>
                  ))
                : visibleCases.map((supportCase) => {
                    const accountName =
                      accountsById.get(supportCase.account_id)?.name ??
                      `Account ${supportCase.account_id}`;
                    return (
                      <li key={supportCase.id}>
                        <button
                          className={`case-row ${selected?.id === supportCase.id ? "selected" : ""}`}
                          aria-current={
                            selected?.id === supportCase.id ? "true" : undefined
                          }
                          onClick={() => {
                            setSelectedId(supportCase.id);
                            if (window.innerWidth <= 760)
                              document
                                .getElementById("case-detail")
                                ?.scrollIntoView({
                                  block: "start",
                                  behavior: window.matchMedia(
                                    "(prefers-reduced-motion: reduce)",
                                  ).matches
                                    ? "auto"
                                    : "smooth",
                                });
                          }}
                        >
                          <span className="case-row-top">
                            <span className="account-monogram">
                              {initials(accountName)}
                            </span>
                            <span className="row-account">{accountName}</span>
                            <span className="case-reference">
                              #{String(supportCase.id).padStart(3, "0")}
                            </span>
                          </span>
                          <span className="case-title">
                            {supportCase.title}
                          </span>
                          <span className="case-row-bottom">
                            <span
                              className={`priority-text ${supportCase.priority.toLowerCase()}`}
                            >
                              <SignalHigh size={14} />
                              {supportCase.priority}
                            </span>
                            <span className="row-status">
                              {supportCase.status}
                            </span>
                            <time dateTime={supportCase.opened_at}>
                              {shortDate(supportCase.opened_at)}
                            </time>
                          </span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
            {!loading && visibleCases.length === 0 && (
              <div className="queue-empty">
                <Search size={24} />
                <strong>No cases found</strong>
                <span>
                  {search
                    ? "No results for this search."
                    : "No cases in this view."}
                </span>
                {search && (
                  <button className="text-button" onClick={() => setSearch("")}>
                    Clear search
                  </button>
                )}
              </div>
            )}
            <footer className="inbox-footer">
              <span>
                {loading
                  ? "Refreshing cases..."
                  : `${visibleCases.length} of ${data?.cases.length ?? 0} cases`}
              </span>
              <span>Priority inbox</span>
            </footer>
          </section>

          {selected ? (
            <CaseDetail
              key={selected.id}
              supportCase={selected}
              account={accountsById.get(selected.account_id)}
            />
          ) : (
            <section
              id="case-detail"
              className="case-detail detail-empty"
              aria-label="Case detail"
            >
              <Inbox size={36} strokeWidth={1.4} />
              <h2>
                {loading ? "Opening your workspace" : "Your queue is clear"}
              </h2>
              <p>{loading ? "Loading cases..." : "No case selected."}</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function CaseDetail({
  supportCase,
  account,
}: {
  supportCase: SupportCase;
  account?: Account;
}) {
  const [question, setQuestion] = useState(
    `${supportCase.title}\n\n${supportCase.description}`,
  );
  const [result, setResult] = useState<AssistResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      setResult(await suggestReply(question));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="case-detail" className="case-detail" aria-label="Case detail">
      <header className="case-heading">
        <div className="case-breadcrumb">
          <span>Cases</span>
          <ChevronRight size={13} />
          <span>{reference(supportCase.id)}</span>
          <span
            className={`status-badge ${supportCase.status === "Resolved" ? "resolved" : ""}`}
          >
            <CircleDot size={11} />
            {supportCase.status}
          </span>
        </div>
        <h2>{supportCase.title}</h2>
        <div className="case-heading-meta">
          <span
            className={`priority-text ${supportCase.priority.toLowerCase()}`}
          >
            <SignalHigh size={15} />
            {supportCase.priority} priority
          </span>
          <span className="metadata-separator" />
          <span>{supportCase.product_area}</span>
          <span className="case-opened">
            <Clock3 size={13} />
            Opened {shortDate(supportCase.opened_at)}
          </span>
        </div>
      </header>

      <div className="case-body">
        <div className="case-main">
          <section className="issue-section">
            <h3>
              <MessageSquareText size={17} />
              Customer issue
            </h3>
            <p className="description">{supportCase.description}</p>
          </section>
          <section className="reply-workspace" aria-label="Reply workspace">
            <div className="reply-heading">
              <div className="assistant-symbol">
                <Sparkles size={18} />
              </div>
              <div>
                <h3>Suggested reply</h3>
                <span className="reply-subtitle">
                  {busy
                    ? "Retrieving sources"
                    : result?.answer
                      ? "Ready for review"
                      : "Not generated"}
                </span>
              </div>
              <span className="review-badge">
                <ShieldCheck size={13} />
                Human review
              </span>
            </div>
            <details className="search-context">
              <summary>
                <ChevronRight size={14} />
                Case context<span>{question.length}/2000</span>
              </summary>
              <label htmlFor="question">
                Question sent to the knowledge base
              </label>
              <textarea
                id="question"
                rows={4}
                value={question}
                maxLength={2000}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </details>
            {busy ? (
              <div className="draft-placeholder searching" role="status">
                <span className="draft-empty-icon">
                  <LoaderCircle size={25} className="spin" />
                </span>
                <strong>Finding the right knowledge</strong>
                <span>Searching for relevant articles...</span>
              </div>
            ) : result ? (
              <AssistPanel result={result} />
            ) : (
              <div className="draft-placeholder">
                <span className="draft-empty-icon">
                  <BookOpen size={25} strokeWidth={1.5} />
                </span>
                <strong>No draft yet</strong>
                <span>{reference(supportCase.id)}</span>
              </div>
            )}
            {error && (
              <div className="assist-error" role="alert">
                <CircleAlert size={17} />
                <div>
                  <strong>Reply unavailable</strong>
                  <p>Check the AI service and AI_SERVICE_URL in your frontend local settings. {error}</p>
                </div>
              </div>
            )}
            <div className="reply-actions">
              <span>
                <ShieldCheck size={13} />
                Not sent automatically
              </span>
              <button
                className="primary-button"
                onClick={ask}
                disabled={busy || question.trim().length < 3}
              >
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {busy
                  ? "Searching knowledge base..."
                  : result
                    ? "Regenerate reply"
                    : "Suggest reply"}
              </button>
            </div>
          </section>
        </div>

        <aside
          className="case-context"
          aria-label="Account and case information"
        >
          <section className="account-section">
            <h3>Account</h3>
            <div className="account-identity">
              <span className="company-mark">
                <Building2 size={22} strokeWidth={1.5} />
              </span>
              <div>
                <strong>
                  {account?.name ?? `Account ${supportCase.account_id}`}
                </strong>
                {account && <span>{account.industry}</span>}
              </div>
            </div>
            {account && (
              <dl className="account-facts">
                <div>
                  <dt>Plan</dt>
                  <dd className="tier-badge">{account.tier}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>
                    <Globe2 size={13} />
                    {account.region}
                  </dd>
                </div>
              </dl>
            )}
          </section>
          <section className="case-properties">
            <h3>Case details</h3>
            <dl>
              <div>
                <dt>Reference</dt>
                <dd>{reference(supportCase.id)}</dd>
              </div>
              <div>
                <dt>Product area</dt>
                <dd>{supportCase.product_area}</dd>
              </div>
              <div>
                <dt>Opened</dt>
                <dd>{formatDate(supportCase.opened_at)}</dd>
              </div>
              {supportCase.resolved_at && (
                <div>
                  <dt>Resolved</dt>
                  <dd>{formatDate(supportCase.resolved_at)}</dd>
                </div>
              )}
            </dl>
          </section>
          <div className="context-note">
            <ShieldCheck size={16} />
            <span>
              Support workspace
              <br />
              <strong>Relecloud Connect</strong>
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

const STATUS_LABEL: Record<AssistResult["status"], string> = {
  answered: "Draft grounded in knowledge articles",
  uncited: "Draft without citations: review every statement",
  no_match: "No matching knowledge article",
  retrieval_only: "Sources only: answer model unavailable",
};

function AssistPanel({ result }: { result: AssistResult }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(result.answer ?? "");
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };
  const StatusIcon =
    result.status === "answered"
      ? CircleCheck
      : result.status === "no_match"
        ? Search
        : CircleAlert;

  return (
    <div className={`assist-result ${result.status}`} aria-live="polite">
      <div className="draft-output">
        <div className="draft-status">
          <StatusIcon size={16} />
          <span>{STATUS_LABEL[result.status]}</span>
          {result.answer && (
            <button
              className="icon-button small"
              aria-label={copied ? "Draft copied" : "Copy draft"}
              title={copied ? "Draft copied" : "Copy draft"}
              onClick={copyDraft}
            >
              {copied ? <Check size={15} /> : <Clipboard size={15} />}
            </button>
          )}
        </div>
        {result.answer && (
          <p className="answer">{renderCitations(result.answer)}</p>
        )}
        {result.notice && <p className="notice">{result.notice}</p>}
        {copyError && (
          <p className="notice" role="alert">
            Copy failed. Select the draft text to copy it.
          </p>
        )}
        {copied && (
          <span className="visually-hidden" role="status">
            Draft copied to clipboard
          </span>
        )}
      </div>
      <div className="sources-heading">
        <h4>
          <BookOpen size={15} />
          Knowledge sources <span>{result.sources.length}</span>
        </h4>
        <span>Cosine distance</span>
      </div>
      {result.sources.length > 0 ? (
        <ul className="knowledge-sources">
          {result.sources.map((source) => (
            <li
              id={`kb-${source.id}`}
              key={source.id}
              className={source.within_threshold ? "" : "outside-threshold"}
            >
              <span className="article-icon">
                <FileText size={17} />
              </span>
              <div className="source-description">
                <span className="source-reference">
                  KB-{source.id}
                  <span
                    className={`source-usage ${source.cited ? "cited" : ""}`}
                  >
                    {source.cited
                      ? "Cited"
                      : source.within_threshold
                        ? "Context"
                        : "Outside threshold"}
                  </span>
                </span>
                <strong>{source.title}</strong>
              </div>
              <span className="source-distance">
                {source.distance.toFixed(3)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-sources">No articles retrieved.</p>
      )}
      <details className="retrieval-details">
        <summary>
          Retrieval details
          <ChevronRight size={12} />
        </summary>
        <dl>
          <div>
            <dt>Embeddings</dt>
            <dd>{result.embedding_model}</dd>
          </div>
          {result.chat_model && (
            <div>
              <dt>Answer model</dt>
              <dd>{result.chat_model}</dd>
            </div>
          )}
          <div>
            <dt>Distance threshold</dt>
            <dd>{result.max_distance}</dd>
          </div>
          <div>
            <dt>Timing</dt>
            <dd>
              Embed {result.timings_ms.embed} ms / search{" "}
              {result.timings_ms.search} ms / generate{" "}
              {result.timings_ms.generate} ms
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

function renderCitations(text: string) {
  return text.split(/(\[KB-\d+\])/g).map((part, index) =>
    /^\[KB-\d+\]$/.test(part) ? (
      <a key={index} className="citation" href={`#kb-${part.slice(4, -1)}`}>
        {part.slice(1, -1)}
      </a>
    ) : (
      part
    ),
  );
}
