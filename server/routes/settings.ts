import type { Express, Request, Response } from "express";
import { isEmailConfigured, sendReminderEmail } from "../services/email";
import { log } from "../index";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../middleware/auth";

export function registerSettingsRoutes(app: Express) {
  app.get("/api/app-settings", requireAuth, async (_req: Request, res: Response) => {
    try {
      const [smEmail, otherEmail] = await Promise.all([
        storage.getAppSetting("tbrEmailServiceManager"),
        storage.getAppSetting("tbrEmailOther"),
      ]);
      res.json({
        tbrEmailServiceManager: smEmail ?? "",
        tbrEmailOther: otherEmail ?? "",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/app-settings", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { tbrEmailServiceManager, tbrEmailOther } = req.body;
      await Promise.all([
        storage.setAppSetting("tbrEmailServiceManager", tbrEmailServiceManager ?? ""),
        storage.setAppSetting("tbrEmailOther", tbrEmailOther ?? ""),
      ]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
