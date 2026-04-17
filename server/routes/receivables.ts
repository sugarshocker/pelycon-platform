import type { Express, Request, Response } from "express";
import * as connectwise from "../services/connectwise";
import { storage } from "../storage";
import { log } from "../index";
import { requireAuth, requireEditor } from "../middleware/auth";
import { syncArOnlyClients } from "../services/syncEngine";

export function registerReceivablesRoutes(app: Express) {
  app.get("/api/receivables/clients", requireAuth, async (_req: Request, res: Response) => {
    try {
      const managedAccounts = await storage.getAllClientAccounts();
      const arOnlyAccounts = await storage.getAllArOnlyClients();

      // Deduplicate: if a company appears in both managed and AR-only tables, prefer managed
      const managedCwIds = new Set(managedAccounts.map(a => a.cwCompanyId).filter(Boolean));

      const combined = [
        ...managedAccounts.map(a => ({
          id: a.id,
          cwCompanyId: a.cwCompanyId,
          companyName: a.companyName,
          agreementTypes: a.agreementTypes,
          arSummary: a.arSummary,
          lastSyncedAt: a.lastSyncedAt,
          tier: (a as any).tierOverride || a.tier,
          totalRevenue: a.totalRevenue,
          source: "managed" as const,
        })),
        ...arOnlyAccounts
          .filter(a => !managedCwIds.has(a.cwCompanyId))
          .map(a => ({
            id: a.id + 100000,
            cwCompanyId: a.cwCompanyId,
            companyName: a.companyName,
            agreementTypes: a.agreementTypes,
            arSummary: a.arSummary,
            lastSyncedAt: a.lastSyncedAt,
            tier: null,
            totalRevenue: (a.agreementMonthlyRevenue || 0) * 12,
            source: "agreement-only" as const,
          })),
      ];

      res.json(combined);
    } catch (err: any) {
      log(`[receivables] Error fetching clients: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/receivables/sync", requireAuth, requireEditor, async (_req: Request, res: Response) => {
    try {
      if (!connectwise.isConfigured()) {
        return res.status(503).json({ message: "ConnectWise is not configured" });
      }
      const arOnlyCount = await syncArOnlyClients();
      res.json({ synced: arOnlyCount });
    } catch (err: any) {
      log(`[ar-sync] Manual AR sync error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
