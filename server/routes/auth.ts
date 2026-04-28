import type { Express, Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { loginUserSchema, createUserSchema } from "@shared/schema";
import { storage } from "../storage";
import { log } from "../index";
import { tokenSessions } from "../middleware/auth";

export function registerAuthRoutes(app: Express) {
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
        pageAccess: user.pageAccess as Record<string, boolean> | null,
        clientId: user.clientId ?? null,
      });
      res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, pageAccess: user.pageAccess, clientId: user.clientId },
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
        pageAccess: user.pageAccess as Record<string, boolean> | null,
        clientId: user.clientId ?? null,
      });
      res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, pageAccess: user.pageAccess, clientId: user.clientId },
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
}
