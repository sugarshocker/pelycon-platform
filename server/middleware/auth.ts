import type { Request, Response, NextFunction } from "express";

export interface TokenSession {
  userId: number;
  email: string;
  displayName: string;
  role: string;
  pageAccess: Record<string, boolean> | null;
  clientId?: number | null;
}

export const tokenSessions = new Map<string, TokenSession>();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const queryToken = (req.query?.token as string) || undefined;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : queryToken;

  if (token) {
    const session = tokenSessions.get(token);
    if (session) {
      (req as any).user = session;
      return next();
    }
  }
  res.status(401).json({ message: "Unauthorized" });
}

// MSP staff only (existing internal portal users)
export function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as TokenSession | undefined;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.clientId != null) {
    return res.status(403).json({ message: "Staff access required" });
  }
  next();
}

// Client portal users only
export function requireClientAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as TokenSession | undefined;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (!["client_user", "client_admin"].includes(user.role) || user.clientId == null) {
    return res.status(403).json({ message: "Client portal access required" });
  }
  (req as any).clientId = user.clientId;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as TokenSession | undefined;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export function requireEditor(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as TokenSession | undefined;
  if (!user || (user.role !== "admin" && user.role !== "editor")) {
    return res.status(403).json({ message: "Editor access required" });
  }
  next();
}
