import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin, requireEditor } from "../middleware/auth";

export function registerAnnouncementRoutes(app: Express) {
  app.get("/api/announcements", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as number ?? 1;
      const items = await storage.getAllAnnouncements(tenantId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/announcements", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as number ?? 1;
      const user = (req as any).user;
      const { title, body, type = "announcement", clientId = null, publishedAt = null, expiresAt = null } = req.body;

      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ message: "Title and body are required" });
      }

      const item = await storage.createAnnouncement({
        tenantId,
        title: title.trim(),
        body: body.trim(),
        type,
        clientId: clientId ?? null,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: user.userId,
      });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/announcements/:id/publish", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const item = await storage.updateAnnouncement(id, { publishedAt: new Date() });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/announcements/:id", requireAuth, requireEditor, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { title, body, type, clientId, publishedAt, expiresAt } = req.body;
      const item = await storage.updateAnnouncement(id, {
        ...(title != null && { title }),
        ...(body != null && { body }),
        ...(type != null && { type }),
        ...(clientId !== undefined && { clientId: clientId ?? null }),
        ...(publishedAt !== undefined && { publishedAt: publishedAt ? new Date(publishedAt) : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/announcements/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteAnnouncement(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
