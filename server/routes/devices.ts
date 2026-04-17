import type { Express, Request, Response } from "express";
import * as ninjaone from "../services/ninjaone";
import * as huntress from "../services/huntress";
import type { DeviceHealthSummary } from "@shared/schema";
import { log } from "../index";
import { requireAuth } from "../middleware/auth";

export function registerDeviceRoutes(app: Express) {
  app.get("/api/devices/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      if (!ninjaone.isConfigured()) {
        return res.json({
          totalDevices: 0,
          workstations: 0,
          servers: 0,
          deviceTypeCounts: {
            windowsDesktops: 0,
            windowsLaptops: 0,
            macDesktops: 0,
            macLaptops: 0,
            windowsServers: 0,
          },
          oldDevices: [],
          eolOsDevices: [],
          staleDevices: [],
          needsReplacementCount: 0,
          patchCompliancePercent: 100,
          pendingPatchCount: 0,
          installedPatchCount: 0,
          criticalAlerts: [],
        } satisfies DeviceHealthSummary);
      }

      const health = await ninjaone.getDeviceHealth(orgId);
      res.json(health);
    } catch (err: any) {
      log(`Device health error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/coverage-gap/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      let orgName = `Organization ${orgId}`;
      try {
        if (ninjaone.isConfigured()) {
          const orgs = await ninjaone.getOrganizations();
          const org = orgs.find((o) => o.id === orgId);
          if (org) orgName = org.name;
        }
      } catch {}

      if (!ninjaone.isConfigured() || !huntress.isConfigured()) {
        return res.json({ ninjaDevices: [], huntressAgents: [], missingFromHuntress: [], missingFromNinja: [] });
      }

      const ninjaDevices = await ninjaone.getDeviceNamesWithLastSeen(orgId);
      const huntressNames = await huntress.getAgentHostnames(orgName);

      const extractHostname = (name: string): string => {
        const parts = name.split(".");
        return parts[0].toLowerCase().replace(/[^a-z0-9-]/g, "");
      };
      const normalizeHostname = (name: string): string =>
        extractHostname(name).replace(/[^a-z0-9]/g, "");

      const ninjaSet = new Map<string, { name: string; lastSeen: string | null }>();
      for (const d of ninjaDevices) ninjaSet.set(normalizeHostname(d.name), d);

      const huntressSet = new Map<string, string>();
      for (const h of huntressNames) huntressSet.set(normalizeHostname(h), h);

      const missingFromHuntress = ninjaDevices
        .filter(d => !huntressSet.has(normalizeHostname(d.name)))
        .map(d => ({ name: extractHostname(d.name), lastSeen: d.lastSeen }));
      const missingFromNinja = huntressNames.filter(h => !ninjaSet.has(normalizeHostname(h)));

      log(`Coverage gap for "${orgName}": ${ninjaDevices.length} Ninja, ${huntressNames.length} Huntress, ${missingFromHuntress.length} missing from Huntress, ${missingFromNinja.length} missing from Ninja`);

      res.json({
        ninjaCount: ninjaDevices.length,
        huntressCount: huntressNames.length,
        missingFromHuntress,
        missingFromNinja,
      });
    } catch (err: any) {
      log(`Coverage gap error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/device-users/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      if (!ninjaone.isConfigured()) {
        return res.json({ devices: [] });
      }

      let orgName = `Organization ${orgId}`;
      try {
        const orgs = await ninjaone.getOrganizations();
        const org = orgs.find((o) => o.id === orgId);
        if (org) orgName = org.name;
      } catch {}

      const devices = await ninjaone.getDeviceUserMapping(orgId);

      if (huntress.isConfigured()) {
        try {
          const huntressHostnames = await huntress.getAgentHostnames(orgName);
          const huntressSet = new Set(huntressHostnames.map(h => h.toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "")));
          for (const d of devices) {
            const normalizedHostname = d.hostname.toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "");
            d.huntressProtected = huntressSet.has(normalizedHostname);
          }
        } catch (e: any) {
          log(`Device-user Huntress cross-ref error: ${e.message}`);
        }
      }

      res.json({ devices });
    } catch (err: any) {
      log(`Device-user mapping error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
