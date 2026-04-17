import type { Express, Request, Response } from "express";
import * as ninjaone from "../services/ninjaone";
import * as huntress from "../services/huntress";
import * as dropsuite from "../services/dropsuite";
import { storage } from "../storage";
import { log } from "../index";
import { requireAuth, requireEditor } from "../middleware/auth";
import { fuzzyNameMatch } from "../utils/matching";

async function refreshStackForAccount(
  account: any,
  mapping: any,
  prefetched: { ninjaOrgs?: any[], huntressOrgs?: any[], cippTenants?: any[] } = {}
): Promise<any> {
  const current: any = account.stackCompliance || {
    ninjaRmm: null, huntressEdr: null, huntressItdr: null, huntressSat: null,
    dropSuite: null, dropsuiteNeedsMapping: null, zorusDns: null, connectSecure: null, huntressSiem: null,
    msBizPremium: null, secureScore: null, lastRefreshed: null, manualOverrides: {},
  };
  const updated = { ...current };

  try {
    const ninjaOrgs = prefetched.ninjaOrgs ?? await ninjaone.getOrganizations();
    const ninjaOrgId = mapping?.ninjaOrgId ?? null;
    const ninjaOrg = ninjaOrgId
      ? ninjaOrgs.find((o: any) => o.id === ninjaOrgId)
      : ninjaOrgs.find((o: any) => fuzzyNameMatch(account.companyName, o.name || ""));
    updated.ninjaRmm = ninjaOrg ? true : false;
    if (ninjaOrg) {
      log(`Stack [${account.companyName}] → Ninja matched: ${ninjaOrg.name}`);
      try {
        const swFlags = await ninjaone.getInstalledSoftwareFlags(ninjaOrg.id);
        updated.zorusDns = swFlags.hasZorus ? true : false;
        updated.dropSuite = swFlags.hasDropSuite ? true : false;
        updated.connectSecure = swFlags.hasConnectSecure ? true : false;
        log(`Stack [${account.companyName}] → Software: Zorus=${swFlags.hasZorus}, DropSuite=${swFlags.hasDropSuite}, ConnectSecure=${swFlags.hasConnectSecure}`);
      } catch (se: any) {
        log(`Stack [${account.companyName}] → Software scan error: ${se.message}`);
      }
    } else {
      log(`Stack [${account.companyName}] → Ninja: no match`);
    }
  } catch (e: any) {
    log(`Stack refresh Ninja error for ${account.companyName}: ${e.message}`);
  }

  try {
    const huntressOrgs = prefetched.huntressOrgs ?? await huntress.getOrganizations();
    const huntressOrgId = mapping?.huntressOrgId ?? null;
    const huntressOrg = huntressOrgId
      ? huntressOrgs.find((o: any) => o.id === huntressOrgId)
      : huntressOrgs.find((o: any) => fuzzyNameMatch(account.companyName, o.name || ""));
    if (huntressOrg) {
      log(`Stack [${account.companyName}] → Huntress matched: ${huntressOrg.name}`);
      try {
        const orgFlags = await huntress.getOrgStackFlags(huntressOrg.id);
        // EDR: org must have active agents — existence alone is not sufficient
        updated.huntressEdr = orgFlags.hasEdr ? true : false;
        updated.huntressItdr = orgFlags.hasItdr ? true : false;
        updated.huntressSat = orgFlags.hasSat ? true : false;
        updated.huntressSiem = orgFlags.hasSiem ? true : false;
        log(`Stack [${account.companyName}] → Huntress flags: EDR=${orgFlags.hasEdr}(${orgFlags.agentCount} agents), ITDR=${orgFlags.hasItdr}(${orgFlags.identityCount} identities), SAT=${orgFlags.hasSat}(${orgFlags.satLearnerCount} learners), SIEM=${orgFlags.hasSiem}`);
      } catch (he: any) {
        log(`Stack [${account.companyName}] → Huntress org detail error: ${he.message}`);
        // If we can't get flags, only mark EDR true if org exists (conservative fallback)
        updated.huntressEdr = true;
      }
    } else {
      log(`Stack [${account.companyName}] → Huntress: no match`);
      updated.huntressEdr = false;
    }
  } catch (e: any) {
    log(`Stack refresh Huntress error for ${account.companyName}: ${e.message}`);
  }

  const { isConfigured: cippConfigured, getClientData: cippGetClientData, getTenants: cippGetTenants } = await import("../services/cipp.js");
  let cippTenantFilter: string | null = null;
  if (cippConfigured()) {
    try {
      cippTenantFilter = mapping?.cippTenantId ?? null;
      if (!cippTenantFilter) {
        const cippTenants = prefetched.cippTenants ?? await cippGetTenants();
        const matched = cippTenants.find((t: any) => fuzzyNameMatch(account.companyName, t.displayName || ""));
        if (matched) cippTenantFilter = matched.defaultDomainName || matched.id;
      }
      if (cippTenantFilter) {
        const cippData = await cippGetClientData(cippTenantFilter);
        updated.msBizPremium = cippData.msBizPremium;
        updated.secureScore = cippData.secureScore;
        log(`Stack [${account.companyName}] → CIPP tenant: ${cippTenantFilter}`);
      }
    } catch (e: any) {
      log(`Stack refresh CIPP error for ${account.companyName}: ${e.message}`);
    }
  }

  if (dropsuite.isConfigured()) {
    if (updated.dropSuite === true) {
      updated.dropsuiteNeedsMapping = false;
      log(`Stack [${account.companyName}] → DropSuite: already detected via NinjaOne software scan`);
    } else {
      const dropsuiteUserId: string | null = mapping?.dropsuiteUserId ?? null;
      if (dropsuiteUserId) {
        updated.dropSuite = true;
        updated.dropsuiteNeedsMapping = false;
        log(`Stack [${account.companyName}] → DropSuite: matched via manual mapping (id=${dropsuiteUserId})`);
      } else if (cippTenantFilter) {
        const hasDomain = await dropsuite.checkDomainHasBackup(cippTenantFilter);
        updated.dropSuite = hasDomain;
        updated.dropsuiteNeedsMapping = false;
        log(`Stack [${account.companyName}] → DropSuite: domain check "${cippTenantFilter}" = ${hasDomain}`);
      } else {
        const dsInfo = await dropsuite.getAccountBackupStatus(account.companyName);
        updated.dropSuite = dsInfo.hasBackup;
        updated.dropsuiteNeedsMapping = false;
        log(`Stack [${account.companyName}] → DropSuite: name match = ${dsInfo.hasBackup}`);
      }
    }
  }

  const manualOverrides = current.manualOverrides || {};
  Object.keys(manualOverrides).forEach(key => {
    if (manualOverrides[key] !== undefined) (updated as any)[key] = manualOverrides[key];
  });
  updated.lastRefreshed = new Date().toISOString();
  return updated;
}

