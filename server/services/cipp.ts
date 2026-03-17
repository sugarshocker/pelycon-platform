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

// Known SKU part numbers for Microsoft 365 Business Premium
const BP_SKUS = ["SPB", "O365_BUSINESS_PREMIUM", "SMB_BUSINESS_PREMIUM", "Microsoft_365_Business_Premium", "M365_BUSINESS_PREMIUM", "MICROSOFT_BUSINESS_CENTER"];
// Microsoft 365 Business Premium SKU GUID (stable across tenants)
const BP_SKU_ID = "cbdc14ab-d96c-4c30-b9f4-6ada7cdc1d46";

function isBizPremiumLicense(l: any): boolean {
  const skuPartNumber = (l.SkuPartNumber || l.skuPartNumber || "").toUpperCase();
  const skuId = (l.SkuId || l.skuId || l.id || "").toLowerCase();
  const displayName = (l.LicenseName || l.licenseName || l.displayName || l.DisplayName || "").toLowerCase();
  const hasConsumed = (l.ConsumedUnits ?? l.consumedUnits ?? 1) > 0;
  if (!hasConsumed) return false;
  if (skuId === BP_SKU_ID) return true;
  if (BP_SKUS.some(sku => skuPartNumber.includes(sku.toUpperCase()))) return true;
  if (displayName.includes("business premium")) return true;
  return false;
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
        : (licenseData.value?.Results || licenseData.value?.value || []);

      // Collect all readable names for debugging/display
      licenseNames = licenses.map((l: any) =>
        l.LicenseName || l.licenseName || l.DisplayName || l.displayName || l.SkuPartNumber || l.skuPartNumber || l.skuId || ""
      ).filter(Boolean);

      log(`CIPP [${tenantDomain}] licenses (${licenses.length}): ${licenseNames.slice(0, 5).join(", ")}${licenseNames.length > 5 ? "…" : ""}`);

      msBizPremium = licenses.some(isBizPremiumLicense);

      // If still not found, also try the subscribedSkus endpoint directly (Graph via CIPP)
      if (!msBizPremium && licenses.length === 0) {
        try {
          const skuData = await cippGet(`/api/ListGraphRequest?Endpoint=subscribedSkus&TenantFilter=${encodeURIComponent(tenantDomain)}&ReverseTenantLookup=false`);
          const skus = Array.isArray(skuData) ? skuData : (skuData?.Results || skuData?.value || []);
          msBizPremium = skus.some(isBizPremiumLicense);
          if (skus.length > 0) {
            const skuNames = skus.map((s: any) => s.skuPartNumber || s.SkuPartNumber || s.displayName || "?");
            log(`CIPP [${tenantDomain}] subscribedSkus fallback (${skus.length}): ${skuNames.slice(0, 5).join(", ")}`);
          }
        } catch (e2: any) {
          log(`CIPP [${tenantDomain}] subscribedSkus fallback error: ${e2.message}`);
        }
      }
    }

    log(`CIPP [${tenantDomain}] msBizPremium=${msBizPremium}`);

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
