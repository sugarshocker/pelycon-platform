import crypto from "crypto";
import type { Organization, DeviceHealthSummary, DeviceInfo, DeviceCategory, DeviceTypeCounts } from "@shared/schema";
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

export async function getDeviceNames(orgId: number): Promise<string[]> {
  const devices = await getDeviceNamesWithLastSeen(orgId);
  return devices.map(d => d.name);
}

export async function getDeviceNamesWithLastSeen(orgId: number): Promise<{ name: string; lastSeen: string | null }[]> {
  const basicDevices = await apiGet(`/v2/organization/${orgId}/devices`);
  const VALID_NODE_CLASSES = new Set(["WINDOWS_WORKSTATION", "WINDOWS_SERVER", "MAC"]);
  return basicDevices
    .filter((d: any) => VALID_NODE_CLASSES.has((d.nodeClass || "").toUpperCase()))
    .map((d: any) => ({
      name: d.dnsName || d.systemName || `Device ${d.id}`,
      lastSeen: d.lastContact ? new Date(d.lastContact * 1000).toISOString() : null,
    }));
}

export async function getDeviceHealth(orgId: number): Promise<DeviceHealthSummary> {
  const basicDevices = await apiGet(`/v2/organization/${orgId}/devices`);

  const VALID_NODE_CLASSES = new Set([
    "WINDOWS_WORKSTATION",
    "WINDOWS_SERVER",
    "MAC",
  ]);

  const eligibleDevices = basicDevices.filter((d: any) => {
    const nc = (d.nodeClass || "").toUpperCase();
    return VALID_NODE_CLASSES.has(nc);
  });

  log(`NinjaOne org ${orgId}: ${basicDevices.length} total devices, ${eligibleDevices.length} eligible (filtered to Windows/Mac endpoints + servers)`);

  const now = new Date();
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const detailedDevices: any[] = [];
  const batchSize = 10;
  for (let i = 0; i < eligibleDevices.length; i += batchSize) {
    const batch = eligibleDevices.slice(i, i + batchSize);
    const details = await Promise.all(
      batch.map(async (bd: any) => {
        try {
          return await apiGet(`/v2/device/${bd.id}`);
        } catch {
          return bd;
        }
      })
    );
    detailedDevices.push(...details);
  }

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let workstations = 0;
  let servers = 0;
  const typeCounts: DeviceTypeCounts = {
    windowsDesktops: 0,
    windowsLaptops: 0,
    macDesktops: 0,
    macLaptops: 0,
    windowsServers: 0,
  };
  const oldDevices: DeviceInfo[] = [];
  const eolOsDevices: DeviceInfo[] = [];
  const staleDevices: DeviceInfo[] = [];

  const EOL_OS_PATTERNS = [
    "windows 10",
    "windows 8",
    "windows 7",
    "windows xp",
    "windows vista",
    "windows server 2012",
    "windows server 2008",
  ];

  function classifyDevice(d: any): DeviceCategory {
    const nc = (d.nodeClass || "").toUpperCase();
    const chassis = (d.system?.chassisType || "").toUpperCase();

    if (nc === "WINDOWS_SERVER") return "Windows Server";
    if (nc === "MAC") {
      return chassis === "LAPTOP" ? "Mac Laptop" : "Mac Desktop";
    }
    return chassis === "LAPTOP" ? "Windows Laptop" : "Windows Desktop";
  }

  for (const d of detailedDevices) {
    const deviceType = classifyDevice(d);

    switch (deviceType) {
      case "Windows Server": servers++; typeCounts.windowsServers++; break;
      case "Windows Desktop": workstations++; typeCounts.windowsDesktops++; break;
      case "Windows Laptop": workstations++; typeCounts.windowsLaptops++; break;
      case "Mac Desktop": workstations++; typeCounts.macDesktops++; break;
      case "Mac Laptop": workstations++; typeCounts.macLaptops++; break;
    }

    const osName = d.os?.name || "";
    const systemName = d.systemName || d.dnsName || `Device ${d.id}`;

    const isEol = EOL_OS_PATTERNS.some((p) =>
      osName.toLowerCase().includes(p)
    );

    const warrantyStart = d.system?.warrantyDate || d.system?.purchaseDate || d.purchaseDate || d.created;
    let age: number | undefined;
    let isOld = false;

    if (warrantyStart) {
      const wd = typeof warrantyStart === "number"
        ? new Date(warrantyStart * 1000)
        : new Date(warrantyStart);
      if (!isNaN(wd.getTime())) {
        age = Math.floor(
          (now.getTime() - wd.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
        isOld = wd < fiveYearsAgo;
      }
    }

    let isStale = false;
    let daysSinceContact: number | undefined;
    if (d.lastContact) {
      const lastContactDate = new Date(d.lastContact * 1000);
      daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (24 * 60 * 60 * 1000));
      isStale = lastContactDate < thirtyDaysAgo;
    }

    const deviceInfo: DeviceInfo = {
      id: d.id,
      systemName,
      deviceType,
      osName,
      lastContact: d.lastContact
        ? new Date(d.lastContact * 1000).toISOString()
        : undefined,
      purchaseDate: warrantyStart
        ? (typeof warrantyStart === "number" ? new Date(warrantyStart * 1000) : new Date(warrantyStart)).toISOString()
        : undefined,
      age,
      isOld,
      isEolOs: isEol,
      isStale,
      daysSinceContact,
    };

    if (isOld) oldDevices.push(deviceInfo);
    if (isEol) eolOsDevices.push(deviceInfo);
    if (isStale) staleDevices.push(deviceInfo);

  }

  const replacementSet = new Set<number>();
  for (const d of oldDevices) replacementSet.add(d.id);
  for (const d of eolOsDevices) replacementSet.add(d.id);
  const needsReplacementCount = replacementSet.size;

  let pendingPatchCount = 0;
  let installedPatchCount = 0;
  let totalApprovedManual = 0;
  let noTimestampCount = 0;
  try {
    const patchData = await apiGet(`/v2/queries/os-patches?df=org = ${orgId}&pageSize=500`);
    const results = patchData.results || [];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const p of results) {
      const status = (p.status || "").toUpperCase();
      if (status === "APPROVED" || status === "MANUAL") {
        totalApprovedManual++;
        const patchTimestamp = p.timestamp || p.kbInstalledTimestamp || p.approvedTimestamp || p.created || null;
        if (!patchTimestamp) {
          noTimestampCount++;
          continue;
        }
        const patchDate = typeof patchTimestamp === "number"
          ? (patchTimestamp > 1e12 ? patchTimestamp : patchTimestamp * 1000)
          : new Date(patchTimestamp).getTime();
        if (isNaN(patchDate)) {
          noTimestampCount++;
          continue;
        }
        if (patchDate <= thirtyDaysAgo) {
          pendingPatchCount++;
        }
      } else if (status === "REJECTED") {
        installedPatchCount++;
      }
    }
    log(`NinjaOne patches for org ${orgId}: approved/manual=${totalApprovedManual}, pending(30d+)=${pendingPatchCount}, skipped(no timestamp)=${noTimestampCount}, rejected=${installedPatchCount}, total=${results.length}`);
  } catch (e) {
    log(`Could not fetch os-patches for org ${orgId}: ${e}`);
  }

  const patchCompliancePercent =
    pendingPatchCount > 0 ? 0 : 100;

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

  return {
    totalDevices: detailedDevices.length,
    workstations,
    servers,
    deviceTypeCounts: typeCounts,
    oldDevices,
    eolOsDevices,
    staleDevices,
    needsReplacementCount,
    patchCompliancePercent,
    pendingPatchCount,
    installedPatchCount,
    criticalAlerts,
  };
}
