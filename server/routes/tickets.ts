import type { Express, Request, Response } from "express";
import * as ninjaone from "../services/ninjaone";
import * as connectwise from "../services/connectwise";
import type { TicketSummary } from "@shared/schema";
import { log } from "../index";
import { requireAuth } from "../middleware/auth";

export function registerTicketRoutes(app: Express) {
  app.get("/api/tickets/:orgId", requireAuth, async (req: Request, res: Response) => {
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

      if (!connectwise.isConfigured()) {
        return res.json({
          totalTickets: 0,
          topCategories: [],
          recurringIssues: [],
          oldOpenTickets: [],
          monthlyVolume: [],
        } satisfies TicketSummary);
      }

      const tickets = await connectwise.getTicketSummary(orgName);
      res.json(tickets);
    } catch (err: any) {
      log(`Tickets error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/projects/:orgId", requireAuth, async (req: Request, res: Response) => {
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

      if (!connectwise.isConfigured()) {
        return res.json({ completed: [], inProgress: [] });
      }

      const projects = await connectwise.getProjectItems(orgName);
      res.json(projects);
    } catch (err: any) {
      log(`Projects error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
