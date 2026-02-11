import type { SecuritySummary, IncidentDetail } from "@shared/schema";
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

let cachedOrgs: Array<{ id: number; name: string }> | null = null;
let cacheExpiry = 0;

export async function getOrganizations(): Promise<Array<{ id: number; name: string }>> {
  if (cachedOrgs && Date.now() < cacheExpiry) return cachedOrgs;

  const allOrgs: Array<{ id: number; name: string }> = [];
  let page = 1;
  const maxPages = 20;

  while (page <= maxPages) {
    const data = await apiGet(`/organizations?page=${page}&limit=100`);
    const orgs = data.organizations || [];
    for (const o of orgs) {
      allOrgs.push({ id: o.id, name: o.name });
    }

    if (!data.pagination?.next_page) break;
    page++;
  }

  log(`Huntress: loaded ${allOrgs.length} organizations across ${page} pages`);
  cachedOrgs = allOrgs;
  cacheExpiry = Date.now() + 10 * 60 * 1000;
  return allOrgs;
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
      recentIncidents: [],
      activeAgents: 0,
      managedAntivirusCount: 0,
      antivirusNotProtectedCount: 0,
      satCompletionPercent: null,
      phishingClickRate: null,
      trendDirection: "stable" as const,
      notInHuntress: true,
    };
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  let totalIncidents = 0;
  let resolvedIncidents = 0;
  let pendingIncidents = 0;
  const recentIncidents: IncidentDetail[] = [];

  try {
    let page = 1;
    const allReports: any[] = [];
    while (page <= 10) {
      const data = await apiGet(
        `/incident_reports?organization_id=${huntressOrgId}&page=${page}&limit=100`
      );
      const reports = data.incident_reports || [];
      allReports.push(...reports);
      if (!data.pagination?.next_page) break;
      page++;
    }

    for (const r of allReports) {
      const sentAt = r.sent_at ? new Date(r.sent_at) : null;
      const isRecent = sentAt && sentAt > sixMonthsAgo;

      if (isRecent) {
        totalIncidents++;
        const status = (r.status || "").toLowerCase();
        if (status === "closed" || status === "resolved") {
          resolvedIncidents++;
        } else {
          pendingIncidents++;
        }
        recentIncidents.push({
          id: r.id,
          subject: r.subject || "Incident Report",
          severity: r.severity || "unknown",
          status: r.status || "unknown",
          sentAt: r.sent_at,
          closedAt: r.closed_at || null,
        });
      }
    }

    log(`Huntress: ${allReports.length} total reports, ${totalIncidents} in last 6 months for org ${huntressOrgId}`);
  } catch (e) {
    log(`Huntress incident_reports error: ${e}`);
  }

  let activeAgents = 0;
  let managedAntivirusCount = 0;
  let antivirusNotProtectedCount = 0;

  try {
    const orgDetail = await apiGet(`/organizations/${huntressOrgId}`);
    const org = orgDetail.organization || {};
    activeAgents = org.agents_count || 0;
    log(`Huntress org detail: agents_count=${activeAgents}`);
  } catch (e) {
    log(`Huntress org detail error: ${e}`);
  }

  try {
    let page = 1;
    while (page <= 10) {
      const data = await apiGet(
        `/agents?organization_id=${huntressOrgId}&page=${page}&limit=100`
      );
      const agents = data.agents || [];
      for (const a of agents) {
        const defenderStatus = (a.defender_status || "").toLowerCase();
        if (defenderStatus === "protected") {
          managedAntivirusCount++;
        } else {
          antivirusNotProtectedCount++;
        }
      }
      if (!data.pagination?.next_page) break;
      page++;
    }
    log(`Huntress: managed antivirus=${managedAntivirusCount}, not protected=${antivirusNotProtectedCount}`);
  } catch (e) {
    log(`Huntress agents error: ${e}`);
  }

  return {
    totalIncidents,
    resolvedIncidents,
    pendingIncidents,
    recentIncidents: recentIncidents.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
    activeAgents,
    managedAntivirusCount,
    antivirusNotProtectedCount,
    satCompletionPercent: null,
    phishingClickRate: null,
    trendDirection: totalIncidents === 0 ? "stable" : pendingIncidents > 0 ? "worse" : "better",
  };
}

export async function getAgentHostnames(orgName: string): Promise<string[]> {
  const huntressOrgId = await findOrgByName(orgName);
  if (!huntressOrgId) return [];

  const hostnames: string[] = [];
  let page = 1;
  while (page <= 20) {
    const data = await apiGet(`/agents?organization_id=${huntressOrgId}&page=${page}&limit=100`);
    const agents = data.agents || [];
    for (const a of agents) {
      const name = a.host_name || a.hostname || a.name || "";
      if (name) hostnames.push(name);
    }
    if (!data.pagination?.next_page) break;
    page++;
  }
  log(`Huntress: collected ${hostnames.length} agent hostnames for "${orgName}"`);
  return hostnames;
}
