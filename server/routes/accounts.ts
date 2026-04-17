import type { Express, Request, Response } from "express";
import * as connectwise from "../services/connectwise";
import { storage } from "../storage";
import { log } from "../index";
import { requireAuth, requireEditor } from "../middleware/auth";
import { generateMarginAnalysis } from "../services/marginAnalysis";
import { syncAccountsFromConnectWise, syncArOnlyClients, startAutoSync } from "../services/syncEngine";

export function registerAccountRoutes(app: Express) {
  startAutoSync();

  app.get("/api/accounts/sync", requireAuth, requireEditor, async (_req: Request, res: Response) => {
    try {
      if (!connectwise.isConfigured()) {
        return res.status(503).json({ message: "ConnectWise is not configured" });
      }
      const { results, removed } = await syncAccountsFromConnectWise();
      const arOnlyCount = await syncArOnlyClients();
      res.json({ synced: results.length, removed: removed.length, removedNames: removed, arOnlySynced: arOnlyCount, accounts: results });
    } catch (err: any) {
      log(`[accounts-sync] Manual sync error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/accounts/:id/ar-refresh", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const accounts = await storage.getAllClientAccounts();
      const acct = accounts.find(a => a.id === id);
      if (!acct) return res.status(404).json({ message: "Account not found" });

      const arSummary = await connectwise.getCompanyARSummary(acct.cwCompanyId);
      if (arSummary) {
        await storage.upsertClientAccount({ ...acct, arSummary, lastSyncedAt: new Date() } as any);
      }
      res.json(arSummary || { error: "No AR data available" });
    } catch (err: any) {
      log(`[ar] Refresh error for account ${req.params.id}: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/accounts", requireAuth, async (_req: Request, res: Response) => {
    try {
      const accounts = await storage.getAllClientAccounts();
      const schedules = await storage.getAllSchedules();
      const allFinalized = await storage.getAllFinalizedSnapshots();

      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const twelveMonthsAhead = new Date(now);
      twelveMonthsAhead.setMonth(twelveMonthsAhead.getMonth() + 12);

      const enriched = accounts.map((acct) => {
        const schedule = schedules.find(s => s.orgName.toLowerCase().trim() === acct.companyName.toLowerCase().trim());
        const snapshots = allFinalized
          .filter(s => s.orgName.toLowerCase().trim() === acct.companyName.toLowerCase().trim())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const lastTbr = snapshots[0] || null;
        const lastTbrDate = lastTbr ? (lastTbr.reviewDate || new Date(lastTbr.createdAt).toISOString().split("T")[0]) : null;
        const rawNextDate = schedule?.nextReviewDate ? new Date(schedule.nextReviewDate) : null;
        const nextTbrDate = rawNextDate && rawNextDate >= now && rawNextDate <= twelveMonthsAhead
          ? rawNextDate.toISOString().split("T")[0]
          : null;
        const freq = schedule?.frequencyMonths || null;

        const hadRecentTbr = lastTbr && new Date(lastTbr.createdAt) > sixMonthsAgo;
        const hasScheduled = !!nextTbrDate;

        let tbrStatus: "green" | "yellow" | "scheduled" | "red";
        let tbrStatusReason: string;

        if (hadRecentTbr && hasScheduled) {
          tbrStatus = "green";
          tbrStatusReason = "On track";
        } else if (hadRecentTbr && !hasScheduled) {
          tbrStatus = "yellow";
          tbrStatusReason = "No next review scheduled";
        } else if (!hadRecentTbr && hasScheduled) {
          tbrStatus = "scheduled";
          tbrStatusReason = "Overdue but TBR is scheduled";
        } else if (snapshots.length > 0) {
          tbrStatus = "yellow";
          tbrStatusReason = "Overdue — no recent review or schedule";
        } else {
          tbrStatus = "red";
          tbrStatusReason = "Never reviewed — no TBR on record";
        }

        const needsAnalysis = !acct.marginAnalysis && acct.totalRevenue && acct.totalRevenue > 0;
        let marginAnalysis = acct.marginAnalysis;
        if (needsAnalysis) {
          marginAnalysis = generateMarginAnalysis({
            totalRevenue: acct.totalRevenue,
            laborCost: acct.laborCost || 0,
            serviceLaborCost: (acct as any).serviceLaborCost || 0,
            projectLaborCost: (acct as any).projectLaborCost || 0,
            additionCost: acct.additionCost || 0,
            msLicensingRevenue: (acct as any).msLicensingRevenue || 0,
            msLicensingCost: (acct as any).msLicensingCost || 0,
            totalCost: acct.totalCost || 0,
            agreementRevenue: acct.agreementRevenue || 0,
            projectRevenue: acct.projectRevenue || 0,
            totalHours: acct.totalHours || 0,
            serviceHours: acct.serviceHours || 0,
            projectHours: acct.projectHours || 0,
            agreementAdditions: acct.agreementAdditions || [],
          }, (acct.engineerBreakdown as any[]) || []);
        }

        return {
          ...acct,
          marginAnalysis,
          lastTbrDate,
          nextTbrDate,
          tbrStatus,
          tbrStatusReason,
          effectiveTier: acct.tierOverride || acct.tier,
          scheduleFrequency: freq,
        };
      });

      res.json(enriched);
    } catch (err: any) {
      log(`Accounts list error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/accounts/:id/tier", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid account ID" });
      const { tier } = req.body;
      if (!tier || !["A", "B", "C"].includes(tier)) {
        return res.status(400).json({ message: "Tier must be A, B, or C" });
      }
      const result = await storage.updateClientAccountTier(id, tier);
      res.json(result);
    } catch (err: any) {
      log(`Account tier update error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
