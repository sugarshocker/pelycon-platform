import type { Express, Request, Response } from "express";
import * as ninjaone from "../services/ninjaone";
import * as huntress from "../services/huntress";
import type { SecuritySummary } from "@shared/schema";
import { log } from "../index";
import { requireAuth } from "../middleware/auth";

export function registerSecurityRoutes(app: Express) {
  app.get("/api/security/:orgId", requireAuth, async (req: Request, res: Response) => {
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

      if (!huntress.isConfigured()) {
        return res.json({
          totalIncidents: 0,
          resolvedIncidents: 0,
          pendingIncidents: 0,
          recentIncidents: [],
          activeAgents: 0,
          managedAntivirusCount: 0,
          antivirusNotProtectedCount: 0,
          satCompletionPercent: null,
          phishingClickRate: null,
          satLearnerCount: null,
          satTotalUsers: null,
          satCoveragePercent: null,
          satModulesCompleted: null,
          satModulesAssigned: null,
          phishingCampaignCount: null,
          phishingCompromiseRate: null,
          phishingReportRate: null,
          recentPhishingCampaigns: [],
          satUnenrolledUsers: [],
          unprotectedAgents: [],
          identitiesMonitored: null,
          trendDirection: "stable",
        } satisfies SecuritySummary);
      }

      const security = await huntress.getSecuritySummary(orgName);
      res.json(security);
    } catch (err: any) {
      log(`Security error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
