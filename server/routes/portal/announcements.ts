import type { Express, Request, Response } from "express";
import { storage } from "../../storage";

export function registerPortalAnnouncementRoutes(app: Express) {
  app.get("/api/portal/announcements", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const clientId = (req as any).clientId as number;

      const items = await storage.getPublishedAnnouncements(tenantId, clientId);
      res.json(items.filter(a => a.type === "announcement" || a.type === "alert"));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portal/kb", async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as number;
      const clientId = (req as any).clientId as number;

      const items = await storage.getPublishedAnnouncements(tenantId, clientId);
      res.json(items.filter(a => a.type === "kb" || a.type === "service_guide"));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
