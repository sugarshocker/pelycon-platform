import { log } from "../index";

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/\\n/g, "").trim();
}

const CIPP_BASE_URL = cleanEnv("CIPP_BASE_URL");
const CIPP_API_KEY = cleanEnv("CIPP_API_KEY");

export function isConfigured(): boolean {
  return !!(CIPP_BASE_URL && CIPP_API_KEY);
}

async function cippGet(path: string): Promise<any> {
  const url = `${CIPP_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CIPP_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CIPP API error: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
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

export async function getClientData(tenantId: string): Promise<CippClientData> {
  const empty: CippClientData = { msBizPremium: null, secureScore: null, licenseNames: [] };
  if (!isConfigured()) return empty;

  try {
    const [licenseData, scoreData] = await Promise.allSettled([
      cippGet(`/api/ListLicenses?TenantFilter=${encodeURIComponent(tenantId)}`),
      cippGet(`/api/ListGraphRequest?Endpoint=security/secureScores&TenantFilter=${encodeURIComponent(tenantId)}&top=1`),
    ]);

    let msBizPremium: boolean | null = null;
    let licenseNames: string[] = [];
    if (licenseData.status === "fulfilled") {
      const licenses = Array.isArray(licenseData.value) ? licenseData.value : (licenseData.value?.Results || []);
      licenseNames = licenses.map((l: any) => l.SkuPartNumber || l.skuPartNumber || l.displayName || "");
      const bpSkus = ["SPB", "MCOEV", "O365_BUSINESS_PREMIUM", "SMB_BUSINESS_PREMIUM", "Microsoft_365_Business_Premium"];
      msBizPremium = licenseNames.some(name => bpSkus.some(sku => name.toUpperCase().includes(sku)));
    }

    let secureScore: number | null = null;
    if (scoreData.status === "fulfilled") {
      const scores = Array.isArray(scoreData.value) ? scoreData.value : (scoreData.value?.Results || scoreData.value?.value || []);
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
    log(`CIPP getClientData error for ${tenantId}: ${e.message}`);
    return empty;
  }
}
