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
import { insertTbrSnapshotSchema } from "@shared/schema";
import type { MfaReport, LicenseReport, SecuritySummary, TicketSummary, DeviceHealthSummary, InsertTbrSnapshot } from "@shared/schema";
import { storage } from "./storage";

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

  app.post("/api/projects/summarize", requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientName, completed, inProgress } = req.body;
      if (!clientName) {
        return res.status(400).json({ message: "Client name is required" });
      }

      const { generateProjectSummary } = await import("./services/roadmap");
      const summary = await generateProjectSummary(clientName, completed || [], inProgress || []);
      res.json({ summary });
    } catch (err: any) {
      log(`Project summary error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/reports/mfa", requireAuth, upload.single("file"), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });

      if (parsed.errors.length > 0) {
        log(`MFA CSV parse warnings: ${JSON.stringify(parsed.errors.slice(0, 3))}`);
      }

      const getCol = (row: any, ...keys: string[]): string => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key].toString().trim();
        }
        return "";
      };

      const isYes = (val: string): boolean => {
        return ["yes", "true", "1"].includes(val.toLowerCase());
      };

      const isCACovered = (val: string): boolean => {
        const lower = val.toLowerCase();
        if (["not enforced", "no", "false", "0", ""].includes(lower)) return false;
        return lower.includes("enforced") || isYes(val);
      };

      const isSDCovered = (val: string): boolean => {
        return isYes(val);
      };

      const allRows = parsed.data as any[];
      const activeUsers = allRows.filter((row: any) => {
        const email = getCol(row, "UPN", "User Principal Name", "userPrincipalName", "email", "Email");
        if (!email) return false;
        const accountEnabled = getCol(row, "AccountEnabled", "Account Enabled", "accountEnabled");
        const licensed = getCol(row, "isLicensed", "IsLicensed", "Is Licensed");
        return isYes(accountEnabled) && isYes(licensed);
      });

      const users = activeUsers.map((row: any) => {
        const email = getCol(row, "UPN", "User Principal Name", "userPrincipalName", "email", "Email");
        const displayName = getCol(row, "Display Name", "DisplayName", "displayName", "name", "Name") || email.split("@")[0];

        const caRaw = getCol(row, "CoveredByCA", "coveredByCA", "Covered By CA");
        const sdRaw = getCol(row, "CoveredBySD", "coveredBySD", "Covered By SD");
        const perUserRaw = getCol(row, "PerUser", "perUser", "Per User", "Per User MFA").toLowerCase() || "disabled";
        const perUserEnabled = ["enabled", "enforced"].includes(perUserRaw);

        const coveredByCA = isCACovered(caRaw);
        const coveredBySD = isSDCovered(sdRaw);

        const isCovered = perUserEnabled || coveredByCA || coveredBySD;
        let coverageMethod: "perUser" | "conditionalAccess" | "securityDefaults" | null = null;
        if (coveredByCA) coverageMethod = "conditionalAccess";
        else if (coveredBySD) coverageMethod = "securityDefaults";
        else if (perUserEnabled) coverageMethod = "perUser";

        return {
          displayName,
          email,
          perUserMfa: perUserRaw,
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

      const MSRP_PRICES: Record<string, number> = {
        "microsoft 365 business basic": 6.00,
        "microsoft 365 business standard": 12.50,
        "microsoft 365 business premium": 22.00,
        "microsoft 365 apps for business": 8.25,
        "microsoft 365 e3": 36.00,
        "microsoft 365 e5": 57.00,
        "microsoft 365 f1": 2.25,
        "microsoft 365 f3": 8.00,
        "office 365 e1": 10.00,
        "office 365 e3": 23.00,
        "office 365 e5": 38.00,
        "exchange online (plan 1)": 4.00,
        "exchange online (plan 2)": 8.00,
        "exchange online kiosk": 2.00,
        "azure information protection plan 1": 2.00,
        "azure information protection premium p1": 2.00,
        "azure information protection premium p2": 5.00,
        "power bi pro": 10.00,
        "power bi premium per user": 20.00,
        "microsoft teams audio conferencing with dial-out to usa/can": 4.00,
        "microsoft teams essentials": 4.00,
        "microsoft defender for business": 3.00,
        "microsoft defender for endpoint plan 1": 3.00,
        "microsoft defender for endpoint plan 2": 5.20,
        "microsoft defender for office 365 plan 1": 2.00,
        "microsoft defender for office 365 plan 2": 5.00,
        "microsoft intune plan 1": 8.00,
        "azure ad premium p1": 6.00,
        "azure ad premium p2": 9.00,
        "entra id p1": 6.00,
        "entra id p2": 9.00,
        "visio plan 1": 5.00,
        "visio plan 2": 15.00,
        "project plan 1": 10.00,
        "project plan 3": 30.00,
        "project plan 5": 55.00,
        "microsoft copilot": 30.00,
      };

      const FREE_SKUS = [
        "rights management adhoc",
        "rights management service basic content protection",
        "common area phone",
        "microsoft power automate free",
        "microsoft power apps plan 2 trial",
        "azure active directory free",
      ];

      const getMsrp = (name: string): number => {
        const lower = name.toLowerCase().trim();
        if (MSRP_PRICES[lower] !== undefined) return MSRP_PRICES[lower];
        for (const [key, price] of Object.entries(MSRP_PRICES)) {
          if (lower.includes(key) || key.includes(lower)) return price;
        }
        return 0;
      };

      const isFreesku = (name: string): boolean => {
        const lower = name.toLowerCase().trim();
        return FREE_SKUS.some(f => lower.includes(f));
      };

      const csvText = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });

      if (parsed.errors.length > 0) {
        log(`License CSV parse warnings: ${JSON.stringify(parsed.errors.slice(0, 3))}`);
      }

      const getCol = (row: any, ...keys: string[]): string => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key].toString().trim();
        }
        return "";
      };

      const allRows = parsed.data as any[];
      const licenses = allRows.map((row: any) => {
        const licenseName = getCol(row, "License", "Product Name", "productName", "Product", "SKU");
        const totalLicenses = parseInt(getCol(row, "TotalLicenses", "Total", "Purchased", "Assigned", "assignedCount") || "0") || 0;
        const quantityUsed = parseInt(getCol(row, "CountUsed", "Used", "quantityUsed", "Active") || "0") || 0;
        const quantityAvailable = parseInt(getCol(row, "CountAvailable", "Available") || "0") || 0;
        const wasted = quantityAvailable > 0 ? quantityAvailable : Math.max(0, totalLicenses - quantityUsed);
        const monthlyPricePerLicense = getMsrp(licenseName);
        const monthlyWastedCost = wasted * monthlyPricePerLicense;

        return { licenseName, totalLicenses, quantityUsed, quantityAvailable: wasted, wasted, monthlyPricePerLicense, monthlyWastedCost };
      }).filter((l: any) => l.licenseName && !isFreesku(l.licenseName));

      const totalWasted = licenses.reduce((sum: number, l: any) => sum + l.wasted, 0);
      const totalMonthlyWaste = licenses.reduce((sum: number, l: any) => sum + l.monthlyWastedCost, 0);

      const report: LicenseReport = {
        licenses,
        totalWasted,
        totalMonthlyWaste: Math.round(totalMonthlyWaste * 100) / 100,
        totalAnnualWaste: Math.round(totalMonthlyWaste * 12 * 100) / 100,
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

  function buildSnapshotMetrics(body: any) {
    const { orgId, orgName, deviceHealth, security, tickets, mfaReport, licenseReport, roadmap: roadmapData } = body;
    const mfaCoveragePct = mfaReport?.totalUsers > 0
      ? Math.round((mfaReport.coveredCount / mfaReport.totalUsers) * 100)
      : null;
    return {
      orgId,
      orgName,
      totalDevices: deviceHealth?.totalDevices ?? 0,
      workstations: deviceHealth?.workstations ?? 0,
      servers: deviceHealth?.servers ?? 0,
      needsReplacementCount: deviceHealth?.needsReplacementCount ?? 0,
      patchCompliancePercent: deviceHealth?.patchCompliancePercent ?? 100,
      pendingPatchCount: deviceHealth?.pendingPatchCount ?? 0,
      eolOsCount: deviceHealth?.eolOsDevices?.length ?? 0,
      staleDeviceCount: deviceHealth?.staleDevices?.length ?? 0,
      totalIncidents: security?.totalIncidents ?? 0,
      pendingIncidents: security?.pendingIncidents ?? 0,
      activeAgents: security?.activeAgents ?? 0,
      satLearnerCount: security?.satLearnerCount ?? null,
      satTotalUsers: security?.satTotalUsers ?? null,
      totalTickets: tickets?.totalTickets ?? 0,
      oldOpenTicketCount: tickets?.oldOpenTickets?.length ?? 0,
      mfaTotalUsers: mfaReport?.totalUsers ?? null,
      mfaCoveredCount: mfaReport?.coveredCount ?? null,
      mfaCoveragePercent: mfaCoveragePct,
      licenseTotalWasted: licenseReport?.totalWasted ?? null,
      licenseMonthlyWaste: licenseReport?.totalMonthlyWaste ?? null,
      licenseAnnualWaste: licenseReport?.totalAnnualWaste ?? null,
      roadmapItemCount: roadmapData?.items?.length ?? 0,
      urgentItemCount: roadmapData?.items?.filter((i: any) => i.priority === "urgent").length ?? 0,
    };
  }

  app.post("/api/tbr/save-draft", requireAuth, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName } = req.body;
      if (!orgId || !orgName) {
        return res.status(400).json({ message: "Organization ID and name are required" });
      }

      const metrics = buildSnapshotMetrics(req.body);
      const fullData = {
        deviceHealth: req.body.deviceHealth || null,
        security: req.body.security || null,
        tickets: req.body.tickets || null,
        mfaReport: req.body.mfaReport || null,
        licenseReport: req.body.licenseReport || null,
        roadmap: req.body.roadmap || null,
        internalNotes: req.body.internalNotes || null,
        clientFeedback: req.body.clientFeedback || null,
      };

      const existingDraft = await storage.getDraftByOrg(orgId);

      if (existingDraft) {
        const result = await storage.updateTbrSnapshot(existingDraft.id, {
          ...metrics,
          status: "draft",
          fullData,
        });
        log(`TBR draft updated for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}`);
        res.json(result);
      } else {
        const snapshotData = { ...metrics, status: "draft", fullData };
        const parsed = insertTbrSnapshotSchema.safeParse(snapshotData);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid snapshot data", errors: parsed.error.flatten().fieldErrors });
        }
        const result = await storage.createTbrSnapshot(parsed.data);
        log(`TBR draft saved for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}`);
        res.json(result);
      }
    } catch (err: any) {
      log(`TBR save draft error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/draft/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }
      const draft = await storage.getDraftByOrg(orgId);
      res.json({ draft: draft || null });
    } catch (err: any) {
      log(`TBR draft load error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/tbr/draft/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid draft ID" });
      }
      await storage.deleteTbrSnapshot(id);
      res.json({ success: true });
    } catch (err: any) {
      log(`TBR draft delete error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tbr/finalize", requireAuth, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName } = req.body;
      if (!orgId || !orgName) {
        return res.status(400).json({ message: "Organization ID and name are required" });
      }

      const metrics = buildSnapshotMetrics(req.body);
      const fullData = {
        deviceHealth: req.body.deviceHealth || null,
        security: req.body.security || null,
        tickets: req.body.tickets || null,
        mfaReport: req.body.mfaReport || null,
        licenseReport: req.body.licenseReport || null,
        roadmap: req.body.roadmap || null,
        internalNotes: req.body.internalNotes || null,
        clientFeedback: req.body.clientFeedback || null,
      };

      const existingDraft = await storage.getDraftByOrg(orgId);

      let result;
      if (existingDraft) {
        result = await storage.updateTbrSnapshot(existingDraft.id, {
          ...metrics,
          status: "finalized",
          fullData,
        });
      } else {
        const snapshotData = { ...metrics, status: "finalized", fullData };
        const parsed = insertTbrSnapshotSchema.safeParse(snapshotData);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid snapshot data", errors: parsed.error.flatten().fieldErrors });
        }
        result = await storage.createTbrSnapshot(parsed.data);
      }
      log(`TBR finalized for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}`);
      res.json(result);
    } catch (err: any) {
      log(`TBR finalize error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tbr/unfinalize/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }
      const snapshot = await storage.getTbrSnapshotById(id);
      if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      if (snapshot.status !== "finalized") {
        return res.status(400).json({ message: "Only finalized TBRs can be un-finalized" });
      }
      const existingDraft = await storage.getDraftByOrg(snapshot.orgId);
      if (existingDraft) {
        return res.status(409).json({ message: "A draft already exists for this client. Discard it first before un-finalizing a past review." });
      }
      const result = await storage.updateTbrSnapshot(id, { status: "draft" });
      log(`TBR un-finalized: snapshot ${id} for orgId ${snapshot.orgId}`);
      res.json(result);
    } catch (err: any) {
      log(`TBR un-finalize error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/export/snapshot/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }
      const snapshot = await storage.getTbrSnapshotById(id);
      if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      const fd = (snapshot.fullData as any) || {};
      const html = generateSummaryHtml({
        clientName: snapshot.orgName,
        deviceHealth: fd.deviceHealth || null,
        security: fd.security || null,
        tickets: fd.tickets || null,
        mfaReport: fd.mfaReport || null,
        licenseReport: fd.licenseReport || null,
        roadmap: fd.roadmap || null,
        previousSnapshot: null,
        deviceUserInventory: fd.deviceUserInventory || null,
      });
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (err: any) {
      log(`Snapshot export error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/history/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }
      const snapshots = await storage.getFinalizedSnapshotsByOrg(orgId);
      res.json(snapshots);
    } catch (err: any) {
      log(`TBR history error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/snapshot/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }
      const snapshot = await storage.getTbrSnapshotById(id);
      if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      res.json(snapshot);
    } catch (err: any) {
      log(`TBR snapshot error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/latest/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) {
        return res.status(400).json({ message: "Invalid organization ID" });
      }
      const latest = await storage.getLatestTbrSnapshot(orgId);
      const previous = await storage.getPreviousTbrSnapshot(orgId);
      res.json({ latest: latest || null, previous: previous || null });
    } catch (err: any) {
      log(`TBR latest error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
