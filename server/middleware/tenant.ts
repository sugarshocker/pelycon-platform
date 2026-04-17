import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { createPSAAdapter } from "../adapters/psa/factory";

export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    const tenantId = 1; // Phase 2: resolve from subdomain, auth token, or header
    const tenant = await storage.getTenantById(tenantId);
    (req as any).tenantId = tenantId;
    (req as any).tenant = tenant;
    if (tenant) {
      (req as any).psaAdapter = createPSAAdapter(tenant.psaType, tenant.psaConfig);
    }
    next();
  } catch {
    // Non-fatal: tenant resolution failure shouldn't break internal routes
    (req as any).tenantId = 1;
    next();
  }
}
