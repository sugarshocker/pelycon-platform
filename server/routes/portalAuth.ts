import type { Express, Request, Response } from "express";
import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { tokenSessions } from "../middleware/auth";
import { log } from "../index";

function getMsalConfig(tenant: any) {
  const m365Config = (tenant?.m365Config || {}) as any;
  return {
    auth: {
      clientId: m365Config.clientId || process.env.M365_CLIENT_ID || "",
      clientSecret: m365Config.clientSecret || process.env.M365_CLIENT_SECRET || "",
      authority: `https://login.microsoftonline.com/${m365Config.tenantId || "common"}`,
    },
  };
}

function getRedirectUri(tenant: any): string {
  const m365Config = (tenant?.m365Config || {}) as any;
  return m365Config.redirectUri || process.env.M365_REDIRECT_URI || "http://localhost:5000/api/auth/microsoft/callback";
}

export function registerPortalAuthRoutes(app: Express) {
  // GET /api/auth/microsoft — initiate SSO login
  app.get("/api/auth/microsoft", async (req: Request, res: Response) => {
    try {
      const tenant = (req as any).tenant;
      if (!tenant) return res.status(503).json({ message: "Tenant not configured" });

      const msalConfig = getMsalConfig(tenant);
      if (!msalConfig.auth.clientId) {
        return res.status(503).json({ message: "M365 SSO not configured for this tenant" });
      }

      const pca = new ConfidentialClientApplication(msalConfig);
      const returnUrl = (req.query.returnUrl as string) || "/portal";
      const state = Buffer.from(JSON.stringify({ returnUrl, tenantId: (req as any).tenantId })).toString("base64");

      const authUrl = await pca.getAuthCodeUrl({
        scopes: ["openid", "profile", "email", "User.Read"],
        redirectUri: getRedirectUri(tenant),
        state,
      });

      res.redirect(authUrl);
    } catch (err: any) {
      log(`M365 auth init error: ${err.message}`);
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/auth/microsoft/callback — handle OAuth callback
  app.get("/api/auth/microsoft/callback", async (req: Request, res: Response) => {
    try {
      const { code, state: stateB64, error, error_description } = req.query as Record<string, string>;

      if (error) {
        log(`M365 auth error: ${error} — ${error_description}`);
        return res.redirect(`/portal/login?error=${encodeURIComponent(error_description || error)}`);
      }

      let stateData: { returnUrl: string; tenantId: number } = { returnUrl: "/portal", tenantId: 1 };
      try {
        stateData = JSON.parse(Buffer.from(stateB64, "base64").toString("utf-8"));
      } catch {}

      const tenant = (req as any).tenant;
      const pca = new ConfidentialClientApplication(getMsalConfig(tenant));

      const tokenResponse = await pca.acquireTokenByCode({
        code,
        scopes: ["openid", "profile", "email", "User.Read"],
        redirectUri: getRedirectUri(tenant),
      });

      const idToken = tokenResponse.idTokenClaims as any;
      const email = (idToken.email || idToken.preferred_username || "").toLowerCase();
      const displayName = idToken.name || email;
      const externalId = idToken.oid || idToken.sub || "";

      // Extract M365 tenant domain from email or tid claim
      const emailDomain = email.split("@")[1] || "";

      // Find matching client by m365TenantDomain
      const { db } = await import("../db");
      const { clients } = await import("@shared/schema");
      const { eq, or, like } = await import("drizzle-orm");

      const matchingClients = await db.select().from(clients)
        .where(or(
          eq(clients.m365TenantDomain, emailDomain),
          like(clients.m365TenantDomain, `%${emailDomain}%`),
        ))
        .limit(1);

      if (matchingClients.length === 0) {
        log(`M365 login: no client found for domain ${emailDomain} (user: ${email})`);
        return res.redirect(`/portal/login?error=${encodeURIComponent("Your organization is not registered for portal access.")}`);
      }

      const client = matchingClients[0];

      // Check portal is enabled
      if (client.portalEnabled !== "true") {
        return res.redirect(`/portal/login?error=${encodeURIComponent("Portal access is not enabled for your organization.")}`);
      }

      // Find or create user
      let user = await storage.getUserByEmail(email);
      if (!user) {
        user = await storage.createUser({
          email,
          displayName,
          passwordHash: "",
          role: "client_user",
          tenantId: stateData.tenantId,
          clientId: client.id,
          authProvider: "microsoft",
          externalId,
          pageAccess: null,
        });
        log(`M365 SSO: created new portal user ${email} for client ${client.companyName}`);
      } else if (!user.clientId) {
        // Existing MSP user trying to use SSO — check if they have explicit client mapping
        await storage.updateUser(user.id, { clientId: client.id, authProvider: "microsoft", externalId });
      }

      // Create a session token
      const sessionToken = `msal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      tokenSessions.set(sessionToken, {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        pageAccess: user.pageAccess as any,
        clientId: client.id,
      });

      // Redirect to portal with token in URL hash (client reads it)
      res.redirect(`${stateData.returnUrl}?token=${sessionToken}`);
    } catch (err: any) {
      log(`M365 callback error: ${err.message}`);
      res.redirect(`/portal/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
    }
  });

  // GET /api/auth/microsoft/userinfo — return current SSO user info
  app.get("/api/auth/microsoft/userinfo", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || (req.query.token as string);
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const session = tokenSessions.get(token);
    if (!session) return res.status(401).json({ message: "Session expired" });

    res.json({
      userId: session.userId,
      email: session.email,
      displayName: session.displayName,
      role: session.role,
      clientId: (session as any).clientId,
    });
  });
}
