import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin, requireEditor } from "../middleware/auth";

export function registerPortalManagementRoutes(app: Express) {
  // List clients with portal status
  app.get("/api/portal-management/clients", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId as number ?? 1;
      const clients = await storage.getAllClientsByTenant(tenantId);
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Enable/disable portal for a client
  app.patch("/api/portal-management/clients/:id/portal", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });
      const { enabled, settings } = req.body;

      const updated = await storage.updateClient(id, {
        portalEnabled: enabled ? "true" : "false",
        ...(settings != null && { portalSettings: settings }),
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update portal settings for a client
  app.patch("/api/portal-management/clients/:id/portal-settings", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });
      const updated = await storage.updateClient(id, { portalSettings: req.body });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // List portal users for a client
  app.get("/api/portal-management/clients/:id/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid client ID" });
      const portalUsers = await storage.getPortalUsersByClientId(id);
      res.json(portalUsers.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        authProvider: u.authProvider,
        createdAt: u.createdAt,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Set a portal user's role (client_user or client_admin)
  app.patch("/api/portal-management/users/:userId/role", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId as string);
      if (isNaN(userId)) return res.status(400).json({ message: "Invalid user ID" });
      const { role } = req.body;
      if (!["client_user", "client_admin"].includes(role)) {
        return res.status(400).json({ message: "Role must be client_user or client_admin" });
      }
      const updated = await storage.updateUser(userId, { role });
      res.json({ id: updated.id, email: updated.email, role: updated.role });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
