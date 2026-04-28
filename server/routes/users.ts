import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { createUserSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, requireAdmin, tokenSessions, type TokenSession } from "../middleware/auth";

export function registerUserRoutes(app: Express) {
  app.get("/api/users", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const sanitized = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        pageAccess: u.pageAccess,
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
        pageAccess: req.body.pageAccess || null,
      });

      res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        pageAccess: user.pageAccess,
        createdAt: user.createdAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      const existing = await storage.getUserById(id);
      if (!existing) return res.status(404).json({ message: "User not found" });

      const currentUser = (req as any).user as TokenSession;
      if (currentUser.userId === id && req.body.role && req.body.role !== "admin" && existing.role === "admin") {
        return res.status(400).json({ message: "You cannot remove your own admin role" });
      }

      const updates: any = {};
      if (req.body.email) updates.email = req.body.email;
      if (req.body.displayName) updates.displayName = req.body.displayName;
      if (req.body.role) updates.role = req.body.role;
      if (req.body.password) {
        updates.passwordHash = await bcrypt.hash(req.body.password, 10);
      }
      if (req.body.pageAccess !== undefined) updates.pageAccess = req.body.pageAccess;

      const user = await storage.updateUser(id, updates);

      for (const [token, session] of tokenSessions.entries()) {
        if (session.userId === id) {
          session.email = user.email;
          session.displayName = user.displayName;
          session.role = user.role;
          session.pageAccess = user.pageAccess as Record<string, boolean> | null;
        }
      }

      res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        pageAccess: user.pageAccess,
        createdAt: user.createdAt,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
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
}
