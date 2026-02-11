import type { SecuritySummary } from "@shared/schema";
import { log } from "../index";

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/\\n/g, "").trim();
}

const API_KEY = cleanEnv("HUNTRESS_API_KEY");
const API_SECRET = cleanEnv("HUNTRESS_API_SECRET");
const BASE_URL = "https://api.huntress.io/v1";

export function isConfigured(): boolean {
  return !!(API_KEY && API_SECRET);
}

function getAuthHeader(): string {
  return "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Huntress API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getOrganizations(): Promise<Array<{ id: number; name: string }>> {
  const data = await apiGet("/organizations?page=1&per_page=100");
  return (data.organizations || []).map((o: any) => ({
    id: o.id,
    name: o.name,
  }));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\[.*?\]\s*/g, "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/,?\s*(llc|inc|pllc|ltd|corp|co|llp|psc)\b\.?/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export async function findOrgByName(name: string): Promise<number | null> {
  try {
    const orgs = await getOrganizations();

    const exactMatch = orgs.find(
      (o) => o.name.toLowerCase() === name.toLowerCase()
    );
    if (exactMatch) return exactMatch.id;

    const normName = normalize(name);
    const normMatch = orgs.find((o) => normalize(o.name) === normName);
    if (normMatch) return normMatch.id;

    const partialMatch = orgs.find((o) => {
      const normOrg = normalize(o.name);
      return normOrg.includes(normName) || normName.includes(normOrg);
    });
    if (partialMatch) return partialMatch.id;

    const firstWord = normName.slice(0, Math.max(4, normName.indexOf(" ") > 0 ? normName.indexOf(" ") : normName.length));
    const fuzzy = orgs.find((o) => normalize(o.name).startsWith(firstWord));
    if (fuzzy) {
      log(`Huntress fuzzy match: "${name}" -> "${fuzzy.name}"`);
      return fuzzy.id;
    }

    log(`Huntress: no match for "${name}" among [${orgs.map(o => o.name).join(", ")}]`);
    return null;
  } catch (e) {
    log(`Huntress findOrgByName error: ${e}`);
    return null;
  }
}

export async function getSecuritySummary(
  orgName: string
): Promise<SecuritySummary> {
  const huntressOrgId = await findOrgByName(orgName);

  if (!huntressOrgId) {
    log(`Huntress: org "${orgName}" not found, returning empty security data`);
    return {
      totalIncidents: 0,
      resolvedIncidents: 0,
      pendingIncidents: 0,
      activeAgents: 0,
      satCompletionPercent: null,
      phishingClickRate: null,
      trendDirection: "stable" as const,
      notInHuntress: true,
    };
  }

  let totalIncidents = 0;
  let resolvedIncidents = 0;
  let pendingIncidents = 0;

  try {
    const reports = await apiGet(
      `/organizations/${huntressOrgId}/reports?page=1&per_page=100`
    );
    const reportsList = reports.reports || [];
    totalIncidents = reportsList.length;

    for (const r of reportsList) {
      const status = (r.status || "").toLowerCase();
      if (status === "closed" || status === "resolved") {
        resolvedIncidents++;
      } else {
        pendingIncidents++;
      }
    }
  } catch (e) {
    log(`Huntress reports error: ${e}`);
  }

  let activeAgents = 0;
  try {
    const agents = await apiGet(
      `/organizations/${huntressOrgId}/agents?page=1&per_page=1`
    );
    activeAgents = agents.pagination?.total_count || agents.total || 0;
  } catch (e) {
    log(`Huntress agents error: ${e}`);
  }

  return {
    totalIncidents,
    resolvedIncidents,
    pendingIncidents,
    activeAgents,
    satCompletionPercent: null,
    phishingClickRate: null,
    trendDirection: totalIncidents === 0 ? "stable" : pendingIncidents > resolvedIncidents ? "worse" : "better",
  };
}
