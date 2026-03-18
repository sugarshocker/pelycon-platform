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

const WON_STATUSES = new Set(["accepted", "ordered", "fulfilled"]);
const LOST_STATUSES = new Set(["lost", "declined"]);
const NOW = () => new Date();

function computeStage(status: string, draft: boolean, emailStatus: string | null, expiredAt: string | null): string {
  if (draft) return "Draft";
  if (WON_STATUSES.has(status)) return status === "accepted" ? "Won - Accepted" : status === "ordered" ? "Won - Ordered" : "Won - Fulfilled";
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
  // Category 1: sent/published — awaiting client decision (no date cutoff)
  awaitingQuotes: QuoterQuote[];
  awaitingCount: number;
  awaitingValue: number;
  // Category 2: expired or draft — could still be won (no date cutoff)
  needsActionQuotes: QuoterQuote[];
  needsActionCount: number;
  needsActionValue: number;
  // Won this calendar month
  wonThisMonth: number;
  wonThisMonthValue: number;
  quotesThisMonth: number;
  recentQuotes: QuoterQuote[];
}

// Awaiting Decision: sent/published quotes waiting for client response
const AWAITING_STAGES = new Set([
  "Published",
  "Sent - Pending",
  "Sent - Delivered",
  "Sent - Opened",
  "Sent - Clicked",
  "Sent - Undeliverable",
]);

// Needs Action: expired or draft — could still be recovered, no date cutoff
const NEEDS_ACTION_STAGES = new Set(["Expired", "Draft"]);

export async function getQuotesSummary(): Promise<QuoterSummary> {
  if (!isConfigured()) {
    throw new Error("Quoter not configured");
  }

  const allQuotes = await fetchAllPages("/quotes");
  const quotes = allQuotes.map(mapQuote);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const WON = new Set(["accepted", "ordered", "fulfilled"]);

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const cutoff12 = twelveMonthsAgo.toISOString();

  // Stage engagement ranking — higher = more engaged with the quote
  const STAGE_RANK: Record<string, number> = {
    "Sent - Clicked": 5,
    "Sent - Opened": 4,
    "Sent - Delivered": 3,
    "Sent - Pending": 2,
    "Sent - Undeliverable": 1,
    "Published": 0,   // finalized but not yet emailed
    "Draft": -1,
    "Expired": -2,
  };

  // Deduplicate by quote number — keep the most-engaged record per quote
  function dedupeByNumber(list: QuoterQuote[]): QuoterQuote[] {
    const best = new Map<string, QuoterQuote>();
    for (const q of list) {
      const key = q.number || q.id;
      const existing = best.get(key);
      if (!existing || (STAGE_RANK[q.stage] ?? -99) > (STAGE_RANK[existing.stage] ?? -99)) {
        best.set(key, q);
      }
    }
    return [...best.values()];
  }

  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const cutoff60 = sixtyDaysAgo.toISOString();

  // Awaiting Decision: emailed to client (Sent-* stages) within 12 months, deduplicated by quote number
  // "Published" without email = not yet sent to client, excluded from this bucket
  const SENT_STAGES = new Set(["Sent - Delivered", "Sent - Opened", "Sent - Clicked", "Sent - Pending", "Sent - Undeliverable"]);
  const rawAwaiting = quotes.filter(q => SENT_STAGES.has(q.stage) && q.createdAt >= cutoff12);
  const awaitingQuotes = dedupeByNumber(rawAwaiting)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const awaitingValue = awaitingQuotes.reduce((sum, q) => sum + (q.total || 0), 0);

  // Needs Follow-Up: recently expired (within 60 days) + any draft
  // Uses shorter window for expired — older expired quotes are effectively dead leads
  const rawNeedsAction = quotes.filter(q =>
    (q.stage === "Draft") ||
    (q.stage === "Expired" && q.createdAt >= cutoff60)
  );
  const needsActionQuotes = dedupeByNumber(rawNeedsAction)
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  const needsActionValue = needsActionQuotes.reduce((sum, q) => sum + (q.total || 0), 0);

  log(`Quoter: awaiting=${rawAwaiting.length}→${awaitingQuotes.length} deduped | needs-action raw=${rawNeedsAction.length}→${needsActionQuotes.length} deduped (expired 60d + drafts)`);

  const thisMonth = quotes.filter(q => q.createdAt >= startOfMonth);
  const wonThisMonth = quotes.filter(q => WON.has(q.status) && q.modifiedAt >= startOfMonth);
  const wonThisMonthValue = wonThisMonth.reduce((sum, q) => sum + (q.total || 0), 0);

  const recentQuotes = [...quotes]
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, 20);

  log(`Quoter summary: ${awaitingQuotes.length} awaiting decision, ${needsActionQuotes.length} needs action`);

  return {
    awaitingQuotes,
    awaitingCount: awaitingQuotes.length,
    awaitingValue,
    needsActionQuotes,
    needsActionCount: needsActionQuotes.length,
    needsActionValue,
    wonThisMonth: wonThisMonth.length,
    wonThisMonthValue,
    quotesThisMonth: thisMonth.length,
    recentQuotes,
  };
}
