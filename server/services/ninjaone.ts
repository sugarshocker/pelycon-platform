import type { Organization, DeviceHealthSummary, DeviceInfo } from "@shared/schema";
import { log } from "../index";

const INSTANCE = process.env.NINJAONE_INSTANCE || "app";
const BASE_URL = `https://${INSTANCE}.ninjarmm.com`;
const CLIENT_ID = process.env.NINJAONE_CLIENT_ID;
const CLIENT_SECRET = process.env.NINJAONE_CLIENT_SECRET;

let accessToken: string | null = null;
let tokenExpiry = 0;

export function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const res = await fetch(`${BASE_URL}/ws/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      scope: "monitoring management",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NinjaOne auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken!;
}

async function apiGet(path: string): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NinjaOne API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getOrganizations(): Promise<Organization[]> {
  const orgs = await apiGet("/v2/organizations");
  return orgs.map((o: any) => ({
    id: o.id,
    name: o.name,
    description: o.description || "",
  }));
}

export async function getDeviceHealth(orgId: number): Promise<DeviceHealthSummary> {
  const devices = await apiGet(`/v2/organization/${orgId}/devices?df=class in (WINDOWS_WORKSTATION, WINDOWS_SERVER, MAC, LINUX_WORKSTATION, LINUX_SERVER)`);

  const now = new Date();
  const fourYearsAgo = new Date(now);
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

  let workstations = 0;
  let servers = 0;
  const oldDevices: DeviceInfo[] = [];
  const eolOsDevices: DeviceInfo[] = [];
  let patchedCount = 0;
  let totalPatchable = 0;

  const EOL_OS_PATTERNS = [
    "windows 10",
    "windows 8",
    "windows 7",
    "windows xp",
    "windows vista",
    "windows server 2012",
    "windows server 2008",
  ];

  for (const d of devices) {
    const deviceClass = (d.nodeClass || "").toUpperCase();
    const isServer = deviceClass.includes("SERVER");
    if (isServer) servers++;
    else workstations++;

    const osName = d.os?.name || d.system?.os?.name || "";
    const systemName = d.systemName || d.dnsName || `Device ${d.id}`;

    const isEol = EOL_OS_PATTERNS.some((p) =>
      osName.toLowerCase().includes(p)
    );

    let purchaseDate = d.system?.purchaseDate || d.purchaseDate;
    let age: number | undefined;
    let isOld = false;

    if (purchaseDate) {
      const pd = new Date(purchaseDate * 1000);
      age = Math.floor(
        (now.getTime() - pd.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      isOld = pd < fourYearsAgo;
    }

    const deviceInfo: DeviceInfo = {
      id: d.id,
      systemName,
      deviceType: isServer ? "Server" : "Workstation",
      osName,
      lastContact: d.lastContact ? new Date(d.lastContact * 1000).toISOString() : undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate * 1000).toISOString() : undefined,
      age,
      isOld,
      isEolOs: isEol,
    };

    if (isOld) oldDevices.push(deviceInfo);
    if (isEol) eolOsDevices.push(deviceInfo);

    if (d.patches !== undefined) {
      totalPatchable++;
      if (d.patches?.status === "UP_TO_DATE" || d.patchStatus === "UP_TO_DATE") {
        patchedCount++;
      }
    }
  }

  let criticalAlerts: DeviceHealthSummary["criticalAlerts"] = [];
  try {
    const alerts = await apiGet(
      `/v2/alerts?df=org = ${orgId}&severity=CRITICAL&status=TRIGGERED`
    );
    criticalAlerts = (Array.isArray(alerts) ? alerts : []).slice(0, 10).map((a: any) => ({
      id: a.id || 0,
      message: a.message || a.subject || "Critical alert",
      severity: a.severity || "CRITICAL",
      deviceName: a.device?.systemName || a.deviceName || "Unknown",
      created: a.createTime
        ? new Date(a.createTime * 1000).toISOString()
        : new Date().toISOString(),
    }));
  } catch (e) {
    log(`Could not fetch alerts for org ${orgId}: ${e}`);
  }

  const patchCompliancePercent =
    totalPatchable > 0
      ? Math.round((patchedCount / totalPatchable) * 100)
      : 100;

  return {
    totalDevices: devices.length,
    workstations,
    servers,
    oldDevices,
    eolOsDevices,
    patchCompliancePercent,
    criticalAlerts,
  };
}
