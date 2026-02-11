import type { SecuritySummary, IncidentDetail, SatCampaignDetail } from "@shared/schema";
import { log } from "../index";

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/\\n/g, "").trim();
}

const API_KEY = cleanEnv("HUNTRESS_API_KEY");
const API_SECRET = cleanEnv("HUNTRESS_API_SECRET");
const SAT_API_KEY = cleanEnv("HUNTRESS_SAT_API_KEY");
const SAT_API_SECRET = cleanEnv("HUNTRESS_SAT_API_SECRET");
const BASE_URL = "https://api.huntress.io/v1";

export function isConfigured(): boolean {
  return !!(API_KEY && API_SECRET);
}

export function isSatConfigured(): boolean {
  return !!(SAT_API_KEY && SAT_API_SECRET);
}

function getAuthHeader(): string {
  return "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
}

function getSatAuthHeader(): string {
  if (SAT_API_KEY && SAT_API_SECRET) {
    return "Basic " + Buffer.from(`${SAT_API_KEY}:${SAT_API_SECRET}`).toString("base64");
  }
  return getAuthHeader();
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

async function apiGetSat(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: getSatAuthHeader() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Huntress SAT API error: ${res.status} ${text}`);
  }

  return res.json();
}

async function apiGetSafe(path: string): Promise<any | null> {
  try {
    return await apiGet(path);
  } catch (e: any) {
    if (e.message?.includes("404") || e.message?.includes("403")) {
      log(`Huntress endpoint not available: ${path}`);
      return null;
    }
    throw e;
  }
}

async function apiGetSatSafe(path: string): Promise<any | null> {
  try {
    return await apiGetSat(path);
  } catch (e: any) {
    if (e.message?.includes("404") || e.message?.includes("403")) {
      log(`Huntress SAT endpoint not available: ${path}`);
      return null;
    }
    throw e;
  }
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

const emptySatFields = {
  satCompletionPercent: null as number | null,
  phishingClickRate: null as number | null,
  satLearnerCount: null as number | null,
  satTotalUsers: null as number | null,
  satCoveragePercent: null as number | null,
  satModulesCompleted: null as number | null,
  satModulesAssigned: null as number | null,
  phishingCampaignCount: null as number | null,
  phishingCompromiseRate: null as number | null,
  phishingReportRate: null as number | null,
  recentPhishingCampaigns: [] as SatCampaignDetail[],
};

function normalizeRate(value: number): number {
  if (value > 1 && value <= 100) return Math.round(value * 100) / 100;
  if (value >= 0 && value <= 1) return Math.round(value * 10000) / 100;
  return Math.round(value * 100) / 100;
}

function parseCampaign(c: any): SatCampaignDetail | null {
  const name = c.name || c.scenario_name || c.title || c.subject || "";
  if (!name) return null;
  const sent = c.sent_count ?? c.recipients_count ?? c.total ?? 0;
  const clicked = c.click_count ?? c.clicks ?? 0;
  const compromised = c.compromise_count ?? c.compromises ?? 0;
  const reported = c.report_count ?? c.reports ?? 0;
  return {
    name,
    sentCount: sent,
    clickCount: clicked,
    compromiseCount: compromised,
    reportCount: reported,
    clickRate: sent > 0 ? Math.round((clicked / sent) * 10000) / 100 : 0,
    compromiseRate: sent > 0 ? Math.round((compromised / sent) * 10000) / 100 : 0,
    reportRate: sent > 0 ? Math.round((reported / sent) * 10000) / 100 : 0,
    launchedAt: c.launched_at || c.sent_at || c.created_at || new Date().toISOString(),
  };
}

async function fetchSatReportData(huntressOrgId: number): Promise<typeof emptySatFields> {
  const result = { ...emptySatFields, recentPhishingCampaigns: [] as SatCampaignDetail[] };

  const reportEndpoints = [
    `/reports?organization_id=${huntressOrgId}`,
    `/reports/sat?organization_id=${huntressOrgId}`,
    `/summary_reports?organization_id=${huntressOrgId}`,
  ];

  const useSatApi = !!(SAT_API_KEY && SAT_API_SECRET);
  log(`Huntress SAT: Using ${useSatApi ? "dedicated SAT API key" : "standard API key"} for report endpoints`);

  for (const endpoint of reportEndpoints) {
    try {
      const data = useSatApi ? await apiGetSatSafe(endpoint) : await apiGetSafe(endpoint);
      if (!data) continue;

      log(`Huntress SAT report response from ${endpoint}: ${JSON.stringify(data).slice(0, 500)}`);

      const reports = data.reports || data.summary_reports || data.sat_reports || [];
      if (Array.isArray(reports)) {
        for (const report of reports) {
          if (report.type === "sat" || report.report_type === "sat" || report.category === "sat") {
            if (typeof report.completion_rate === "number") {
              result.satCompletionPercent = Math.round(normalizeRate(report.completion_rate));
            }
            if (typeof report.modules_completed === "number") {
              result.satModulesCompleted = report.modules_completed;
            }
            if (typeof report.modules_assigned === "number") {
              result.satModulesAssigned = report.modules_assigned;
            }
          }

          if (report.type === "phishing" || report.report_type === "phishing" || report.category === "phishing") {
            if (typeof report.click_rate === "number") {
              result.phishingClickRate = normalizeRate(report.click_rate);
            }
            if (typeof report.compromise_rate === "number") {
              result.phishingCompromiseRate = normalizeRate(report.compromise_rate);
            }
            if (typeof report.report_rate === "number") {
              result.phishingReportRate = normalizeRate(report.report_rate);
            }
            if (typeof report.campaign_count === "number") {
              result.phishingCampaignCount = report.campaign_count;
            }
          }
        }
      }

      const campaigns = data.campaigns || data.phishing_campaigns || [];
      if (Array.isArray(campaigns)) {
        for (const c of campaigns) {
          const parsed = parseCampaign(c);
          if (parsed) result.recentPhishingCampaigns.push(parsed);
        }
        if (result.recentPhishingCampaigns.length > 0) {
          result.recentPhishingCampaigns.sort((a, b) =>
            new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime()
          );
          result.recentPhishingCampaigns = result.recentPhishingCampaigns.slice(0, 10);
          result.phishingCampaignCount = result.phishingCampaignCount ?? result.recentPhishingCampaigns.length;

          if (result.phishingClickRate === null && result.recentPhishingCampaigns.length > 0) {
            const totalSent = result.recentPhishingCampaigns.reduce((s, c) => s + c.sentCount, 0);
            const totalClicked = result.recentPhishingCampaigns.reduce((s, c) => s + c.clickCount, 0);
            const totalCompromised = result.recentPhishingCampaigns.reduce((s, c) => s + c.compromiseCount, 0);
            const totalReported = result.recentPhishingCampaigns.reduce((s, c) => s + c.reportCount, 0);
            if (totalSent > 0) {
              result.phishingClickRate = Math.round((totalClicked / totalSent) * 10000) / 100;
              result.phishingCompromiseRate = Math.round((totalCompromised / totalSent) * 10000) / 100;
              result.phishingReportRate = Math.round((totalReported / totalSent) * 10000) / 100;
            }
          }
        }
      }

      if (data.phishing_click_rate !== undefined && typeof data.phishing_click_rate === "number") {
        result.phishingClickRate = normalizeRate(data.phishing_click_rate);
      }
      if (data.completion_rate !== undefined && typeof data.completion_rate === "number") {
        result.satCompletionPercent = Math.round(normalizeRate(data.completion_rate));
      }
      if (data.compromise_rate !== undefined && typeof data.compromise_rate === "number") {
        result.phishingCompromiseRate = normalizeRate(data.compromise_rate);
      }

      if (result.phishingClickRate !== null || result.satCompletionPercent !== null || result.recentPhishingCampaigns.length > 0) {
        log(`Huntress SAT: Found report data from ${endpoint}`);
        break;
      }
    } catch (e: any) {
      log(`Huntress SAT report endpoint ${endpoint} error: ${e.message}`);
    }
  }

  return result;
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
      ...emptySatFields,
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
  let satLearnerCount: number | null = null;
  let satTotalUsers: number | null = null;
  let satCoveragePercent: number | null = null;

  try {
    const orgDetail = await apiGet(`/organizations/${huntressOrgId}`);
    const org = orgDetail.organization || {};
    activeAgents = org.agents_count || 0;

    if (typeof org.sat_learner_count === "number") {
      satLearnerCount = org.sat_learner_count;
      const m365Users = org.microsoft_365_users_count || org.billable_identity_count || 0;
      satTotalUsers = m365Users > 0 ? m365Users : null;
      if (satTotalUsers && satTotalUsers > 0 && satLearnerCount !== null) {
        satCoveragePercent = Math.round((satLearnerCount / satTotalUsers) * 100);
      }
      log(`Huntress SAT: ${satLearnerCount} learners, ${satTotalUsers ?? "unknown"} total users, ${satCoveragePercent ?? "N/A"}% coverage`);
    }

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

  let satReportData = { ...emptySatFields };
  try {
    satReportData = await fetchSatReportData(huntressOrgId);
  } catch (e) {
    log(`Huntress SAT report fetch error: ${e}`);
  }

  satReportData.satLearnerCount = satLearnerCount;
  satReportData.satTotalUsers = satTotalUsers;
  satReportData.satCoveragePercent = satCoveragePercent;

  return {
    totalIncidents,
    resolvedIncidents,
    pendingIncidents,
    recentIncidents: recentIncidents.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
    activeAgents,
    managedAntivirusCount,
    antivirusNotProtectedCount,
    ...satReportData,
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
