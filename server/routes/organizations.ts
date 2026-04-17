import type { Express, Request, Response } from "express";
import * as ninjaone from "../services/ninjaone";
import * as huntress from "../services/huntress";
import * as connectwise from "../services/connectwise";
import { log } from "../index";
import { requireAuth } from "../middleware/auth";

export function registerOrganizationRoutes(app: Express) {
  app.get("/api/status", requireAuth, (_req: Request, res: Response) => {
    res.json({
      ninjaone: ninjaone.isConfigured(),
      huntress: huntress.isConfigured(),
      huntressSat: huntress.isSatConfigured(),
      connectwise: connectwise.isConfigured(),
    });
  });

  app.get("/api/organizations", requireAuth, async (_req: Request, res: Response) => {
    try {
      if (!ninjaone.isConfigured()) {
        return res.status(400).json({ message: "NinjaOne is not configured" });
      }
      const orgs = await ninjaone.getOrganizations();
      res.json(orgs);
    } catch (err: any) {
      log(`Organizations error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/huntress/organizations", requireAuth, async (_req: Request, res: Response) => {
    try {
      const { getOrganizations: huntressGetOrgs } = await import("../services/huntress.js");
      const orgs = await huntressGetOrgs();
      res.json(orgs);
    } catch (err: any) {
      log(`Huntress orgs error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/cipp/tenants", requireAuth, async (_req: Request, res: Response) => {
    try {
      const { isConfigured: cippConfigured, getTenants: cippGetTenants } = await import("../services/cipp.js");
      if (!cippConfigured()) return res.json([]);
      const tenants = await cippGetTenants();
      res.json(tenants);
    } catch (err: any) {
      log(`CIPP tenants error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });
}
