# MSP Technology Business Review (TBR) Dashboard

## Overview
A client-facing TBR dashboard for MSP owners to screen-share during 30-minute semi-annual client review meetings. Pulls live data from MSP tools (NinjaOne, Huntress, ConnectWise), accepts manual CSV report uploads, and uses AI to generate a plain-language priority roadmap.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js API routes
- **Auth**: Simple password-protected login (session-based, no database)
- **AI**: Anthropic Claude via Replit AI Integrations for roadmap generation
- **Storage**: In-memory only (no database - live-pull dashboard)

## Key Files
- `shared/schema.ts` - TypeScript interfaces for all data types
- `server/routes.ts` - All API routes (auth, proxy to MSP APIs, CSV parsing, AI, export)
- `server/services/ninjaone.ts` - NinjaOne API integration (OAuth2 client credentials)
- `server/services/huntress.ts` - Huntress API integration (Basic auth)
- `server/services/connectwise.ts` - ConnectWise Manage API integration (Basic auth)
- `server/services/roadmap.ts` - Claude AI roadmap generation
- `server/services/export.ts` - HTML summary export generation
- `client/src/App.tsx` - Main app with auth state management
- `client/src/pages/login.tsx` - Password login page
- `client/src/pages/dashboard.tsx` - Main dashboard with all sections
- `client/src/components/` - Dashboard section components

## API Routes
- `POST /api/auth/login` - Password authentication
- `GET /api/auth/check` - Session check
- `POST /api/auth/logout` - Logout
- `GET /api/status` - API connection status
- `GET /api/organizations` - List clients from NinjaOne
- `GET /api/devices/:orgId` - Device health from NinjaOne
- `GET /api/security/:orgId` - Security data from Huntress
- `GET /api/tickets/:orgId` - Ticket data from ConnectWise
- `POST /api/reports/mfa` - Upload MFA CSV
- `POST /api/reports/license` - Upload License CSV
- `POST /api/roadmap/generate` - AI roadmap generation
- `POST /api/export/summary` - HTML summary export

## Environment Variables
All API keys stored as Replit Secrets:
- NINJAONE_CLIENT_ID, NINJAONE_CLIENT_SECRET, NINJAONE_INSTANCE
- HUNTRESS_API_KEY, HUNTRESS_API_SECRET
- CW_COMPANY_ID, CW_PUBLIC_KEY, CW_PRIVATE_KEY, CW_CLIENT_ID, CW_SITE_URL
- DASHBOARD_PASSWORD
- SESSION_SECRET
- AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL (auto-configured)
