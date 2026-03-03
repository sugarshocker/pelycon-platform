# MSP Technology Business Review (TBR) Dashboard

## Overview
The MSP Technology Business Review (TBR) Dashboard is a client-facing tool designed for MSP owners to conduct semi-annual client review meetings. It integrates live data from various MSP tools (NinjaOne, Huntress, ConnectWise), allows manual CSV report uploads, and leverages AI to generate a plain-language priority roadmap. A core feature is the ability to track TBR snapshots over time, enabling trend analysis across reviews. The project aims to streamline client reporting, enhance client communication, and provide actionable insights for MSPs.

## User Preferences
I prefer simple language in explanations.
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.

## System Architecture
The application uses a modern web stack with **React**, **Vite**, **Tailwind CSS**, and **shadcn/ui** for the frontend, providing a responsive and aesthetically pleasing user interface. The backend is built with **Express.js** to handle API routes, data processing, and integrations. **PostgreSQL**, specifically a Neon-backed instance, is used for storing TBR snapshot history and other relational data.

Authentication is managed through individual user accounts with email/password login (bcrypt hashed), supporting role-based access (admin, editor, viewer) and bearer token sessions.

AI capabilities for roadmap generation are powered by **Anthropic Claude** via Replit AI Integrations. The branding adheres to **Pelycon Technologies** guidelines, utilizing Orange (#E77125), Storm Gray (#394442), and the Poppins font for a consistent visual identity.

The dashboard supports a "Two-View Workflow" comprising an Overview for client selection and draft management, and an Editor View for on-demand data loading, editing, and finalization. It incorporates a comprehensive TBR Snapshot System for saving drafts, finalizing reviews, tracking trends, and linking with review schedules. A key feature is the "No Surprises" framework for report generation, covering operational readiness, capacity planning, financial efficiency, and recommended actions.

Client Accounts and Revenue management includes a tier-based system (A, B, C) with manual overrides, detailed agreement and project revenue calculations, and a sophisticated margin analysis engine that identifies actionable insights based on labor costs, addition costs, and various revenue streams.

## External Dependencies
- **NinjaOne**: For device health, patch management, and organizational data (Legacy API Keys with HMAC-SHA1).
- **Huntress**: For security data, incident reports, agent status, and Security Awareness Training (SAT) enrollment (Basic auth and OAuth2 Client Credentials for Curricula integration).
- **ConnectWise**: For ticket data, projects, client agreements, financial data, time entries, and member information (CW_COMPANY_ID, CW_PUBLIC_KEY, CW_PRIVATE_KEY, CW_CLIENT_ID, CW_SITE_URL).
- **Anthropic Claude**: For AI-powered roadmap generation (via Replit AI Integrations).
- **Neon (PostgreSQL)**: Managed PostgreSQL database for data storage.
- **SMTP2GO**: For sending email reminders (SMTP2GO REST API).
- **html2pdf.js**: For PDF generation of reports.