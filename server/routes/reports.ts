import type { Express, Request, Response } from "express";
import multer from "multer";
import Papa from "papaparse";
import * as roadmap from "../services/roadmap";
import { generateSummaryHtml } from "../services/export";
import { storage } from "../storage";
import { log } from "../index";
import type { MfaReport, LicenseReport } from "@shared/schema";
import { requireAuth, requireEditor } from "../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function registerReportRoutes(app: Express) {
  app.post("/api/projects/summarize", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const { clientName, completed, inProgress } = req.body;
      if (!clientName) {
        return res.status(400).json({ message: "Client name is required" });
      }

      const { generateProjectSummary } = await import("../services/roadmap.js");
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
}
