import { log } from "../index";

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/\\n/g, "").trim();
}

const AUTH_TOKEN = cleanEnv("DROPSUITE_AUTH_TOKEN");
const SECRET_TOKEN = cleanEnv("DROPSUITE_SECRET_TOKEN");
const RESELLER_TOKEN = cleanEnv("DROPSUITE_RESELLER_TOKEN");
const BASE_URL = "https://dropsuite.us/api/v1";

export function isConfigured(): boolean {
  return !!(AUTH_TOKEN && SECRET_TOKEN);
}

export function isResellerConfigured(): boolean {
  return !!(RESELLER_TOKEN);
}

function authHeaders(): Record<string, string> {
  return {
    "Authorization": AUTH_TOKEN,
    "Secret": SECRET_TOKEN,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

function resellerHeaders(): Record<string, string> {
  return {
    "Authorization": RESELLER_TOKEN,
    "Secret": SECRET_TOKEN,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

async function apiGet(path: string, useReseller = false): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const headers = useReseller ? resellerHeaders() : authHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DropSuite API error: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

export interface DropSuiteOrg {
  id: number;
  name: string;
  email?: string;
  user_ids?: number[];
}

let orgsCache: DropSuiteOrg[] | null = null;
let orgsCacheExpiry = 0;

export async function getOrganizations(): Promise<DropSuiteOrg[]> {
  if (orgsCache && Date.now() < orgsCacheExpiry) return orgsCache;

  try {
    const data = await apiGet("/organizations", true);
    const orgs: DropSuiteOrg[] = (data.organizations || data || []).map((o: any) => ({
      id: o.id,
      name: o.name || o.company_name || o.email || `Org ${o.id}`,
      email: o.email,
      user_ids: o.user_ids || [],
    }));
    log(`DropSuite: loaded ${orgs.length} organizations`);
    orgsCache = orgs;
    orgsCacheExpiry = Date.now() + 10 * 60 * 1000;
    return orgs;
  } catch (e: any) {
    log(`DropSuite getOrganizations error: ${e.message}`);
    return [];
  }
}

export interface DropSuiteAccountInfo {
  hasBackup: boolean;
  userCount?: number;
  orgName?: string;
}

const accountCache = new Map<string, { info: DropSuiteAccountInfo; expires: number }>();

export async function getAccountBackupStatusById(userId: number): Promise<DropSuiteAccountInfo> {
  const cacheKey = `id:${userId}`;
  const cached = accountCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.info;

  if (!isConfigured()) return { hasBackup: false };

  try {
    const data = await apiGet(`/accounts?user_ids[]=${userId}`, false);
    const accounts: any[] = data.accounts || (Array.isArray(data) ? data : []);
    const found = accounts.find((a: any) => Number(a.user_id ?? a.id) === userId);
    const info: DropSuiteAccountInfo = {
      hasBackup: !!found,
      userCount: found ? 1 : 0,
      orgName: found?.name || found?.email,
    };
    accountCache.set(cacheKey, { info, expires: Date.now() + 10 * 60 * 1000 });
    return info;
  } catch (e: any) {
    log(`DropSuite getAccountBackupStatusById(${userId}) error: ${e.message}`);
    return { hasBackup: false };
  }
}

function normDs(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(inc|llc|pllc|corp|ltd|co|group|services|solutions|tech|technologies|consulting|associates|management|systems|partners|company|international|properties|enterprises|law|legal|psc|pc|dds|cpa|md|dvm)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

export async function getAccountBackupStatus(companyName: string): Promise<DropSuiteAccountInfo> {
  const cacheKey = companyName.toLowerCase();
  const cached = accountCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.info;

  if (!isConfigured()) return { hasBackup: false };

  try {
    const orgs = await getOrganizations();

    const normTarget = normDs(companyName);
    let matched: DropSuiteOrg | undefined;
    let matchMethod = "";

    // 1. Exact normalized match
    for (const org of orgs) {
      const orgNorm = normDs(org.name);
      if (orgNorm === normTarget) { matched = org; matchMethod = "exact"; break; }
    }

    // 2. Substring match
    if (!matched) {
      for (const org of orgs) {
        const orgNorm = normDs(org.name);
        if (orgNorm.includes(normTarget) || normTarget.includes(orgNorm)) {
          matched = org; matchMethod = "substring"; break;
        }
      }
    }

    // 3. Token overlap (80% threshold)
    if (!matched) {
      const tokTarget = normTarget.split(" ").filter(t => t.length > 2);
      for (const org of orgs) {
        const tokOrg = normDs(org.name).split(" ").filter(t => t.length > 2);
        if (tokTarget.length === 0 || tokOrg.length === 0) continue;
        const shorter = tokTarget.length <= tokOrg.length ? tokTarget : tokOrg;
        const longer = tokTarget.length <= tokOrg.length ? tokOrg : tokTarget;
        const hits = shorter.filter(t => longer.some(lt => lt === t || lt.includes(t) || t.includes(lt))).length;
        if (hits >= Math.ceil(shorter.length * 0.8)) {
          matched = org; matchMethod = "token-overlap"; break;
        }
      }
    }

    // 4. Acronym expansion: treat short all-uppercase names (≤5 chars) as initials
    //    e.g. "CMP" matches "CM Process" because first letters c,m start with c,m
    if (!matched && /^[A-Z]{2,5}$/.test(companyName.replace(/\s.*/, ""))) {
      const initials = companyName.replace(/\s.*/, "").toLowerCase();
      for (const org of orgs) {
        const orgNorm = normDs(org.name);
        const orgInitials = orgNorm.split(" ").filter(t => t.length > 0).map(t => t[0]).join("");
        if (orgInitials.startsWith(initials) || initials.startsWith(orgInitials)) {
          matched = org; matchMethod = "acronym"; break;
        }
      }
    }

    // 5. First-word prefix: company first meaningful word starts with or equals DropSuite org first word
    if (!matched && normTarget.length >= 3) {
      const targetFirst = normTarget.split(" ")[0];
      for (const org of orgs) {
        const orgFirst = normDs(org.name).split(" ")[0];
        if (targetFirst.length >= 3 && orgFirst.length >= 3) {
          if (targetFirst === orgFirst || orgFirst.startsWith(targetFirst) || targetFirst.startsWith(orgFirst)) {
            matched = org; matchMethod = "first-word"; break;
          }
        }
      }
    }

    if (!matched) {
      const orgList = orgs.slice(0, 20).map(o => `"${o.name}"`).join(", ");
      log(`DropSuite: no match for "${companyName}" (normalized: "${normTarget}") among ${orgs.length} orgs. Sample: ${orgList}`);
      const info: DropSuiteAccountInfo = { hasBackup: false };
      accountCache.set(cacheKey, { info, expires: Date.now() + 10 * 60 * 1000 });
      return info;
    }

    log(`DropSuite: matched "${companyName}" → "${matched.name}" (id=${matched.id}, method=${matchMethod})`);

    const info: DropSuiteAccountInfo = {
      hasBackup: true,
      userCount: matched.user_ids?.length,
      orgName: matched.name,
    };
    accountCache.set(cacheKey, { info, expires: Date.now() + 10 * 60 * 1000 });
    return info;
  } catch (e: any) {
    log(`DropSuite getAccountBackupStatus error for "${companyName}": ${e.message}`);
    return { hasBackup: false };
  }
}

export async function getAllOrganizationNames(): Promise<string[]> {
  const orgs = await getOrganizations();
  return orgs.map(o => o.name);
}

let allDomainsCacheSet: Set<string> | null = null;
let allDomainsCacheExpiry = 0;

export async function getAllAccountDomains(): Promise<Set<string>> {
  if (allDomainsCacheSet && Date.now() < allDomainsCacheExpiry) return allDomainsCacheSet;
  if (!isConfigured()) return new Set();

  const domains = new Set<string>();
  try {
    let page = 1;
    while (page <= 100) {
      const data = await apiGet(`/accounts?page=${page}&per_page=100`, false);
      const accounts: any[] = data.accounts || (Array.isArray(data) ? data : []);
      if (accounts.length === 0) break;
      for (const a of accounts) {
        const email: string = a.email || a.user_email || a.name || "";
        const atIdx = email.indexOf("@");
        if (atIdx > 0) domains.add(email.substring(atIdx + 1).toLowerCase());
      }
      if (accounts.length < 100) break;
      page++;
    }
    log(`DropSuite: discovered ${domains.size} unique email domains from accounts`);
  } catch (e: any) {
    log(`DropSuite getAllAccountDomains error: ${e.message}`);
  }

  allDomainsCacheSet = domains;
  allDomainsCacheExpiry = Date.now() + 15 * 60 * 1000;
  return domains;
}

export async function checkDomainHasBackup(tenantDomain: string): Promise<boolean> {
  if (!isConfigured() || !tenantDomain) return false;
  const domains = await getAllAccountDomains();
  const target = tenantDomain.toLowerCase();

  if (domains.has(target)) return true;

  for (const d of domains) {
    if (d.endsWith(`.${target}`) || target.endsWith(`.${d}`)) return true;
    const tBase = target.replace(/\.onmicrosoft\.com$/, "").replace(/\.[^.]+$/, "");
    const dBase = d.replace(/\.onmicrosoft\.com$/, "").replace(/\.[^.]+$/, "");
    if (tBase && dBase && tBase.length > 2 && tBase === dBase) return true;
  }

  return false;
}
