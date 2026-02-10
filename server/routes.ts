import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import multer from "multer";
import Papa from "papaparse";
import * as ninjaone from "./services/ninjaone";
import * as huntress from "./services/huntress";
import * as connectwise from "./services/connectwise";
import * as roadmap from "./services/roadmap";
import { generateSummaryHtml } from "./services/export";
import { log } from "./index";
import type { MfaReport, LicenseReport } from "@shared/schema";

const MemStore = MemoryStore(session);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any)?.authenticated) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "tbr-dashboard-secret",
      resave: false,
      saveUninitialized: false,
      store: new MemStore({ checkPeriod: 86400000 }),
      cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { password } = req.body;
    const dashboardPassword = process.env.DASHBOARD_PASSWORD;

    if (!dashboardPassword) {
      return res.status(500).json({ message: "Dashboard password not configured" });
    }

    if (password === dashboardPassword) {
      (req.session as any).authenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });

  app.get("/api/auth/check", (req: Request, res: Response) => {
    if ((req.session as any)?.authenticated) {
      res.json({ authenticated: true });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/status", requireAuth, (_req: Request, res: Response) => {
    res.json({
      ninjaone: ninjaone.isConfigured(),
      huntress: huntress.isConfigured(),
      connectwise: connectwise.isConfigured(),
    });
  });

  app.get("/api/organizations", requireAuth, async (_req: Request, res: Response) => {
    try {
      if (!ninjaone.isConfigured()) {
        return res.status(503).json({ message: "NinjaOne is not configured" });
      }
      const orgs = await ninjaone.getOrganizations();
      res.json(orgs);
    } catch (err: any) {
      log(`Organizations error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/devices/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!ninjaone.isConfigured()) {
        return res.status(503).json({ message: "NinjaOne is not configured" });
      }
      const orgId = parseInt(req.params.orgId as string);
      const health = await ninjaone.getDeviceHealth(orgId);
      res.json(health);
    } catch (err: any) {
      log(`Device health error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/security/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!huntress.isConfigured()) {
        return res.status(503).json({ message: "Huntress is not configured" });
      }
      const orgId = parseInt(req.params.orgId as string);
      let orgName = `Organization ${orgId}`;
      if (ninjaone.isConfigured()) {
        try {
          const orgs = await ninjaone.getOrganizations();
          const org = orgs.find((o) => o.id === orgId);
          if (org) orgName = org.name;
        } catch (e) {
          log(`Could not fetch org name from NinjaOne: ${e}`);
        }
      }
      const security = await huntress.getSecuritySummary(orgName);
      res.json(security);
    } catch (err: any) {
      log(`Security error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tickets/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!connectwise.isConfigured()) {
        return res.status(503).json({ message: "ConnectWise is not configured" });
      }
      const orgId = parseInt(req.params.orgId as string);
      let orgName = `Organization ${orgId}`;
      if (ninjaone.isConfigured()) {
        try {
          const orgs = await ninjaone.getOrganizations();
          const org = orgs.find((o) => o.id === orgId);
          if (org) orgName = org.name;
        } catch (e) {
          log(`Could not fetch org name from NinjaOne: ${e}`);
        }
      }
      const tickets = await connectwise.getTicketSummary(orgName);
      res.json(tickets);
    } catch (err: any) {
      log(`Tickets error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(
    "/api/reports/mfa",
    requireAuth,
    upload.single("file"),
    (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const csvText = req.file.buffer.toString("utf-8");
        const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });

        if (result.errors.length > 0) {
          return res.status(400).json({ message: "Invalid CSV format" });
        }

        const rows = result.data as any[];
        const headers = Object.keys(rows[0] || {}).map((h) => h.toLowerCase().trim());

        const nameKey = findKey(headers, ["displayname", "display name", "name", "user", "username", "userprincipalname"]);
        const emailKey = findKey(headers, ["email", "mail", "userprincipalname", "emailaddress", "email address"]);
        const mfaKey = findKey(headers, [
          "mfa", "mfastatus", "mfa status", "mfaenabled", "mfa enabled",
          "strongauthenticationmethods", "strong authentication",
          "peruser mfa", "per-user mfa", "isregistered", "is registered",
          "registeredforconditionalaccess", "ismfaregistered",
        ]);

        if (!nameKey && !emailKey) {
          return res.status(400).json({
            message: "CSV must contain a Name or Email column",
          });
        }

        let totalUsers = 0;
        let mfaEnabledCount = 0;
        const usersWithoutMfa: MfaReport["usersWithoutMfa"] = [];

        for (const row of rows) {
          const rawRow: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            rawRow[k.toLowerCase().trim()] = String(v || "").trim();
          }

          const displayName = nameKey ? rawRow[nameKey] : "";
          const email = emailKey ? rawRow[emailKey] : "";

          if (!displayName && !email) continue;
          totalUsers++;

          let hasMfa = false;
          if (mfaKey) {
            const val = rawRow[mfaKey].toLowerCase();
            hasMfa =
              val === "true" ||
              val === "yes" ||
              val === "enabled" ||
              val === "enforced" ||
              val === "registered" ||
              (val !== "" && val !== "false" && val !== "no" && val !== "disabled" && val !== "none" && val !== "0");
          }

          if (hasMfa) {
            mfaEnabledCount++;
          } else {
            usersWithoutMfa.push({
              displayName: displayName || email,
              email: email || "",
              mfaEnabled: false,
            });
          }
        }

        const report: MfaReport = {
          totalUsers,
          mfaEnabledCount,
          mfaDisabledCount: totalUsers - mfaEnabledCount,
          usersWithoutMfa,
        };

        res.json(report);
      } catch (err: any) {
        log(`MFA report error: ${err.message}`);
        res.status(500).json({ message: "Failed to process MFA report" });
      }
    }
  );

  app.post(
    "/api/reports/license",
    requireAuth,
    upload.single("file"),
    (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const csvText = req.file.buffer.toString("utf-8");
        const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });

        if (result.errors.length > 0) {
          return res.status(400).json({ message: "Invalid CSV format" });
        }

        const rows = result.data as any[];
        const headers = Object.keys(rows[0] || {}).map((h) => h.toLowerCase().trim());

        const nameKey = findKey(headers, ["license", "licensename", "license name", "skuname", "sku name", "skupartnumber", "product", "productname", "product name"]);
        const assignedKey = findKey(headers, ["assigned", "total", "purchased", "quantity", "consumed", "consumedunits", "consumed units", "activeunits", "active units", "prepaidunits"]);
        const usedKey = findKey(headers, ["used", "inuse", "in use", "active", "activeusers", "active users", "assignedunits"]);

        if (!nameKey) {
          return res.status(400).json({
            message: "CSV must contain a License Name column",
          });
        }

        const licenses: LicenseReport["licenses"] = [];
        let totalWasted = 0;

        for (const row of rows) {
          const rawRow: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            rawRow[k.toLowerCase().trim()] = String(v || "").trim();
          }

          const licenseName = rawRow[nameKey];
          if (!licenseName) continue;

          const quantityAssigned = parseInt(rawRow[assignedKey || ""] || "0") || 0;
          const quantityUsed = parseInt(rawRow[usedKey || ""] || "0") || 0;
          const wasted = Math.max(0, quantityAssigned - quantityUsed);
          totalWasted += wasted;

          licenses.push({ licenseName, quantityAssigned, quantityUsed, wasted });
        }

        const report: LicenseReport = { licenses, totalWasted };
        res.json(report);
      } catch (err: any) {
        log(`License report error: ${err.message}`);
        res.status(500).json({ message: "Failed to process license report" });
      }
    }
  );

  app.post("/api/roadmap/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientName, deviceHealth, security, tickets, mfaReport, licenseReport } = req.body;

      if (!clientName) {
        return res.status(400).json({ message: "Client name is required" });
      }

      const result = await roadmap.generateRoadmap(clientName, {
        deviceHealth,
        security,
        tickets,
        mfaReport,
        licenseReport,
      });

      res.json(result);
    } catch (err: any) {
      log(`Roadmap generation error: ${err.message}`);
      res.status(500).json({ message: "Failed to generate roadmap" });
    }
  });

  app.post("/api/export/summary", requireAuth, (req: Request, res: Response) => {
    try {
      const html = generateSummaryHtml(req.body);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      log(`Export error: ${err.message}`);
      res.status(500).json({ message: "Failed to generate export" });
    }
  });

  return httpServer;
}

function findKey(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = headers.find((h) => h === c || h.replace(/[\s_-]/g, "") === c.replace(/[\s_-]/g, ""));
    if (found) return found;
  }
  return null;
}
