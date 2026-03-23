import { log } from "../index";

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/\\n/g, "").trim();
}

const QUOTER_BASE_URL = "https://api.quoter.com/v1";
const QUOTER_CLIENT_ID = cleanEnv("QUOTER_CLIENT_ID");
const QUOTER_CLIENT_SECRET = cleanEnv("QUOTER_API_KEY");

export function isConfigured(): boolean {
  return !!(QUOTER_CLIENT_ID && QUOTER_CLIENT_SECRET);
}

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  if (cachedRefreshToken && Date.now() < tokenExpiresAt) {
    try {
      const res = await fetch(`${QUOTER_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: cachedRefreshToken }),
      });
      if (res.ok) {
        const data = await res.json() as { access_token: string; refresh_token: string };
        cachedToken = data.access_token;
        cachedRefreshToken = data.refresh_token;
        tokenExpiresAt = Date.now() + 55 * 60 * 1000;
        return cachedToken;
      }
    } catch (_) {}
  }

  const res = await fetch(`${QUOTER_BASE_URL}/auth/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: QUOTER_CLIENT_ID,
      client_secret: QUOTER_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Quoter OAuth2 error: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { access_token: string; refresh_token?: string };
  cachedToken = data.access_token;
  cachedRefreshToken = data.refresh_token || null;
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;
  return cachedToken;
}

async function quoterGet(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const token = await getAccessToken();
  const url = new URL(`${QUOTER_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Quoter API error: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllPages(path: string, params: Record<string, string | number> = {}): Promise<any[]> {
  const results: any[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const data = await quoterGet(path, { ...params, page, limit });
    const items: any[] = data.data || [];
    results.push(...items);
    if (!data.has_more || items.length === 0) break;
    page++;
    if (page > 50) break;
  }
  return results;
}

export interface QuoterQuote {
  id: string;
  name: string;
  status: string;
  stage: string;
  draft: boolean;
  total: number | null;
  oneTimeTotal: number | null;
  monthlyTotal: number | null;
  annualTotal: number | null;
  organization: string;
  contactId: string;
  createdAt: string;
  modifiedAt: string;
  expiredAt: string | null;
  emailStatus: string | null;
  connectwiseOpportunityId: string | null;
  number: string;
}

function parseDecimal(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

const WON_STATUSES = new Set(["accepted", "ordered", "fulfilled", "won"]);
const LOST_STATUSES = new Set(["lost", "declined"]);
const NOW = () => new Date();

function computeStage(status: string, draft: boolean, emailStatus: string | null, expiredAt: string | null): string {
  if (draft) return "Draft";
  if (WON_STATUSES.has(status)) {
    if (status === "won") return "Won";
    if (status === "accepted") return "Won - Accepted";
    if (status === "ordered") return "Won - Ordered";
    return "Won - Fulfilled";
  }
  if (LOST_STATUSES.has(status)) return "Lost";
  // Explicitly expired by API status
  if (status === "expired") return "Expired";
  // Past the expiry date (Quoter doesn't always flip status field)
  if (expiredAt && new Date(expiredAt) < NOW()) return "Expired";
  // Awaiting decision: classify by email delivery status
  switch (emailStatus) {
    case "undeliverable": return "Sent - Undeliverable";
    case "pending": case "queued": return "Sent - Pending";
    case "delivered": return "Sent - Delivered";
    case "opened": return "Sent - Opened";
    case "clicked": return "Sent - Clicked";
    case "sent": return "Sent - Delivered";
    default: return "Published";
  }
}

function mapQuote(q: any): QuoterQuote {
  const status = q.status || "pending";
  const draft = !!q.draft;
  const emailStatus = q.email_status || null;
  const expiredAt = q.expired_at || null;
  return {
    id: q.id,
    name: q.name || "",
    status,
    stage: computeStage(status, draft, emailStatus, expiredAt),
    draft,
    total: parseDecimal(q.one_time_total_decimal ?? q.monthly_total_decimal ?? q.annual_total_decimal),
    oneTimeTotal: parseDecimal(q.one_time_total_decimal),
    monthlyTotal: parseDecimal(q.monthly_total_decimal),
    annualTotal: parseDecimal(q.annual_total_decimal),
    organization: q.billing_organization || "",
    contactId: q.contact_id || "",
    createdAt: q.created_at || "",
    modifiedAt: q.modified_at || "",
    expiredAt: q.expired_at || null,
    emailStatus,
    connectwiseOpportunityId: q.connectwise_opportunity_id || null,
    number: q.number || "",
  };
}

export interface QuoterSummary {
  // Awaiting Decision: Published + all Sent-* + Expired (7 statuses)
  awaitingQuotes: QuoterQuote[];
  awaitingCount: number;
  awaitingValue: number;
  // Needs Follow-Up: Expired quotes only
  needsActionQuotes: QuoterQuote[];
  needsActionCount: number;
  needsActionValue: number;
  // Pipeline Value: all open quotes (not Won or Lost) — Awaiting + Expired + Draft
  pipelineValue: number;
  // Won this calendar month
  wonThisMonth: number;
  wonThisMonthValue: number;
  quotesThisMonth: number;
  recentQuotes: QuoterQuote[];
}

export async function fetchRawQuotes(): Promise<any[]> {
  if (!isConfigured()) throw new Error("Quoter not configured");
  return fetchAllPages("/quotes");
}

export async function getQuotesSummary(): Promise<QuoterSummary> {
  if (!isConfigured()) {
    throw new Error("Quoter not configured");
  }

  const rawAllQuotes = await fetchAllPages("/quotes");
  const mappedQuotes = rawAllQuotes.map(mapQuote);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const WON = new Set(["accepted", "ordered", "fulfilled", "won"]);

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const cutoff12 = twelveMonthsAgo.toISOString();

  // Final states that always win over any other revision of the same quote
  const FINAL_STAGE_RANK: Record<string, number> = {
    "Won - Fulfilled": 9,
    "Won - Ordered": 8,
    "Won - Accepted": 7,
    "Won": 6,
    "Lost": 5,
  };

  // Deduplicate ALL quotes globally:
  // 1. Final states (Won/Lost) always beat non-final states
  // 2. Among non-final states, the most recently modified revision wins
  // 3. Tiebreak on final states: higher FINAL_STAGE_RANK wins
  const best = new Map<string, QuoterQuote>();
  for (const q of mappedQuotes) {
    const key = q.number || q.id;
    const existing = best.get(key);
    if (!existing) { best.set(key, q); continue; }
    const newFinal = FINAL_STAGE_RANK[q.stage] ?? -1;
    const exFinal  = FINAL_STAGE_RANK[existing.stage] ?? -1;
    if (newFinal > exFinal) { best.set(key, q); continue; }       // new is a better final state
    if (exFinal > newFinal) continue;                              // existing is a better final state
    // Both same final tier → pick more recent modifiedAt
    if (new Date(q.modifiedAt) > new Date(existing.modifiedAt)) { best.set(key, q); }
  }
  const quotes = [...best.values()];

  // 35-day lookback window: Expired quotes older than this are stale / no longer actionable
  const thirtyFiveDaysAgo = new Date(now);
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
  const cutoff35 = thirtyFiveDaysAgo.toISOString();

  // Awaiting Decision: Published + all Sent-* + Expired within the last 35 days
  const AWAITING_STAGES = new Set([
    "Published",
    "Sent - Undeliverable", "Sent - Pending", "Sent - Delivered", "Sent - Opened", "Sent - Clicked",
    "Expired",
  ]);
  const awaitingQuotes = quotes
    .filter(q => {
      if (!AWAITING_STAGES.has(q.stage)) return false;
      // For expired quotes: only include if expired within last 35 days (still actionable)
      if (q.stage === "Expired") return q.expiredAt != null && q.expiredAt >= cutoff35;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const awaitingValue = awaitingQuotes.reduce((sum, q) => sum + (q.total || 0), 0);

  // Needs Follow-Up: Expired quotes within the last 35 days (subset of Awaiting Decision)
  const needsActionQuotes = awaitingQuotes
    .filter(q => q.stage === "Expired")
    .sort((a, b) => new Date(b.expiredAt!).getTime() - new Date(a.expiredAt!).getTime());
  const needsActionValue = needsActionQuotes.reduce((sum, q) => sum + (q.total || 0), 0);

  // Pipeline Value: all open quotes — not Won or Lost (Awaiting + Expired + Draft)
  const LOST_STAGES = new Set(["Lost"]);
  const WON_STAGES = new Set(["Won", "Won - Accepted", "Won - Ordered", "Won - Fulfilled"]);
  const pipelineQuotes = quotes.filter(q => !WON_STAGES.has(q.stage) && !LOST_STAGES.has(q.stage));
  const pipelineValue = pipelineQuotes.reduce((sum, q) => sum + (q.total || 0), 0);

  log(`Quoter: ${mappedQuotes.length} raw → ${quotes.length} deduped | awaiting=${awaitingQuotes.length} | needs-action(expired)=${needsActionQuotes.length} | pipeline=${pipelineQuotes.length}`);

  const thisMonth = quotes.filter(q => q.createdAt >= startOfMonth);
  const wonThisMonth = quotes.filter(q => WON.has(q.status) && q.modifiedAt >= startOfMonth);
  const wonThisMonthValue = wonThisMonth.reduce((sum, q) => sum + (q.total || 0), 0);

  const recentQuotes = [...quotes]
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, 20);

  log(`Quoter summary: awaiting=${awaitingQuotes.length} | expired/follow-up=${needsActionQuotes.length} | pipeline value=$${pipelineValue.toFixed(0)} | won this month=${wonThisMonth.length}`);

  return {
    awaitingQuotes,
    awaitingCount: awaitingQuotes.length,
    awaitingValue,
    needsActionQuotes,
    needsActionCount: needsActionQuotes.length,
    needsActionValue,
    pipelineValue,
    wonThisMonth: wonThisMonth.length,
    wonThisMonthValue,
    quotesThisMonth: thisMonth.length,
    recentQuotes,
  };
}
