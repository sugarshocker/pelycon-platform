import type { Express, Request, Response } from "express";
import multer from "multer";
import Papa from "papaparse";
import { log } from "../index";
import { storage } from "../storage";
import { requireAuth, requireEditor } from "../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function registerStagingRoutes(app: Express) {
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
      const { orgId, orgName, engineerNotes, serviceManagerNotes, warrantyData } = req.body;
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
        warrantyData: warrantyData ?? (existing as any)?.warrantyData ?? null,
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
}
