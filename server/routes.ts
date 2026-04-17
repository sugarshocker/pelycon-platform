import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./routes/auth";
import { registerUserRoutes } from "./routes/users";
import { registerTbrRoutes } from "./routes/tbr";
import { registerAccountRoutes } from "./routes/accounts";
import { registerClientRoutes } from "./routes/clients";
import { registerReceivablesRoutes } from "./routes/receivables";
import { registerSalesRoutes } from "./routes/sales";
import { registerDeviceRoutes } from "./routes/devices";
import { registerSecurityRoutes } from "./routes/security";
import { registerReportRoutes } from "./routes/reports";
import { registerStagingRoutes } from "./routes/staging";
import { registerOrganizationRoutes } from "./routes/organizations";
import { registerSettingsRoutes } from "./routes/settings";
import { registerDropsuiteRoutes } from "./routes/dropsuite";
import { registerTicketRoutes } from "./routes/tickets";
import { registerDebugRoutes } from "./routes/debug";
import { registerPortalAuthRoutes } from "./routes/portalAuth";
import { registerPortalRoutes } from "./routes/portal/index";
import { registerAnnouncementRoutes } from "./routes/announcements";
import { registerPortalManagementRoutes } from "./routes/portalManagement";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerTbrRoutes(app);
  registerAccountRoutes(app);
  registerClientRoutes(app);
  registerReceivablesRoutes(app);
  registerSalesRoutes(app);
  registerDeviceRoutes(app);
  registerSecurityRoutes(app);
  registerReportRoutes(app);
  registerStagingRoutes(app);
  registerOrganizationRoutes(app);
  registerSettingsRoutes(app);
  registerDropsuiteRoutes(app);
  registerTicketRoutes(app);
  registerDebugRoutes(app);
  registerPortalAuthRoutes(app);
  registerAnnouncementRoutes(app);
  registerPortalManagementRoutes(app);
  registerPortalRoutes(app);

  return httpServer;
}
