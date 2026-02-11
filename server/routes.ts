import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import multer from "multer";
import Papa from "papaparse";
import * as ninjaone from "./services/ninjaone";
import * as huntress from "./services/huntress";
import * as connectwise from "./services/connectwise";
import * as roadmap from "./services/roadmap";
import { generateSummaryHtml } from "./services/export";
import { log } from "./index";
import type { MfaReport, LicenseReport, SecuritySummary, TicketSummary, DeviceHealthSummary } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const validTokens = new Set<string>();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (validTokens.has(token)) {
      return next();
    }
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { password } = req.body;
    const dashboardPassword = process.env.DASHBOARD_PASSWORD;

    if (!dashboardPassword) {
      return res.status(500).json({ message: "Dashboard password not configured" });
    }

    if (password === dashboardPassword) {
      const token = crypto.randomBytes(32).toString("hex");
      validTokens.add(token);
      res.json({ success: true, token });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });

  app.get("/api/auth/check", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (validTokens.has(token)) {
        return res.json({ authenticated: true });
      }
    }
    res.status(401).json({ authenticated: false });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      validTokens.delete(authHeader.slice(7));
    }
    res.json({ success: true });
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
        return res.status(400).json({ message: "NinjaOne is not configured" });
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
      const orgId = parseInt(req.params.orgId);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }

      if (!ninjaone.isConfigured()) {
        return res.json({
          totalDevices: 0,
          workstations: 0,
          servers: 0,
          oldDevices: [],
          eolOsDevices: [],
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

  app.get("/api/security/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId);
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

  app.get("/api/tickets/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId);
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

  app.post("/api/reports/mfa", requireAuth, upload.single("file"), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        log(`MFA CSV parse warnings: ${JSON.stringify(parsed.errors.slice(0, 3))}`);
      }

      const isYes = (val: string | undefined | null): boolean => {
        if (!val) return false;
        return ["yes", "true", "1"].includes(val.toString().trim().toLowerCase());
      };

      const allRows = parsed.data as any[];
      const activeUsers = allRows.filter((row: any) => {
        const email = row["User Principal Name"] || row["userPrincipalName"] || row["email"] || row["Email"] || "";
        if (!email) return false;
        const accountEnabled = row["Account Enabled"] || row["accountEnabled"] || "";
        const isLicensed = row["isLicensed"] || row["IsLicensed"] || row["Is Licensed"] || "";
        return isYes(accountEnabled) && isYes(isLicensed);
      });

      const users = activeUsers.map((row: any) => {
        const email = row["User Principal Name"] || row["userPrincipalName"] || row["email"] || row["Email"] || "";
        const displayName = row["Display Name"] || row["displayName"] || row["name"] || row["Name"] || "";

        const coveredByCA = isYes(row["CoveredByCA"] || row["coveredByCA"] || row["Covered By CA"] || "");
        const coveredBySD = isYes(row["CoveredBySD"] || row["coveredBySD"] || row["Covered By SD"] || "");
        const perUserRaw = (row["PerUser"] || row["perUser"] || row["Per User"] || row["Per User MFA"] || "").toString().trim().toLowerCase();
        const perUserEnabled = ["enabled", "enforced"].includes(perUserRaw);

        const isCovered = perUserEnabled || coveredByCA || coveredBySD;
        let coverageMethod: "perUser" | "conditionalAccess" | "securityDefaults" | null = null;
        if (coveredByCA) coverageMethod = "conditionalAccess";
        else if (coveredBySD) coverageMethod = "securityDefaults";
        else if (perUserEnabled) coverageMethod = "perUser";

        return {
          displayName,
          email,
          perUserMfa: perUserRaw || "disabled",
          coveredByCA,
          coveredBySD,
          isCovered,
          coverageMethod,
        };
      });

      const coveredCount = users.filter((u: any) => u.isCovered).length;
      const uncoveredUsers = users.filter((u: any) => !u.isCovered);

      const report: MfaReport = {
        totalUsers: users.length,
        coveredCount,
        uncoveredCount: uncoveredUsers.length,
        coveredByPerUser: users.filter((u: any) => ["enabled", "enforced"].includes(u.perUserMfa)).length,
        coveredByCA: users.filter((u: any) => u.coveredByCA).length,
        coveredBySD: users.filter((u: any) => u.coveredBySD).length,
        uncoveredUsers,
      };

      res.json(report);
    } catch (err: any) {
      log(`MFA report error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/reports/license", requireAuth, upload.single("file"), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        log(`License CSV parse warnings: ${JSON.stringify(parsed.errors.slice(0, 3))}`);
      }

      const licenses = parsed.data.map((row: any) => {
        const licenseName = row["Product Name"] || row["productName"] || row["Product"] || row["License"] || "";
        const quantityAssigned = parseInt(row["Assigned"] || row["assignedCount"] || row["Purchased"] || row["Total"] || "0") || 0;
        const quantityUsed = parseInt(row["Used"] || row["quantityUsed"] || row["Active"] || "0") || 0;
        const wasted = Math.max(0, quantityAssigned - quantityUsed);
        return { licenseName, quantityAssigned, quantityUsed, wasted };
      }).filter((l: any) => l.licenseName);

      const report: LicenseReport = {
        licenses,
        totalWasted: licenses.reduce((sum: number, l: any) => sum + l.wasted, 0),
      };

      res.json(report);
    } catch (err: any) {
      log(`License report error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/roadmap/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientName, ...data } = req.body;
      const analysis = await roadmap.generateRoadmap(clientName || "Client", data);
      res.json(analysis);
    } catch (err: any) {
      log(`Roadmap error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/export/summary", requireAuth, (req: Request, res: Response) => {
    try {
      const html = generateSummaryHtml(req.body);
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err: any) {
      log(`Export error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
