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

function mapQuote(q: any): QuoterQuote {
  return {
    id: q.id,
    name: q.name || "",
    status: q.status || "pending",
    draft: !!q.draft,
    total: parseDecimal(q.one_time_total_decimal ?? q.monthly_total_decimal ?? q.annual_total_decimal),
    oneTimeTotal: parseDecimal(q.one_time_total_decimal),
    monthlyTotal: parseDecimal(q.monthly_total_decimal),
    annualTotal: parseDecimal(q.annual_total_decimal),
    organization: q.billing_organization || "",
    contactId: q.contact_id || "",
    createdAt: q.created_at || "",
    modifiedAt: q.modified_at || "",
    expiredAt: q.expired_at || null,
    emailStatus: q.email_status || null,
    connectwiseOpportunityId: q.connectwise_opportunity_id || null,
    number: q.number || "",
  };
}

export interface QuoterSummary {
  activeQuotes: QuoterQuote[];
  activeCount: number;
  activeValue: number;
  olderActiveCount: number;
  quotesThisMonth: number;
  wonThisMonth: number;
  wonThisMonthValue: number;
  recentQuotes: QuoterQuote[];
}

export async function getQuotesSummary(): Promise<QuoterSummary> {
  if (!isConfigured()) {
    throw new Error("Quoter not configured");
  }

  const allQuotes = await fetchAllPages("/quotes");
  const quotes = allQuotes.map(mapQuote);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const cutoff = twelveMonthsAgo.toISOString();

  const allActive = quotes.filter(q => !q.draft && q.status === "pending");
  const active = allActive.filter(q => q.createdAt >= cutoff);
  const olderActiveCount = allActive.length - active.length;
  const activeValue = active.reduce((sum, q) => sum + (q.total || 0), 0);

  const thisMonth = quotes.filter(q => q.createdAt >= startOfMonth);
  const wonThisMonth = quotes.filter(q => q.status === "accepted" && q.modifiedAt >= startOfMonth);
  const wonThisMonthValue = wonThisMonth.reduce((sum, q) => sum + (q.total || 0), 0);

  const recentQuotes = [...quotes]
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, 20);

  return {
    activeQuotes: active,
    activeCount: active.length,
    activeValue,
    olderActiveCount,
    quotesThisMonth: thisMonth.length,
    wonThisMonth: wonThisMonth.length,
    wonThisMonthValue,
    recentQuotes,
  };
}
