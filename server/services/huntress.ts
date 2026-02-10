import type { SecuritySummary } from "@shared/schema";
import { log } from "../index";

const API_KEY = process.env.HUNTRESS_API_KEY;
const API_SECRET = process.env.HUNTRESS_API_SECRET;
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

export async function findOrgByName(name: string): Promise<number | null> {
  try {
    const orgs = await getOrganizations();
    const match = orgs.find(
      (o) => o.name.toLowerCase() === name.toLowerCase()
    );
    if (match) return match.id;

    const partial = orgs.find((o) =>
      o.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(o.name.toLowerCase())
    );
    return partial?.id || null;
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
    throw new Error(`Organization "${orgName}" not found in Huntress`);
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
