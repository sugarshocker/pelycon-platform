import type { Express } from "express";
import { requireAuth, requireClientAuth } from "../../middleware/auth";
import { registerPortalTicketRoutes } from "./tickets";
import { registerPortalInvoiceRoutes } from "./invoices";
import { registerPortalAgreementRoutes } from "./agreements";
import { registerPortalSecurityRoutes } from "./security";
import { registerPortalAssetRoutes } from "./assets";
import { registerPortalAnnouncementRoutes } from "./announcements";
import { registerPortalTrendRoutes } from "./trends";

export function registerPortalRoutes(app: Express) {
  app.use("/api/portal", requireAuth, requireClientAuth);

  registerPortalTicketRoutes(app);
  registerPortalInvoiceRoutes(app);
  registerPortalAgreementRoutes(app);
  registerPortalSecurityRoutes(app);
  registerPortalAssetRoutes(app);
  registerPortalAnnouncementRoutes(app);
  registerPortalTrendRoutes(app);
}
