import crypto from "crypto";
import type { Organization, DeviceHealthSummary, DeviceInfo } from "@shared/schema";
import { log } from "../index";

function cleanEnv(key: string, fallback?: string): string {
  return (process.env[key] || fallback || "").replace(/\\n/g, "").trim();
}

const INSTANCE = cleanEnv("NINJAONE_INSTANCE", "app");
const CLIENT_ID = cleanEnv("NINJAONE_CLIENT_ID");
const CLIENT_SECRET = cleanEnv("NINJAONE_CLIENT_SECRET");
const LEGACY_KEY_ID = cleanEnv("NINJAONE_LEGACY_KEY_ID");
const LEGACY_SECRET = cleanEnv("NINJAONE_LEGACY_SECRET");

const useOAuth = !!(CLIENT_ID && CLIENT_SECRET);
const useLegacy = !!(LEGACY_KEY_ID && LEGACY_SECRET);

const BASE_HOST = `${INSTANCE}.ninjarmm.com`;
const BASE_URL = `https://${BASE_HOST}`;

let accessToken: string | null = null;
let tokenExpiry = 0;

export function isConfigured(): boolean {
  return useOAuth || useLegacy;
}

function generateLegacyAuth(method: string, resourcePath: string): Record<string, string> {
  const date = new Date().toUTCString();
  const stringToSign = [method.toUpperCase(), "", "", date, resourcePath].join("\n");
  const encodedRequest = Buffer.from(stringToSign).toString("base64");
  const signature = crypto
    .createHmac("sha1", LEGACY_SECRET)
    .update(encodedRequest)
    .digest("base64");

  log(`NinjaOne legacy sign: resource=${resourcePath}`);

  return {
    "Authorization": `NJ ${LEGACY_KEY_ID}:${signature}`,
    "x-nj-date": date,
  };
}

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const tokenUrl = `${BASE_URL}/ws/oauth/token`;
  log(`NinjaOne OAuth auth attempt: ${tokenUrl}`);

  try {
    const res = await fetch(tokenUrl, {
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
  } catch (err: any) {
    log(`NinjaOne token error: ${err.message} (cause: ${err.cause || "none"})`);
    throw err;
  }
}

async function apiGet(v2Path: string): Promise<any> {
  if (useLegacy) {
    const resourcePath = v2Path.split("?")[0];
    const url = `${BASE_URL}${v2Path}`;
    const headers = generateLegacyAuth("GET", resourcePath);
    log(`NinjaOne legacy request: ${url}`);

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NinjaOne API error: ${res.status} ${text}`);
    }
    return res.json();
  } else {
    const token = await getToken();
    const url = `${BASE_URL}/api${v2Path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NinjaOne API error: ${res.status} ${text}`);
    }
    return res.json();
  }
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
  let devices: any[];

  devices = await apiGet(`/v2/organization/${orgId}/devices`);

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
    const role = (d.role || d.nodeClass || "").toUpperCase();
    const isServer = role.includes("SERVER");
    if (isServer) servers++;
    else workstations++;

    const osName = d.os?.name || d.system?.os?.name || "";
    const systemName = d.systemName || d.system_name || d.display_name || d.dnsName || d.dns_name || `Device ${d.id}`;

    const isEol = EOL_OS_PATTERNS.some((p) =>
      osName.toLowerCase().includes(p)
    );

    let purchaseDate = d.system?.purchaseDate || d.purchaseDate;
    let age: number | undefined;
    let isOld = false;

    if (purchaseDate) {
      const pd = typeof purchaseDate === "number" ? new Date(purchaseDate * 1000) : new Date(purchaseDate);
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
      lastContact: d.lastContact || d.last_online
        ? new Date(d.lastContact ? d.lastContact * 1000 : d.last_online).toISOString()
        : undefined,
      purchaseDate: purchaseDate
        ? (typeof purchaseDate === "number" ? new Date(purchaseDate * 1000) : new Date(purchaseDate)).toISOString()
        : undefined,
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
    const allAlerts = await apiGet(`/v2/alerts?sourceType=CONDITION&status=TRIGGERED`);
    const orgAlerts = (Array.isArray(allAlerts) ? allAlerts : []).filter(
      (a: any) => a.sourceConfigUid || a.deviceId
    ).slice(0, 50);

    criticalAlerts = orgAlerts.slice(0, 10).map((a: any) => ({
      id: a.id || 0,
      message: a.message || a.subject || "Critical alert",
      severity: a.severity || "CRITICAL",
      deviceName: a.device?.systemName || a.device?.display_name || a.deviceName || "Unknown",
      created: a.createTime
        ? new Date(a.createTime * 1000).toISOString()
        : a.timestamp || new Date().toISOString(),
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
