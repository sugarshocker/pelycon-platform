import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import multer from "multer";
import Papa from "papaparse";
import bcrypt from "bcryptjs";
import * as ninjaone from "./services/ninjaone";
import * as huntress from "./services/huntress";
import * as connectwise from "./services/connectwise";
import * as roadmap from "./services/roadmap";
import { generateSummaryHtml } from "./services/export";
import { isEmailConfigured, sendReminderEmail } from "./services/email";
import { log } from "./index";
import { insertTbrSnapshotSchema, insertTbrScheduleSchema, insertTbrStagingSchema, loginUserSchema, createUserSchema } from "@shared/schema";
import type { MfaReport, LicenseReport, SecuritySummary, TicketSummary, DeviceHealthSummary, InsertTbrSnapshot } from "@shared/schema";
import { storage } from "./storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

interface TokenSession {
  userId: number;
  email: string;
  displayName: string;
  role: string;
}

const tokenSessions = new Map<string, TokenSession>();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const session = tokenSessions.get(token);
    if (session) {
      (req as any).user = session;
      return next();
    }
  }
  res.status(401).json({ message: "Unauthorized" });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as TokenSession | undefined;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function requireEditor(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as TokenSession | undefined;
  if (!user || (user.role !== "admin" && user.role !== "editor")) {
    return res.status(403).json({ message: "Editor access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Valid email and password required" });
      }

      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      tokenSessions.set(token, {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
      res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      });
    } catch (err: any) {
      log(`Login error: ${err.message}`);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/check", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const session = tokenSessions.get(token);
      if (session) {
        return res.json({ authenticated: true, user: session });
      }
    }
    res.status(401).json({ authenticated: false });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      tokenSessions.delete(authHeader.slice(7));
    }
    res.json({ success: true });
  });

  app.get("/api/users", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const sanitized = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
      }));
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const user = await storage.createUser({
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash,
        role: parsed.data.role,
      });

      res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ message: "User not found" });

      const updates: any = {};
      if (req.body.email) updates.email = req.body.email;
      if (req.body.displayName) updates.displayName = req.body.displayName;
      if (req.body.role) updates.role = req.body.role;
      if (req.body.password) {
        updates.passwordHash = await bcrypt.hash(req.body.password, 10);
      }

      const user = await storage.updateUser(id, updates);
      res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      const currentUser = (req as any).user as TokenSession;
      if (currentUser.userId === id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/setup", async (req: Request, res: Response) => {
    try {
      const count = await storage.getUserCount();
      if (count > 0) {
        return res.status(400).json({ message: "Initial setup already completed" });
      }

      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const user = await storage.createUser({
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash,
        role: "admin",
      });

      const token = crypto.randomBytes(32).toString("hex");
      tokenSessions.set(token, {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
      res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/needs-setup", async (_req: Request, res: Response) => {
    try {
      const count = await storage.getUserCount();
      res.json({ needsSetup: count === 0 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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

  app.post("/api/projects/summarize", requireAuth, requireEditor, async (req: Request, res: Response) => {
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

  app.post("/api/reports/mfa", requireAuth, requireEditor, upload.single("file"), (req: Request, res: Response) => {
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
        allUsers: users,
      };

      res.json(report);
    } catch (err: any) {
      log(`MFA report error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/reports/license", requireAuth, requireEditor, upload.single("file"), (req: Request, res: Response) => {
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

  app.post("/api/reports/process-staging", requireAuth, requireEditor, (req: Request, res: Response) => {
    try {
      const { mfaReportData, licenseReportData } = req.body;
      const result: any = {};

      if (mfaReportData?.rawRows) {
        const getCol = (row: any, ...keys: string[]): string => {
          for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key].toString().trim();
          }
          return "";
        };
        const isYes = (val: string): boolean => ["yes", "true", "1"].includes(val.toLowerCase());
        const isCACovered = (val: string): boolean => {
          const lower = val.toLowerCase();
          if (["not enforced", "no", "false", "0", ""].includes(lower)) return false;
          return lower.includes("enforced") || isYes(val);
        };
        const isSDCovered = (val: string): boolean => isYes(val);

        const allRows = mfaReportData.rawRows as any[];
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
          return { displayName, email, perUserMfa: perUserRaw, coveredByCA, coveredBySD, isCovered, coverageMethod };
        });

        const coveredCount = users.filter((u: any) => u.isCovered).length;
        const uncoveredUsers = users.filter((u: any) => !u.isCovered);
        result.mfaReport = {
          totalUsers: users.length,
          coveredCount,
          uncoveredCount: uncoveredUsers.length,
          coveredByPerUser: users.filter((u: any) => ["enabled", "enforced"].includes(u.perUserMfa)).length,
          coveredByCA: users.filter((u: any) => u.coveredByCA).length,
          coveredBySD: users.filter((u: any) => u.coveredBySD).length,
          uncoveredUsers,
          allUsers: users,
        };
      }

      if (licenseReportData?.rawRows) {
        const MSRP_PRICES: Record<string, number> = {
          "microsoft 365 business basic": 6.00, "microsoft 365 business standard": 12.50,
          "microsoft 365 business premium": 22.00, "microsoft 365 apps for business": 8.25,
          "microsoft 365 e3": 36.00, "microsoft 365 e5": 57.00,
          "microsoft 365 f1": 2.25, "microsoft 365 f3": 8.00,
          "office 365 e1": 10.00, "office 365 e3": 23.00, "office 365 e5": 38.00,
          "exchange online (plan 1)": 4.00, "exchange online (plan 2)": 8.00,
          "exchange online kiosk": 2.00, "microsoft teams audio conferencing with dial-out to usa/can": 4.00,
          "microsoft teams essentials": 4.00, "microsoft defender for business": 3.00,
          "microsoft defender for endpoint plan 1": 3.00, "microsoft defender for endpoint plan 2": 5.20,
          "microsoft defender for office 365 plan 1": 2.00, "microsoft defender for office 365 plan 2": 5.00,
          "microsoft intune plan 1": 8.00, "azure ad premium p1": 6.00, "azure ad premium p2": 9.00,
          "entra id p1": 6.00, "entra id p2": 9.00, "power bi pro": 10.00, "power bi premium per user": 20.00,
          "visio plan 1": 5.00, "visio plan 2": 15.00, "project plan 1": 10.00,
          "project plan 3": 30.00, "project plan 5": 55.00, "microsoft copilot": 30.00,
          "azure information protection plan 1": 2.00, "azure information protection premium p1": 2.00,
          "azure information protection premium p2": 5.00,
        };
        const FREE_SKUS = [
          "rights management adhoc", "rights management service basic content protection",
          "common area phone", "microsoft power automate free",
          "microsoft power apps plan 2 trial", "azure active directory free",
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
        const getCol = (row: any, ...keys: string[]): string => {
          for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key].toString().trim();
          }
          return "";
        };

        const allRows = licenseReportData.rawRows as any[];
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
        result.licenseReport = {
          licenses,
          totalWasted,
          totalMonthlyWaste: Math.round(totalMonthlyWaste * 100) / 100,
          totalAnnualWaste: Math.round(totalMonthlyWaste * 12 * 100) / 100,
        };
      }

      res.json(result);
    } catch (err: any) {
      log(`Process staging report error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/roadmap/generate", requireAuth, requireEditor, async (req: Request, res: Response) => {
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

  app.post("/api/tbr/save-draft", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName, scheduleId, reviewDate } = req.body;
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
        deviceUserInventory: req.body.deviceUserInventory || null,
      };

      const existingDraft = await storage.getDraftByOrg(orgId);

      if (existingDraft) {
        const result = await storage.updateTbrSnapshot(existingDraft.id, {
          ...metrics,
          status: "draft",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : existingDraft.scheduleId,
          reviewDate: reviewDate || existingDraft.reviewDate || null,
        });
        log(`TBR draft updated for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}`);
        res.json(result);
      } else {
        const snapshotData = {
          ...metrics,
          status: "draft",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : null,
          reviewDate: reviewDate || null,
        };
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

  app.get("/api/tbr/drafts", requireAuth, async (_req: Request, res: Response) => {
    try {
      const drafts = await storage.getAllDrafts();
      res.json(drafts);
    } catch (err: any) {
      log(`Get all drafts error: ${err.message}`);
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

  app.delete("/api/tbr/draft/:id", requireAuth, requireEditor, async (req: Request, res: Response) => {
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

  app.post("/api/tbr/finalize", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName, scheduleId, reviewDate } = req.body;
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
        deviceUserInventory: req.body.deviceUserInventory || null,
      };

      const existingDraft = await storage.getDraftByOrg(orgId);

      let result;
      if (existingDraft) {
        result = await storage.updateTbrSnapshot(existingDraft.id, {
          ...metrics,
          status: "finalized",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : existingDraft.scheduleId,
          reviewDate: reviewDate || existingDraft.reviewDate || null,
        });
      } else {
        const snapshotData = {
          ...metrics,
          status: "finalized",
          fullData,
          scheduleId: scheduleId ? parseInt(scheduleId) : null,
          reviewDate: reviewDate || null,
        };
        const parsed = insertTbrSnapshotSchema.safeParse(snapshotData);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid snapshot data", errors: parsed.error.flatten().fieldErrors });
        }
        result = await storage.createTbrSnapshot(parsed.data);
      }

      if (result.scheduleId) {
        try {
          const schedule = await storage.getScheduleByOrg(orgId);
          if (schedule && schedule.id === result.scheduleId) {
            const now = new Date();
            const nextDate = new Date(now);
            nextDate.setMonth(nextDate.getMonth() + schedule.frequencyMonths);
            await storage.upsertSchedule({
              orgId: schedule.orgId,
              orgName: schedule.orgName,
              frequencyMonths: schedule.frequencyMonths,
              nextReviewDate: nextDate,
              lastReviewDate: now,
              notes: schedule.notes,
              reminderEmail: schedule.reminderEmail,
            });
            log(`Schedule ${schedule.id} updated: lastReviewDate=${now.toISOString()}, nextReviewDate=${nextDate.toISOString()}`);
          }
        } catch (schedErr: any) {
          log(`Warning: Failed to update schedule after finalization: ${schedErr.message}`);
        }
      }

      log(`TBR finalized for ${orgName} (orgId: ${orgId}), snapshot ID: ${result.id}, scheduleId: ${result.scheduleId || 'none'}`);
      res.json(result);
    } catch (err: any) {
      log(`TBR finalize error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/connectwise/ticket", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { snapshotId, companyName, followUpTasks, tbrDate } = req.body;
      if (!companyName || !followUpTasks || !Array.isArray(followUpTasks) || followUpTasks.length === 0) {
        return res.status(400).json({ message: "companyName and followUpTasks are required" });
      }
      if (!connectwise.isConfigured()) {
        return res.status(503).json({ message: "ConnectWise is not configured" });
      }

      const result = await connectwise.createFollowUpTicket(companyName, followUpTasks, tbrDate || new Date().toISOString().split("T")[0]);

      if (snapshotId) {
        await storage.updateTbrSnapshot(snapshotId, { cwTicketId: result.ticketId });
        log(`Saved CW ticket #${result.ticketId} to snapshot ${snapshotId}`);
      }

      res.json(result);
    } catch (err: any) {
      log(`ConnectWise ticket creation error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tbr/unfinalize/:id", requireAuth, requireEditor, async (req: Request, res: Response) => {
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

  app.get("/api/schedules", requireAuth, async (_req: Request, res: Response) => {
    try {
      const schedules = await storage.getAllSchedules();
      res.json(schedules);
    } catch (err: any) {
      log(`Schedules list error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/schedules/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid org ID" });
      const schedule = await storage.getScheduleByOrg(orgId);
      res.json({ schedule: schedule || null });
    } catch (err: any) {
      log(`Schedule get error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/schedules", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName, frequencyMonths, nextReviewDate, notes, reminderEmail } = req.body;
      if (!orgId || !orgName) return res.status(400).json({ message: "Org ID and name required" });
      const schedule = await storage.upsertSchedule({
        orgId,
        orgName,
        frequencyMonths: frequencyMonths || 6,
        nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
        lastReviewDate: null,
        notes: notes || null,
        reminderEmail: reminderEmail || null,
      });
      log(`Schedule upserted for ${orgName} (orgId: ${orgId})`);
      res.json(schedule);
    } catch (err: any) {
      log(`Schedule upsert error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/schedules/:id", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid schedule ID" });
      await storage.deleteSchedule(id);
      res.json({ success: true });
    } catch (err: any) {
      log(`Schedule delete error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reminders/status", requireAuth, async (_req: Request, res: Response) => {
    try {
      const configured = isEmailConfigured();
      const dueSchedules = await storage.getSchedulesDueForReminder(2);
      res.json({
        emailConfigured: configured,
        pendingReminders: dueSchedules.length,
        provider: "smtp2go",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/reminders/send-now", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const dueSchedules = await storage.getSchedulesDueForReminder(2);
      if (dueSchedules.length === 0) {
        return res.json({ sent: 0, message: "No reminders due" });
      }
      let sent = 0;
      for (const schedule of dueSchedules) {
        if (!schedule.reminderEmail || !schedule.nextReviewDate) continue;
        const success = await sendReminderEmail({
          to: schedule.reminderEmail,
          orgName: schedule.orgName,
          reviewDate: new Date(schedule.nextReviewDate),
          notes: schedule.notes,
        });
        if (success) {
          await storage.markReminderSent(schedule.id);
          sent++;
        }
      }
      res.json({ sent, total: dueSchedules.length });
    } catch (err: any) {
      log(`Manual reminder send error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tbr/all-finalized", requireAuth, async (_req: Request, res: Response) => {
    try {
      const snapshots = await storage.getAllFinalizedSnapshots();
      res.json(snapshots);
    } catch (err: any) {
      log(`All finalized snapshots error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/staging", requireAuth, async (_req: Request, res: Response) => {
    try {
      const all = await storage.getAllStaging();
      res.json(all);
    } catch (err: any) {
      log(`Staging list error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/staging/:orgId", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = parseInt(req.params.orgId as string);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid org ID" });
      const staging = await storage.getStagingByOrg(orgId);
      res.json({ staging: staging || null });
    } catch (err: any) {
      log(`Staging get error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/staging/save", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { orgId, orgName, engineerNotes, serviceManagerNotes } = req.body;
      if (!orgId || !orgName) return res.status(400).json({ message: "Org ID and name required" });
      const existing = await storage.getStagingByOrg(orgId);
      const staging = await storage.upsertStaging({
        orgId,
        orgName,
        engineerNotes: engineerNotes ?? (existing as any)?.engineerNotes ?? null,
        serviceManagerNotes: serviceManagerNotes ?? (existing as any)?.serviceManagerNotes ?? null,
        mfaReportData: (existing as any)?.mfaReportData ?? null,
        licenseReportData: (existing as any)?.licenseReportData ?? null,
        mfaFileName: (existing as any)?.mfaFileName ?? null,
        licenseFileName: (existing as any)?.licenseFileName ?? null,
      });
      log(`Staging notes saved for ${orgName} (orgId: ${orgId})`);
      res.json(staging);
    } catch (err: any) {
      log(`Staging save error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/staging/upload-mfa", requireAuth, requireEditor, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const orgId = parseInt(req.body.orgId);
      const orgName = req.body.orgName;
      if (!orgId || !orgName) return res.status(400).json({ message: "Org ID and name required" });

      const csvText = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });

      const existing = await storage.getStagingByOrg(orgId);
      const staging = await storage.upsertStaging({
        orgId,
        orgName,
        engineerNotes: (existing as any)?.engineerNotes ?? null,
        serviceManagerNotes: (existing as any)?.serviceManagerNotes ?? null,
        mfaReportData: { rawRows: parsed.data, headers: parsed.meta.fields },
        licenseReportData: (existing as any)?.licenseReportData ?? null,
        mfaFileName: req.file.originalname,
        licenseFileName: (existing as any)?.licenseFileName ?? null,
      });
      log(`Staging MFA CSV uploaded for ${orgName} (${parsed.data.length} rows)`);
      res.json(staging);
    } catch (err: any) {
      log(`Staging MFA upload error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/staging/upload-license", requireAuth, requireEditor, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const orgId = parseInt(req.body.orgId);
      const orgName = req.body.orgName;
      if (!orgId || !orgName) return res.status(400).json({ message: "Org ID and name required" });

      const csvText = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });

      const existing = await storage.getStagingByOrg(orgId);
      const staging = await storage.upsertStaging({
        orgId,
        orgName,
        engineerNotes: (existing as any)?.engineerNotes ?? null,
        serviceManagerNotes: (existing as any)?.serviceManagerNotes ?? null,
        mfaReportData: (existing as any)?.mfaReportData ?? null,
        licenseReportData: { rawRows: parsed.data, headers: parsed.meta.fields },
        mfaFileName: (existing as any)?.mfaFileName ?? null,
        licenseFileName: req.file.originalname,
      });
      log(`Staging License CSV uploaded for ${orgName} (${parsed.data.length} rows)`);
      res.json(staging);
    } catch (err: any) {
      log(`Staging License upload error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/staging/:id", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid staging ID" });
      await storage.deleteStaging(id);
      res.json({ success: true });
    } catch (err: any) {
      log(`Staging delete error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/accounts/sync", requireAuth, requireEditor, async (_req: Request, res: Response) => {
    try {
      if (!connectwise.isConfigured()) {
        return res.status(503).json({ message: "ConnectWise is not configured" });
      }

      const cwClients = await connectwise.getManagedServicesClients();
      log(`Found ${cwClients.length} managed services clients from ConnectWise agreements`);

      const results = [];
      for (const client of cwClients) {
        let financials: any = { agreementRevenue: client.agreementMonthlyRevenue * 12, projectRevenue: 0, totalRevenue: client.agreementMonthlyRevenue * 12, grossMarginPercent: null };
        try {
          financials = await connectwise.getCompanyFinancials(client.cwCompanyId);
        } catch (e: any) {
          log(`Skipping financials for ${client.companyName}: ${e.message}`);
        }

        const autoTier = financials.totalRevenue >= 60000 ? "A" : financials.totalRevenue >= 24000 ? "B" : "C";

        const account = await storage.upsertClientAccount({
          cwCompanyId: client.cwCompanyId,
          companyName: client.companyName,
          tier: autoTier,
          agreementRevenue: financials.agreementRevenue,
          projectRevenue: financials.projectRevenue,
          totalRevenue: financials.totalRevenue,
          grossMarginPercent: financials.grossMarginPercent,
          agreementTypes: client.agreementTypes.join(", "),
          lastSyncedAt: new Date(),
        });
        results.push(account);
      }

      res.json({ synced: results.length, accounts: results });
    } catch (err: any) {
      log(`Accounts sync error: ${err.message}`);
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

      const enriched = accounts.map((acct) => {
        const schedule = schedules.find(s => s.orgName.toLowerCase() === acct.companyName.toLowerCase());
        const snapshots = allFinalized
          .filter(s => s.orgName.toLowerCase() === acct.companyName.toLowerCase())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const lastTbr = snapshots[0] || null;
        const lastTbrDate = lastTbr ? (lastTbr.reviewDate || new Date(lastTbr.createdAt).toISOString().split("T")[0]) : null;
        const nextTbrDate = schedule?.nextReviewDate ? new Date(schedule.nextReviewDate).toISOString().split("T")[0] : null;
        const freq = schedule?.frequencyMonths || null;

        const hadRecentTbr = lastTbr && new Date(lastTbr.createdAt) > sixMonthsAgo;
        const hasScheduled = !!nextTbrDate;

        let tbrStatus: "green" | "yellow" | "red";
        let tbrStatusReason: string;

        if (hadRecentTbr && hasScheduled) {
          tbrStatus = "green";
          tbrStatusReason = "On track";
        } else if (hadRecentTbr && !hasScheduled) {
          tbrStatus = "yellow";
          tbrStatusReason = "No next review scheduled";
        } else if (!hadRecentTbr && hasScheduled) {
          tbrStatus = "yellow";
          tbrStatusReason = "No recent review (>6 months)";
        } else if (snapshots.length > 0) {
          tbrStatus = "yellow";
          tbrStatusReason = "Overdue — no recent review or schedule";
        } else {
          tbrStatus = "red";
          tbrStatusReason = "Never reviewed — no TBR on record";
        }

        return {
          ...acct,
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

  return httpServer;
}
