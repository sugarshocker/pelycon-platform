import { log } from "../index";

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/\\n/g, "").trim();
}

const CIPP_BASE_URL = cleanEnv("CIPP_BASE_URL");
const CIPP_CLIENT_ID = cleanEnv("CIPP_CLIENT_ID");
const CIPP_CLIENT_SECRET = cleanEnv("CIPP_CLIENT_SECRET");
const CIPP_TENANT = cleanEnv("CIPP_TENANT") || "pelycon.com";

const TOKEN_URL = `https://login.microsoftonline.com/${CIPP_TENANT}/oauth2/v2.0/token`;
const SCOPE = `api://${CIPP_CLIENT_ID}/.default`;

export function isConfigured(): boolean {
  return !!(CIPP_BASE_URL && CIPP_CLIENT_ID && CIPP_CLIENT_SECRET);
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CIPP_CLIENT_ID,
    client_secret: CIPP_CLIENT_SECRET,
    scope: SCOPE,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CIPP OAuth2 token error: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function cippGet(path: string, timeoutMs = 90_000): Promise<any> {
  const token = await getAccessToken();
  const url = `${CIPP_BASE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CIPP API error: ${res.status} ${text.slice(0, 200)}`);
    }

    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export interface CippTenant {
  id: string;
  defaultDomainName: string;
  displayName: string;
}

export async function getTenants(): Promise<CippTenant[]> {
  if (!isConfigured()) {
    log("CIPP: not configured, skipping tenant list");
    return [];
  }
  try {
    const data = await cippGet("/api/ListTenants");
    const list = Array.isArray(data) ? data : (data?.Results || data?.value || []);
    return list.map((t: any) => ({
      id: t.customerId || t.id || t.TenantId || "",
      defaultDomainName: t.defaultDomainName || t.domain || "",
      displayName: t.displayName || t.TenantName || t.name || "",
    }));
  } catch (e: any) {
    log(`CIPP getTenants error: ${e.message}`);
    return [];
  }
}

export interface CippClientData {
  msBizPremium: boolean | null;
  secureScore: number | null;
  licenseNames: string[];
}

export async function getClientData(tenantDomain: string): Promise<CippClientData> {
  const empty: CippClientData = { msBizPremium: null, secureScore: null, licenseNames: [] };
  if (!isConfigured()) return empty;

  try {
    const [licenseData, scoreData] = await Promise.allSettled([
      cippGet(`/api/ListLicenses?TenantFilter=${encodeURIComponent(tenantDomain)}`),
      cippGet(`/api/ListGraphRequest?Endpoint=security/secureScores&TenantFilter=${encodeURIComponent(tenantDomain)}&top=1`),
    ]);

    let msBizPremium: boolean | null = null;
    let licenseNames: string[] = [];

    if (licenseData.status === "fulfilled") {
      const licenses = Array.isArray(licenseData.value)
        ? licenseData.value
        : (licenseData.value?.Results || []);
      licenseNames = licenses.map((l: any) =>
        l.SkuPartNumber || l.skuPartNumber || l.displayName || ""
      );
      const bpSkus = ["SPB", "O365_BUSINESS_PREMIUM", "SMB_BUSINESS_PREMIUM", "Microsoft_365_Business_Premium", "M365_BUSINESS_PREMIUM"];
      msBizPremium = licenseNames.some((name) =>
        bpSkus.some((sku) => name.toUpperCase().includes(sku.toUpperCase()))
      );
    }

    let secureScore: number | null = null;
    if (scoreData.status === "fulfilled") {
      const scores = Array.isArray(scoreData.value)
        ? scoreData.value
        : (scoreData.value?.Results || scoreData.value?.value || []);
      if (scores.length > 0) {
        const s = scores[0];
        const current = s.currentScore ?? s.CurrentScore ?? null;
        const max = s.maxScore ?? s.MaxScore ?? null;
        if (current !== null && max !== null && max > 0) {
          secureScore = Math.round((current / max) * 100);
        } else if (current !== null) {
          secureScore = Math.round(current);
        }
      }
    }

    return { msBizPremium, secureScore, licenseNames };
  } catch (e: any) {
    log(`CIPP getClientData error for ${tenantDomain}: ${e.message}`);
    return empty;
  }
}
