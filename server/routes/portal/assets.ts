import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import * as ninjaone from "../../services/ninjaone";

export function registerPortalAssetRoutes(app: Express) {
  app.get("/api/portal/assets", async (req: Request, res: Response) => {
    try {
      const clientDbId = (req as any).clientId as number;
      const client = await storage.getClientById(clientDbId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      if (!ninjaone.isConfigured() || !client.rmmOrgId) {
        return res.json({
          devices: [],
          summary: { total: 0, workstations: 0, servers: 0 },
          message: "Device inventory not available",
        });
      }

      const health = await ninjaone.getDeviceHealth(client.rmmOrgId);
      res.json({
        summary: {
          total: health.totalDevices,
          workstations: health.workstations,
          servers: health.servers,
          patchCompliance: health.patchCompliancePercent,
          pendingPatches: health.pendingPatchCount,
        },
        deviceTypeCounts: health.deviceTypeCounts,
        oldDevices: health.oldDevices,
        eolOsDevices: health.eolOsDevices,
        staleDevices: health.staleDevices,
        criticalAlerts: health.criticalAlerts,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portal/assets/licensing", async (req: Request, res: Response) => {
    try {
      const clientDbId = (req as any).clientId as number;
      const client = await storage.getClientById(clientDbId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const allSnapshots = await storage.getAllFinalizedSnapshots();
      const snapshots = allSnapshots
        .filter(s => s.orgName.toLowerCase().trim() === client.companyName.toLowerCase().trim())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latest = snapshots[0];

      if (!latest?.fullData) {
        return res.json({ available: false, message: "Licensing data available after next quarterly review" });
      }

      const data = latest.fullData as any;
      const licenseData = data.licenseReport || data.security?.licenseReport || null;
      res.json({
        available: !!licenseData,
        data: licenseData,
        dataAsOf: new Date(latest.createdAt).toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
