import type { SecuritySummary, IncidentDetail, SatCampaignDetail } from "@shared/schema";
import { log } from "../index";

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/\\n/g, "").trim();
}

const API_KEY = cleanEnv("HUNTRESS_API_KEY");
const API_SECRET = cleanEnv("HUNTRESS_API_SECRET");
const SAT_CLIENT_ID = cleanEnv("HUNTRESS_SAT_API_KEY");
const SAT_CLIENT_SECRET = cleanEnv("HUNTRESS_SAT_API_SECRET");
const BASE_URL = "https://api.huntress.io/v1";
const SAT_BASE_URL = "https://mycurricula.com/api/v1";

export function isConfigured(): boolean {
  return !!(API_KEY && API_SECRET);
}

export function isSatConfigured(): boolean {
  return !!(SAT_CLIENT_ID && SAT_CLIENT_SECRET);
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

let satAccessToken: string | null = null;
let satTokenExpiry = 0;

async function getSatToken(): Promise<string | null> {
  if (!SAT_CLIENT_ID || !SAT_CLIENT_SECRET) return null;
  if (satAccessToken && Date.now() < satTokenExpiry) return satAccessToken;

  try {
    const res = await fetch(`https://mycurricula.com/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: SAT_CLIENT_ID,
        client_secret: SAT_CLIENT_SECRET,
        scope: "account:read learners:read assignments:read assignments:learner-activity phishing-campaigns:read phishing-scenarios:read",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      log(`Huntress SAT OAuth token error: ${res.status} ${text}`);
      return null;
    }

    const data = await res.json();
    satAccessToken = data.access_token;
    satTokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    const grantedScopes = data.scope || "none listed";
    log(`Huntress SAT: OAuth token obtained, expires in ${data.expires_in || 3600}s, scopes: ${grantedScopes}`);
    return satAccessToken;
  } catch (e: any) {
    log(`Huntress SAT OAuth error: ${e.message}`);
    return null;
  }
}

async function satApiGet(path: string): Promise<any | null> {
  const token = await getSatToken();
  if (!token) return null;

  try {
    const url = path.startsWith("http") ? path : `${SAT_BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404 || res.status === 403) {
        log(`Huntress SAT endpoint not available: ${path} (${res.status})`);
        return null;
      }
      log(`Huntress SAT API error: ${res.status} ${text.slice(0, 200)}`);
      return null;
    }

    return res.json();
  } catch (e: any) {
    log(`Huntress SAT API request error: ${e.message}`);
    return null;
  }
}

let cachedOrgs: Array<{ id: number; name: string }> | null = null;
let cacheExpiry = 0;

let satAccountsCache: any[] | null = null;
let satAccountsCacheExpiry = 0;

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

export interface OrgStackFlags {
  hasEdr: boolean;       // true if org has active Huntress EDR agents installed
  hasItdr: boolean;      // true if org has identities monitored (ITDR product active)
  hasSat: boolean;       // true if org has SAT learners enrolled
  hasSiem: boolean;
  agentCount: number;
  identityCount: number;
  satLearnerCount: number;
}

const orgDetailCache = new Map<number, { flags: OrgStackFlags; expires: number }>();

export async function getOrgStackFlags(orgId: number): Promise<OrgStackFlags> {
  const cached = orgDetailCache.get(orgId);
  if (cached && Date.now() < cached.expires) return cached.flags;

  try {
    const orgDetail = await apiGet(`/organizations/${orgId}`);
    const org = orgDetail.organization || orgDetail || {};

    // EDR: must have active agents installed — not just existing as an org
    const agentCount = org.agents_count ?? 0;
    const hasEdr = agentCount > 0;

    // SAT: learner count from org detail
    const satLearners = org.sat_learner_count ?? 0;
    const hasSat = satLearners > 0;

    // SIEM — detected via logs_sources_count (Huntress log sources = SIEM product active)
    // Fallback fields checked for forward-compatibility
    const logsSourcesCount = org.logs_sources_count ?? 0;
    let hasSiem = !!(
      logsSourcesCount > 0 ||
      org.siem_agent_count > 0 ||
      org.siem_enabled === true ||
      org.has_siem === true ||
      org.siem_event_count > 0 ||
      org.managed_siem === true ||
      org.mdr_enabled === true
    );
    log(`Huntress org ${orgId}: logs_sources_count=${logsSourcesCount}, hasSiem=${hasSiem}`);

    // ITDR: call the identities endpoint — presence of any identity = ITDR is active
    // Huntress ITDR requires an active identity monitoring subscription
    let identityCount = 0;
    let hasItdr = false;
    try {
      // First try org-level field (fast, no extra call if available)
      const m365Users = org.microsoft_365_users_count ?? org.billable_identity_count ?? null;
      if (m365Users !== null) {
        identityCount = m365Users;
        hasItdr = m365Users > 0;
        log(`Huntress ITDR org ${orgId}: using org field microsoft_365_users_count=${m365Users}`);
      } else {
        // Fall back to identities endpoint — page=1 limit=1 just to check presence
        const identData = await apiGetSafe(`/identities?organization_id=${orgId}&page=1&limit=1`);
        if (identData) {
          const identities = identData.identities || identData.data || [];
          const total = identData.pagination?.total ?? identities.length;
          identityCount = total;
          hasItdr = total > 0;
          log(`Huntress ITDR org ${orgId}: /identities returned total=${total}`);
        }
      }
    } catch (ie: any) {
      log(`Huntress ITDR check error org ${orgId}: ${ie.message}`);
    }

    const flags: OrgStackFlags = {
      hasEdr,
      hasItdr,
      hasSat,
      hasSiem,
      agentCount,
      identityCount,
      satLearnerCount: satLearners,
    };
    log(`Huntress org ${orgId} stack flags: EDR=${hasEdr}(${agentCount} agents), ITDR=${hasItdr}(${identityCount} identities), SAT=${hasSat}(${satLearners} learners), SIEM=${hasSiem}`);
    orgDetailCache.set(orgId, { flags, expires: Date.now() + 10 * 60 * 1000 });
    return flags;
  } catch (e: any) {
    log(`Huntress getOrgStackFlags error for org ${orgId}: ${e.message}`);
    return { hasEdr: false, hasItdr: false, hasSat: false, hasSiem: false, agentCount: 0, identityCount: 0, satLearnerCount: 0 };
  }
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
  satUnenrolledUsers: [] as Array<{ name: string; email: string }>,
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

async function fetchSatCurriculaData(orgName: string): Promise<typeof emptySatFields> {
  const result = { ...emptySatFields, recentPhishingCampaigns: [] as SatCampaignDetail[] };

  if (!SAT_CLIENT_ID || !SAT_CLIENT_SECRET) {
    log("Huntress SAT: No Curricula API credentials configured, skipping SAT data fetch");
    return result;
  }

  log("Huntress SAT: Fetching data from Curricula API (mycurricula.com)");

  if (!satAccountsCache || Date.now() > satAccountsCacheExpiry) {
    const accountsData = await satApiGet("/accounts?page[size]=1000&sort=name");
    if (!accountsData) {
      log("Huntress SAT: Could not fetch accounts from Curricula API");
      return result;
    }
    satAccountsCache = accountsData.data || [];
    satAccountsCacheExpiry = Date.now() + 10 * 60 * 1000;
  }

  const accountsList = Array.isArray(satAccountsCache) ? satAccountsCache : [];
  log(`Huntress SAT: ${accountsList.length} accounts in Curricula`);

  const normTarget = normalize(orgName);
  let satAccount: any = null;
  for (const a of accountsList) {
    const aName = a.attributes?.name || "";
    if (aName.toLowerCase() === orgName.toLowerCase()) { satAccount = a; break; }
    if (normalize(aName) === normTarget) { satAccount = a; break; }
  }
  if (!satAccount) {
    for (const a of accountsList) {
      const aName = a.attributes?.name || "";
      const normAcc = normalize(aName);
      if (normAcc.includes(normTarget) || normTarget.includes(normAcc)) { satAccount = a; break; }
    }
  }
  if (!satAccount) {
    const firstWord = normTarget.slice(0, Math.max(4, normTarget.length));
    for (const a of accountsList) {
      const aName = a.attributes?.name || "";
      if (normalize(aName).startsWith(firstWord.slice(0, 4))) { satAccount = a; break; }
    }
  }

  if (!satAccount) {
    log(`Huntress SAT: Org "${orgName}" not found in Curricula accounts (${accountsList.length} accounts: ${accountsList.slice(0, 10).map((a: any) => a.attributes?.name).join(", ")}...)`);
    return result;
  }

  const satAccountId = satAccount.id;
  const satAccountName = satAccount.attributes?.name || orgName;
  log(`Huntress SAT: Matched "${orgName}" to Curricula account "${satAccountName}" (ID: ${satAccountId})`);

  const learnersData = await satApiGet(`/accounts/${satAccountId}/learners?page[size]=500`);
  if (learnersData) {
    const learners = learnersData.data || [];
    const learnersList = Array.isArray(learners) ? learners : [];
    log(`Huntress SAT: ${learnersList.length} learners for "${satAccountName}"`);

    if (learnersList.length > 0) {
      const activeLearners = learnersList.filter((l: any) => (l.attributes?.status || "").toLowerCase() !== "inactive");
      const inactiveLearners = learnersList.filter((l: any) => (l.attributes?.status || "").toLowerCase() === "inactive");
      result.satLearnerCount = activeLearners.length || learnersList.length;
      result.satTotalUsers = learnersList.length;

      if (inactiveLearners.length > 0) {
        result.satUnenrolledUsers = inactiveLearners.map((l: any) => {
          const a = l.attributes || {};
          const firstName = a.firstName || a.first_name || "";
          const lastName = a.lastName || a.last_name || "";
          return {
            name: `${firstName} ${lastName}`.trim() || a.email || "Unknown",
            email: a.email || "",
          };
        });
        log(`Huntress SAT: ${inactiveLearners.length} inactive learners: ${result.satUnenrolledUsers.map(u => u.name).join(", ")}`);
      }

      let completedModules = 0;
      let assignedModules = 0;
      for (const l of learnersList) {
        const attrs = l.attributes || l;
        completedModules += attrs.completed_assignments_count || attrs.modules_completed || 0;
        assignedModules += attrs.total_assignments_count || attrs.modules_assigned || 0;
      }
      if (assignedModules > 0) {
        result.satModulesCompleted = completedModules;
        result.satModulesAssigned = assignedModules;
        result.satCompletionPercent = Math.round((completedModules / assignedModules) * 100);
      }
      log(`Huntress SAT: learner modules ${completedModules}/${assignedModules} completed`);
    }
  }

  const campaignsData = await satApiGet(`/accounts/${satAccountId}/phishing-campaigns?page[size]=100`);
  if (campaignsData) {
    const campaigns = campaignsData.data || [];
    const campaignsList = Array.isArray(campaigns) ? campaigns : [];
    log(`Huntress SAT: ${campaignsList.length} phishing campaigns for "${satAccountName}"`);

    let totalSent = 0, totalClicked = 0, totalCompromised = 0, totalReported = 0;

    for (const c of campaignsList) {
      const attrs = c.attributes || c;
      const stats = attrs.attemptStats || {};
      const name = attrs.title || attrs.name || `Campaign`;
      const sent = stats.sent ?? stats.totalRecipients ?? 0;
      const clicked = stats.uniqueClicks ?? stats.totalClicks ?? 0;
      const compromised = stats.compromised ?? 0;
      const reported = stats.reported ?? 0;

      totalSent += sent;
      totalClicked += clicked;
      totalCompromised += compromised;
      totalReported += reported;

      result.recentPhishingCampaigns.push({
        name,
        sentCount: sent,
        clickCount: clicked,
        compromiseCount: compromised,
        reportCount: reported,
        clickRate: sent > 0 ? Math.round((clicked / sent) * 10000) / 100 : 0,
        compromiseRate: sent > 0 ? Math.round((compromised / sent) * 10000) / 100 : 0,
        reportRate: sent > 0 ? Math.round((reported / sent) * 10000) / 100 : 0,
        launchedAt: attrs.firstSentAt || attrs.campaignStartsAt || attrs.createdAt || new Date().toISOString(),
      });
    }

    result.recentPhishingCampaigns.sort((a, b) =>
      new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime()
    );
    result.recentPhishingCampaigns = result.recentPhishingCampaigns.slice(0, 10);
    result.phishingCampaignCount = campaignsList.length;

    if (totalSent > 0) {
      result.phishingClickRate = Math.round((totalClicked / totalSent) * 10000) / 100;
      result.phishingCompromiseRate = Math.round((totalCompromised / totalSent) * 10000) / 100;
      result.phishingReportRate = Math.round((totalReported / totalSent) * 10000) / 100;
    }

    log(`Huntress SAT: phishing totals: sent=${totalSent}, clicked=${totalClicked}, click rate=${result.phishingClickRate}%`);
  }

  const assignmentsData = await satApiGet(`/accounts/${satAccountId}/assignments?page[size]=500`);
  if (assignmentsData) {
    const assignments = assignmentsData.data || [];
    const assignmentsList = Array.isArray(assignments) ? assignments : [];
    log(`Huntress SAT: ${assignmentsList.length} assignments for "${satAccountName}"`);

    if (assignmentsList.length > 0 && result.satModulesAssigned === null) {
      let completed = 0, total = 0;
      for (const a of assignmentsList) {
        const attrs = a.attributes || a;
        total++;
        const status = (attrs.status || "").toLowerCase();
        if (status === "completed" || status === "finished" || status === "complete") completed++;
      }
      result.satModulesAssigned = total;
      result.satModulesCompleted = completed;
      if (total > 0) {
        result.satCompletionPercent = Math.round((completed / total) * 100);
      }
      log(`Huntress SAT: ${completed}/${total} assignments completed`);
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
      unprotectedAgents: [],
      ...emptySatFields,
      identitiesMonitored: null,
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
  const unprotectedAgents: Array<{ hostname: string; defenderStatus: string }> = [];
  let satLearnerCount: number | null = null;
  let satTotalUsers: number | null = null;
  let satCoveragePercent: number | null = null;
  let identitiesMonitored: number | null = null;

  try {
    const orgDetail = await apiGet(`/organizations/${huntressOrgId}`);
    const org = orgDetail.organization || {};
    activeAgents = org.agents_count || 0;

    const m365Users = org.microsoft_365_users_count || org.billable_identity_count || 0;
    if (m365Users > 0) {
      identitiesMonitored = m365Users;
    }

    if (typeof org.sat_learner_count === "number") {
      satLearnerCount = org.sat_learner_count;
      satTotalUsers = m365Users > 0 ? m365Users : null;
      if (satTotalUsers && satTotalUsers > 0 && satLearnerCount !== null) {
        satCoveragePercent = Math.round((satLearnerCount / satTotalUsers) * 100);
      }
      log(`Huntress SAT: ${satLearnerCount} learners, ${satTotalUsers ?? "unknown"} total users, ${satCoveragePercent ?? "N/A"}% coverage`);
    }

    log(`Huntress org detail: agents_count=${activeAgents}, identities_monitored=${identitiesMonitored}`);
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
          unprotectedAgents.push({
            hostname: a.hostname || a.name || `Agent ${a.id}`,
            defenderStatus: a.defender_status || "Unknown",
          });
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
    satReportData = await fetchSatCurriculaData(orgName);
  } catch (e) {
    log(`Huntress SAT Curricula fetch error: ${e}`);
  }

  if (satReportData.satLearnerCount === null) satReportData.satLearnerCount = satLearnerCount;
  if (satReportData.satTotalUsers === null) satReportData.satTotalUsers = satTotalUsers;
  if (satReportData.satCoveragePercent === null) satReportData.satCoveragePercent = satCoveragePercent;

  return {
    totalIncidents,
    resolvedIncidents,
    pendingIncidents,
    recentIncidents: recentIncidents.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
    activeAgents,
    managedAntivirusCount,
    antivirusNotProtectedCount,
    unprotectedAgents,
    ...satReportData,
    identitiesMonitored,
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
