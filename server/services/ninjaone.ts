import crypto from "crypto";
import type { Organization, DeviceHealthSummary, DeviceInfo, DeviceCategory, DeviceTypeCounts, DeviceUserEntry } from "@shared/schema";
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

export async function getDeviceCustomFields(deviceId: number): Promise<any> {
  return apiGet(`/v2/device/${deviceId}/custom-fields`);
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

function estimateAgeFromModel(model: string | undefined, manufacturer: string | undefined): number | null {
  if (!model) return null;
  const m = model.toLowerCase().replace(/\s+/g, " ").trim();
  const mfr = (manufacturer || "").toLowerCase();

  const patterns: Array<{ regex: RegExp; year: number }> = [
    // Dell OptiPlex (desktops) — specific models first, then broad fallback
    { regex: /optiplex\s*(30|50|70)10\b/i, year: 2023 },
    { regex: /optiplex\s*(30|50|70)00\b/i, year: 2022 },
    { regex: /optiplex\s*[357]090/i, year: 2021 },
    { regex: /optiplex\s*[357]080/i, year: 2020 },
    { regex: /optiplex\s*[357]070/i, year: 2019 },
    { regex: /optiplex\s*[357]060/i, year: 2018 },
    { regex: /optiplex\s*[357]050/i, year: 2017 },
    { regex: /optiplex\s*[357]040/i, year: 2016 },
    { regex: /optiplex\s*[3579]0[0-3]\d/i, year: 2013 },
    // Dell Latitude (laptops) — specific ending digits first
    { regex: /latitude\s*5[3-5]50/i, year: 2024 },
    { regex: /latitude\s*5[3-5]40/i, year: 2023 },
    { regex: /latitude\s*5[3-5]30/i, year: 2022 },
    { regex: /latitude\s*[357][3-5]20/i, year: 2021 },
    { regex: /latitude\s*[357][3-5]10/i, year: 2020 },
    { regex: /latitude\s*[57][2-5]90/i, year: 2018 },
    { regex: /latitude\s*[57][2-5]80/i, year: 2017 },
    { regex: /latitude\s*[57][2-5][4-7]0/i, year: 2016 },
    { regex: /latitude\s*e[5-7]\d{3}/i, year: 2013 },
    // Dell Precision (workstations)
    { regex: /precision\s*(3[5-6]80|5[5-6]80|7[5-7]80)/i, year: 2023 },
    { regex: /precision\s*(3[5-6]70|5[5-6]70|7[5-7]70)/i, year: 2022 },
    { regex: /precision\s*(3[5-6]60|5[5-6]60|7[5-7]60)/i, year: 2021 },
    { regex: /precision\s*(3[5-6]50|5[5-6]50|7[5-7]50)/i, year: 2020 },
    { regex: /precision\s*(3[5-6]40|5[5-6]40|7[5-7]40)/i, year: 2019 },
    { regex: /precision\s*(3[5-6]30|5[5-6]30|7[5-7]30)/i, year: 2018 },
    { regex: /precision\s*(3[5-6]\d0|5[5-6]\d0|7[5-7]\d0)/i, year: 2016 },
    // Dell Inspiron desktops (3x4x, 3x6x are desktop towers from ~2013)
    { regex: /inspiron\s*3[6-8]4\d/i, year: 2013 },
    { regex: /inspiron\s*3[6-8]6\d/i, year: 2013 },
    { regex: /inspiron\s*660\b/i, year: 2012 },
    // Dell Inspiron laptops (newer 35xx, 55xx, 75xx naming)
    { regex: /inspiron\s*[357]5[4-5]\d/i, year: 2024 },
    { regex: /inspiron\s*[357]5[2-3]\d/i, year: 2022 },
    { regex: /inspiron\s*[357]5[0-1]\d/i, year: 2020 },
    // Dell PowerEdge servers
    { regex: /poweredge\s*t[1-3]0\b/i, year: 2016 },
    { regex: /poweredge\s*t[1-3]40/i, year: 2018 },
    { regex: /poweredge\s*t[1-5]50/i, year: 2021 },
    { regex: /poweredge\s*r[2-7][1-3]0/i, year: 2017 },
    { regex: /poweredge\s*r[2-7][4-5]0/i, year: 2019 },
    { regex: /poweredge\s*r[2-7][6-7]0/i, year: 2022 },
    // HP EliteDesk / ProDesk (desktops)
    { regex: /elitedesk\s*800\s*g1/i, year: 2013 },
    { regex: /elitedesk\s*800\s*g2/i, year: 2015 },
    { regex: /elitedesk\s*800\s*g3/i, year: 2017 },
    { regex: /elitedesk\s*800\s*g4/i, year: 2018 },
    { regex: /elitedesk\s*800\s*g5/i, year: 2019 },
    { regex: /elitedesk\s*800\s*g6/i, year: 2020 },
    { regex: /elitedesk\s*800\s*g8/i, year: 2021 },
    { regex: /elitedesk\s*800\s*g9/i, year: 2022 },
    { regex: /prodesk\s*400\s*g[1-3]/i, year: 2015 },
    { regex: /prodesk\s*400\s*g[4-5]/i, year: 2018 },
    { regex: /prodesk\s*400\s*g[6-7]/i, year: 2020 },
    { regex: /prodesk\s*600\s*g[1-3]/i, year: 2015 },
    { regex: /prodesk\s*600\s*g[4-5]/i, year: 2018 },
    { regex: /prodesk\s*600\s*g6/i, year: 2020 },
    // HP EliteBook / ProBook (laptops)
    { regex: /elitebook\s*8[0-9]0\s*g1/i, year: 2013 },
    { regex: /elitebook\s*8[0-9]0\s*g2/i, year: 2015 },
    { regex: /elitebook\s*8[0-9]0\s*g3/i, year: 2016 },
    { regex: /elitebook\s*8[0-9]0\s*g4/i, year: 2017 },
    { regex: /elitebook\s*8[0-9]0\s*g5/i, year: 2018 },
    { regex: /elitebook\s*8[0-9]0\s*g6/i, year: 2019 },
    { regex: /elitebook\s*8[0-9]0\s*g7/i, year: 2020 },
    { regex: /elitebook\s*8[0-9]0\s*g8/i, year: 2021 },
    { regex: /elitebook\s*8[0-9]0\s*g9/i, year: 2022 },
    { regex: /elitebook\s*8[0-9]0\s*g10/i, year: 2023 },
    { regex: /probook\s*4[0-9]0\s*g[1-3]/i, year: 2014 },
    { regex: /probook\s*4[0-9]0\s*g[4-5]/i, year: 2017 },
    { regex: /probook\s*4[0-9]0\s*g[6-7]/i, year: 2019 },
    { regex: /probook\s*4[0-9]0\s*g[8-9]/i, year: 2021 },
    { regex: /probook\s*4[0-9]0\s*g10/i, year: 2023 },
    // HP ZBook (workstation laptops)
    { regex: /zbook\s*\d+\s*g[1-3]/i, year: 2015 },
    { regex: /zbook\s*\d+\s*g[4-5]/i, year: 2017 },
    { regex: /zbook\s*\d+\s*g6/i, year: 2019 },
    { regex: /zbook\s*\d+\s*g7/i, year: 2020 },
    { regex: /zbook\s*\d+\s*g8/i, year: 2021 },
    { regex: /zbook\s*\d+\s*g9/i, year: 2022 },
    { regex: /zbook\s*\d+\s*g10/i, year: 2023 },
    // Lenovo ThinkPad
    { regex: /thinkpad\s*t4[0-3]\d/i, year: 2013 },
    { regex: /thinkpad\s*t4[4-5]\d/i, year: 2015 },
    { regex: /thinkpad\s*t460/i, year: 2016 },
    { regex: /thinkpad\s*t470/i, year: 2017 },
    { regex: /thinkpad\s*t480/i, year: 2018 },
    { regex: /thinkpad\s*t490/i, year: 2019 },
    { regex: /thinkpad\s*t14\s*(gen\s*1)?$/i, year: 2020 },
    { regex: /thinkpad\s*t14\s*gen\s*2/i, year: 2021 },
    { regex: /thinkpad\s*t14\s*gen\s*3/i, year: 2022 },
    { regex: /thinkpad\s*t14\s*gen\s*4/i, year: 2023 },
    { regex: /thinkpad\s*t14\s*gen\s*5/i, year: 2024 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?[1-4]/i, year: 2015 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?5/i, year: 2017 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?6/i, year: 2018 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?7/i, year: 2019 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?8/i, year: 2020 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?9/i, year: 2021 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?10/i, year: 2022 },
    { regex: /thinkpad\s*x1\s*carbon\s*(gen\s*)?11/i, year: 2023 },
    // Lenovo ThinkCentre (desktops)
    { regex: /thinkcentre\s*m[79]\d{2}/i, year: 2015 },
    { regex: /thinkcentre\s*m[79]\d0[a-z]/i, year: 2018 },
    { regex: /thinkcentre\s*m[79]0[a-z]/i, year: 2020 },
    // Microsoft Surface
    { regex: /surface\s*pro\s*3/i, year: 2014 },
    { regex: /surface\s*pro\s*4/i, year: 2015 },
    { regex: /surface\s*pro\s*(2017|5)/i, year: 2017 },
    { regex: /surface\s*pro\s*6/i, year: 2018 },
    { regex: /surface\s*pro\s*7/i, year: 2019 },
    { regex: /surface\s*pro\s*8/i, year: 2021 },
    { regex: /surface\s*pro\s*9/i, year: 2022 },
    { regex: /surface\s*pro\s*10/i, year: 2024 },
    { regex: /surface\s*laptop\s*[1-2]/i, year: 2017 },
    { regex: /surface\s*laptop\s*3/i, year: 2019 },
    { regex: /surface\s*laptop\s*4/i, year: 2021 },
    { regex: /surface\s*laptop\s*5/i, year: 2022 },
    { regex: /surface\s*laptop\s*6/i, year: 2024 },
    // Apple MacBook
    { regex: /macbook\s*(pro|air)?\s*\(?201[0-5]/i, year: 2014 },
    { regex: /macbook\s*(pro|air)?\s*\(?2016/i, year: 2016 },
    { regex: /macbook\s*(pro|air)?\s*\(?2017/i, year: 2017 },
    { regex: /macbook\s*(pro|air)?\s*\(?2018/i, year: 2018 },
    { regex: /macbook\s*(pro|air)?\s*\(?2019/i, year: 2019 },
    { regex: /macbook\s*(pro|air)?\s*\(?2020/i, year: 2020 },
    { regex: /macbook\s*(pro|air)?\s*\(?2021/i, year: 2021 },
    { regex: /macbook\s*(pro|air)?\s*\(?2022/i, year: 2022 },
    { regex: /macbook\s*(pro|air)?\s*\(?2023/i, year: 2023 },
    { regex: /macbook\s*(pro|air)?\s*\(?2024/i, year: 2024 },
    // iMac by year
    { regex: /imac\s*\(?201[0-5]/i, year: 2014 },
    { regex: /imac\s*\(?201[6-9]/i, year: 2018 },
    { regex: /imac\s*\(?202[0-1]/i, year: 2021 },
    { regex: /imac\s*\(?202[2-4]/i, year: 2023 },
  ];

  for (const p of patterns) {
    if (p.regex.test(m) || p.regex.test(model)) {
      const currentYear = new Date().getFullYear();
      return currentYear - p.year;
    }
  }

  return null;
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

    const manufacturer = d.system?.manufacturer || undefined;
    const model = d.system?.model || undefined;
    const cleanManufacturer = manufacturer !== "To Be Filled By O.E.M." ? manufacturer : undefined;
    const cleanModel = model !== "To Be Filled By O.E.M." ? model : undefined;

    const warrantyDate = d.system?.warrantyDate || d.system?.purchaseDate || d.purchaseDate;
    const createdOnly = !warrantyDate && d.created;
    const warrantyStart = warrantyDate || d.created;
    let age: number | undefined;
    let isOld = false;
    let ageSource: "warranty" | "purchase" | "model" | "created" | undefined;

    const modelEstimatedAge = estimateAgeFromModel(cleanModel, cleanManufacturer);

    if (warrantyDate) {
      const wd = typeof warrantyDate === "number"
        ? new Date(warrantyDate * 1000)
        : new Date(warrantyDate);
      if (!isNaN(wd.getTime())) {
        age = Math.floor(
          (now.getTime() - wd.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
        isOld = wd < fiveYearsAgo;
        ageSource = d.system?.warrantyDate ? "warranty" : "purchase";
      }
    }

    if (modelEstimatedAge !== null) {
      if (age === undefined || createdOnly) {
        age = modelEstimatedAge;
        isOld = modelEstimatedAge >= 5;
        ageSource = "model";
      } else if (modelEstimatedAge > age) {
        age = modelEstimatedAge;
        isOld = modelEstimatedAge >= 5;
        ageSource = "model";
      }
    }

    if (age === undefined && warrantyStart) {
      const wd = typeof warrantyStart === "number"
        ? new Date(warrantyStart * 1000)
        : new Date(warrantyStart);
      if (!isNaN(wd.getTime())) {
        age = Math.floor(
          (now.getTime() - wd.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
        isOld = wd < fiveYearsAgo;
        ageSource = "created";
      }
    }

    let isStale = false;
    let daysSinceContact: number | undefined;
    if (d.lastContact) {
      const lastContactDate = new Date(d.lastContact * 1000);
      daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (24 * 60 * 60 * 1000));
      isStale = lastContactDate < thirtyDaysAgo;
    }

    const createdDate = d.created
      ? new Date(typeof d.created === "number" ? d.created * 1000 : d.created).toISOString()
      : undefined;

    if (ageSource === "model" && cleanModel) {
      log(`NinjaOne device ${systemName}: age estimated at ~${age}yr from model "${cleanModel}"`);
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
      ageSource,
      isOld,
      isEolOs: isEol,
      isStale,
      daysSinceContact,
      manufacturer: cleanManufacturer,
      model: cleanModel,
      createdDate,
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
  let totalPatchesConsidered = 0;
  try {
    const patchData = await apiGet(`/v2/queries/os-patches?df=org = ${orgId}&pageSize=500`);
    const results = patchData.results || [];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const p of results) {
      const status = (p.status || "").toUpperCase();
      if (status === "APPROVED" || status === "MANUAL") {
        totalApprovedManual++;
        totalPatchesConsidered++;
        const patchTimestamp = p.timestamp || p.kbInstalledTimestamp || p.approvedTimestamp || p.created || null;
        if (!patchTimestamp) {
          noTimestampCount++;
          pendingPatchCount++;
          continue;
        }
        const patchDate = typeof patchTimestamp === "number"
          ? (patchTimestamp > 1e12 ? patchTimestamp : patchTimestamp * 1000)
          : new Date(patchTimestamp).getTime();
        if (isNaN(patchDate)) {
          noTimestampCount++;
          pendingPatchCount++;
          continue;
        }
        if (patchDate <= thirtyDaysAgo) {
          pendingPatchCount++;
        }
      } else if (status === "INSTALLED" || status === "REJECTED") {
        installedPatchCount++;
        totalPatchesConsidered++;
      }
    }
    log(`NinjaOne patches for org ${orgId}: approved/manual=${totalApprovedManual}, pending(30d+)=${pendingPatchCount}, installed=${installedPatchCount}, skipped(no timestamp)=${noTimestampCount}, total=${results.length}`);
  } catch (e) {
    log(`Could not fetch os-patches for org ${orgId}: ${e}`);
  }

  const patchCompliancePercent = totalPatchesConsidered > 0
    ? Math.round(((totalPatchesConsidered - pendingPatchCount) / totalPatchesConsidered) * 100)
    : 100;

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

export async function getDeviceUserMapping(orgId: number): Promise<DeviceUserEntry[]> {
  const basicDevices = await apiGet(`/v2/organization/${orgId}/devices`);

  const VALID_NODE_CLASSES = new Set(["WINDOWS_WORKSTATION", "WINDOWS_SERVER", "MAC"]);
  const eligibleDevices = basicDevices.filter((d: any) => VALID_NODE_CLASSES.has((d.nodeClass || "").toUpperCase()));

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

  function classifyDeviceType(d: any): DeviceCategory {
    const nc = (d.nodeClass || "").toUpperCase();
    const chassis = (d.system?.chassisType || "").toUpperCase();
    if (nc === "WINDOWS_SERVER") return "Windows Server";
    if (nc === "MAC") return chassis === "LAPTOP" ? "Mac Laptop" : "Mac Desktop";
    return chassis === "LAPTOP" ? "Windows Laptop" : "Windows Desktop";
  }

  const entries: DeviceUserEntry[] = [];
  for (const d of detailedDevices) {
    const systemName = d.systemName || d.dnsName || `Device ${d.id}`;
    const lastUser = d.lastLoggedInUser || "";
    const osName = d.os?.name || "";
    const deviceType = classifyDeviceType(d);
    const manufacturer = d.system?.manufacturer || undefined;
    const model = d.system?.model || undefined;
    const cleanModel = model !== "To Be Filled By O.E.M." ? model : undefined;
    const cleanManufacturer = manufacturer !== "To Be Filled By O.E.M." ? manufacturer : undefined;

    const warrantyDate = d.system?.warrantyDate || d.system?.purchaseDate || d.purchaseDate;
    let age: number | undefined;
    let ageSource: "warranty" | "purchase" | "model" | "created" | undefined;

    const modelEstimatedAge = estimateAgeFromModel(cleanModel, cleanManufacturer);

    if (warrantyDate) {
      const wd = typeof warrantyDate === "number" ? new Date(warrantyDate * 1000) : new Date(warrantyDate);
      if (!isNaN(wd.getTime())) {
        age = Math.floor((now.getTime() - wd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        ageSource = d.system?.warrantyDate ? "warranty" : "purchase";
      }
    }

    if (modelEstimatedAge !== null && (age === undefined || modelEstimatedAge > (age || 0))) {
      age = modelEstimatedAge;
      ageSource = "model";
    }

    if (age === undefined && d.created) {
      const cd = typeof d.created === "number" ? new Date(d.created * 1000) : new Date(d.created);
      if (!isNaN(cd.getTime())) {
        age = Math.floor((now.getTime() - cd.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        ageSource = "created";
      }
    }

    entries.push({
      hostname: systemName,
      lastLoggedInUser: lastUser,
      osName,
      deviceType,
      age,
      ageSource,
      model: cleanModel,
      huntressProtected: false,
    });
  }

  log(`NinjaOne: device-user mapping for org ${orgId}: ${entries.length} devices, ${entries.filter(e => e.lastLoggedInUser).length} with logged-in users`);
  return entries;
}

export interface SoftwareStackFlags {
  hasZorus: boolean;
  hasDropSuite: boolean;
  hasConnectSecure: boolean;
}

const softwareFlagsCache = new Map<number, { flags: SoftwareStackFlags; expires: number }>();

export async function getInstalledSoftwareFlags(orgId: number): Promise<SoftwareStackFlags> {
  const cached = softwareFlagsCache.get(orgId);
  if (cached && Date.now() < cached.expires) return cached.flags;

  const flags: SoftwareStackFlags = { hasZorus: false, hasDropSuite: false, hasConnectSecure: false };
  try {
    const data = await apiGet(`/v2/queries/software?df=org = ${orgId}&pageSize=1000`);
    const results: any[] = data.results || [];
    for (const app of results) {
      const name = (app.name || app.displayName || app.productName || "").toLowerCase();
      if (!flags.hasZorus && (name.includes("zorus") || name.includes("zorus filterd") || name.includes("zorustunnel"))) {
        flags.hasZorus = true;
      }
      if (!flags.hasDropSuite && (name.includes("dropsuite") || name.includes("drop suite"))) {
        flags.hasDropSuite = true;
      }
      if (!flags.hasConnectSecure && (name.includes("connectsecure") || name.includes("connect secure") || name.includes("cybercns") || name.includes("cyber cns"))) {
        flags.hasConnectSecure = true;
      }
    }
    log(`NinjaOne org ${orgId} software flags: Zorus=${flags.hasZorus}, DropSuite=${flags.hasDropSuite}, ConnectSecure=${flags.hasConnectSecure} (${results.length} apps scanned)`);
  } catch (e: any) {
    log(`NinjaOne getInstalledSoftwareFlags error for org ${orgId}: ${e.message}`);
  }
  softwareFlagsCache.set(orgId, { flags, expires: Date.now() + 10 * 60 * 1000 });
  return flags;
}