// In-memory bulk refresh progress state
const bulkRefreshJob = {
  active: false,
  total: 0,
  completed: 0,
  currentClient: "",
  startedAt: null as string | null,
};

export function registerClientRoutes(app: Express) {
  app.patch("/api/clients/:id/stack", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid account ID" });
      const accounts = await storage.getAllClientAccounts();
      const account = accounts.find(a => a.id === id);
      if (!account) return res.status(404).json({ message: "Account not found" });
      const current: any = account.stackCompliance || {};
      const updates = req.body || {};
      const merged = { ...current, ...updates, lastRefreshed: new Date().toISOString() };
      const result = await storage.updateClientStackCompliance(id, merged);
      res.json(result);
    } catch (err: any) {
      log(`Stack compliance update error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id/tbr-invite", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid account ID" });
      const { invited } = req.body as { invited: boolean };
      const invitedAt = invited ? new Date() : null;
      const result = await storage.updateClientTbrInvite(id, invitedAt);
      res.json(result);
    } catch (err: any) {
      log(`TBR invite update error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients/stack/refresh-progress", requireAuth, (_req: Request, res: Response) => {
    res.json({ ...bulkRefreshJob });
  });

  app.post("/api/clients/stack/refresh-all", requireAuth, async (req: Request, res: Response) => {
    if (bulkRefreshJob.active) {
      return res.json({ started: false, count: bulkRefreshJob.total, alreadyRunning: true });
    }
    try {
      const accounts = await storage.getAllClientAccounts();
      const managed = accounts.filter(a => a.tier && ["A", "B", "C"].includes(a.tier));
      const mappings = await storage.getAllClientMappings();
      bulkRefreshJob.active = true;
      bulkRefreshJob.total = managed.length;
      bulkRefreshJob.completed = 0;
      bulkRefreshJob.currentClient = "";
      bulkRefreshJob.startedAt = new Date().toISOString();
      res.json({ started: true, count: managed.length });
      (async () => {
        log(`Bulk stack refresh: pre-fetching org lists...`);
        let ninjaOrgs: any[] = [];
        let huntressOrgs: any[] = [];
        let cippTenants: any[] = [];
        try { ninjaOrgs = await ninjaone.getOrganizations(); log(`Bulk: got ${ninjaOrgs.length} Ninja orgs`); }
        catch (e: any) { log(`Bulk: Ninja fetch failed: ${e.message}`); }
        try { huntressOrgs = await huntress.getOrganizations(); log(`Bulk: got ${huntressOrgs.length} Huntress orgs`); }
        catch (e: any) { log(`Bulk: Huntress fetch failed: ${e.message}`); }
        const { isConfigured: cippConfigured, getTenants: cippGetTenants } = await import("../services/cipp.js");
        if (cippConfigured()) {
          try { cippTenants = await cippGetTenants(); log(`Bulk: got ${cippTenants.length} CIPP tenants`); }
          catch (e: any) { log(`Bulk: CIPP fetch failed: ${e.message}`); }
        }
        const prefetched = { ninjaOrgs, huntressOrgs, cippTenants };
        let ok = 0;
        for (const account of managed) {
          bulkRefreshJob.currentClient = account.companyName;
          try {
            const mapping = mappings.find(m => m.cwCompanyId === account.cwCompanyId);
            const updated = await refreshStackForAccount(account, mapping, prefetched);
            await storage.updateClientStackCompliance(account.id, updated);
            ok++;
          } catch (e: any) {
            log(`Bulk refresh error for ${account.companyName}: ${e.message}`);
          }
          bulkRefreshJob.completed++;
          await new Promise(r => setTimeout(r, 100));
        }
        log(`Bulk stack refresh complete: ${ok}/${managed.length} accounts updated`);
        bulkRefreshJob.active = false;
        bulkRefreshJob.currentClient = "";
      })().catch(e => {
        log(`Bulk refresh fatal: ${e.message}`);
        bulkRefreshJob.active = false;
      });
    } catch (err: any) {
      bulkRefreshJob.active = false;
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/:id/stack/refresh", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid account ID" });

      const accounts = await storage.getAllClientAccounts();
      const account = accounts.find(a => a.id === id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const mappings = await storage.getAllClientMappings();
      const mapping = mappings.find(m => m.cwCompanyId === account.cwCompanyId);

      const updated = await refreshStackForAccount(account, mapping);
      const result = await storage.updateClientStackCompliance(id, updated);
      res.json(result);
    } catch (err: any) {
      log(`Stack refresh error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/client-mappings", requireAuth, async (_req: Request, res: Response) => {
    try {
      const mappings = await storage.getAllClientMappings();
      res.json(mappings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/client-mappings/:cwCompanyId", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const cwCompanyId = parseInt(req.params.cwCompanyId as string);
      if (isNaN(cwCompanyId)) return res.status(400).json({ message: "Invalid company ID" });
      const data = { ...req.body, cwCompanyId };
      const result = await storage.upsertClientMapping(data);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
