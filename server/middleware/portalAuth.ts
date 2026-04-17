// TODO Phase 2: M365 SSO auth flow for client portal
// This middleware will validate client portal sessions established via Microsoft OAuth
import type { Request, Response, NextFunction } from "express";

export function requirePortalAuth(_req: Request, _res: Response, _next: NextFunction) {
  // Phase 2: validate client portal session / M365 SSO token
  throw new Error("Portal auth not yet implemented");
}
