import type { Express, Request, Response } from "express";
import { log } from "../index";
import { storage } from "../storage";
import { requireAuth, requireEditor } from "../middleware/auth";

export function registerDropsuiteRoutes(app: Express) {
  app.post("/api/dropsuite/import-csv", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const rows: Array<{ companyName: string; dropsuiteUserId: string }> = req.body.rows || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "rows array is required" });
      }
      const allAccounts = await storage.getAllClientAccounts();
      const allMappings = await storage.getAllClientMappings();
      const results: Array<{ companyName: string; status: string; cwCompanyId?: number }> = [];

      function normName(s: string) {
        return s.toLowerCase()
          .replace(/\[.*?\]/g, "")
          .replace(/&/g, " and ")
          .replace(/\b(inc|llc|pllc|corp|ltd|co|group|services|solutions|tech|technologies|consulting|associates|management|systems|partners|company|international|properties|enterprises|law|legal|psc|pc|dds|cpa|md|dvm)\b/g, " ")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ").trim();
      }

      for (const row of rows) {
        if (!row.companyName || !row.dropsuiteUserId) {
          results.push({ companyName: row.companyName || "(missing)", status: "skipped: missing name or user ID" });
          continue;
        }
        await storage.upsertDropsuiteAccount(row.dropsuiteUserId, row.companyName);
        const normTarget = normName(row.companyName);
        const tokens = normTarget.split(" ").filter(t => t.length > 2);

        let account = allAccounts.find(a => normName(a.companyName) === normTarget);
        if (!account) {
          account = allAccounts.find(a => {
            const n = normName(a.companyName);
            return n.includes(normTarget) || normTarget.includes(n);
          });
        }
        if (!account && tokens.length > 0) {
          account = allAccounts.find(a => {
            const aToks = normName(a.companyName).split(" ").filter(t => t.length > 2);
            if (aToks.length === 0) return false;
            const shorter = tokens.length <= aToks.length ? tokens : aToks;
            const longer = tokens.length <= aToks.length ? aToks : tokens;
            const hits = shorter.filter(t => longer.some(lt => lt === t || lt.startsWith(t) || t.startsWith(lt))).length;
            return hits >= Math.ceil(shorter.length * 0.75);
          });
        }
        if (!account) {
          results.push({ companyName: row.companyName, status: "not found in ConnectWise accounts" });
          continue;
        }
        const existing = allMappings.find(m => m.cwCompanyId === account!.cwCompanyId);
        await storage.upsertClientMapping({
          cwCompanyId: account.cwCompanyId,
          companyName: account.companyName,
          ninjaOrgId: existing?.ninjaOrgId ?? null,
          huntressOrgId: existing?.huntressOrgId ?? null,
          cippTenantId: existing?.cippTenantId ?? null,
          dropsuiteUserId: row.dropsuiteUserId,
          notes: existing?.notes ?? null,
        });
        const currentStack: any = account.stackCompliance || {};
        const updatedStack = {
          ...currentStack,
          dropSuite: true,
          dropsuiteNeedsMapping: false,
          lastRefreshed: currentStack.lastRefreshed ?? null,
          manualOverrides: currentStack.manualOverrides ?? {},
        };
        await storage.updateClientStackCompliance(account.id, updatedStack);
        results.push({ companyName: row.companyName, status: "mapped", cwCompanyId: account.cwCompanyId });
      }

      res.json({ results, total: rows.length, mapped: results.filter(r => r.status === "mapped").length });
    } catch (err: any) {
      log(`DropSuite CSV import error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dropsuite/accounts", requireAuth, async (_req: Request, res: Response) => {
    try {
      const accounts = await storage.getAllDropsuiteAccounts();
      res.json(accounts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
