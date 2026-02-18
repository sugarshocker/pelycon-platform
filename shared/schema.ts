import { z } from "zod";
import { pgTable, serial, integer, text, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const tbrSnapshots = pgTable("tbr_snapshots", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  orgName: text("org_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  status: text("status").default("finalized").notNull(),
  fullData: jsonb("full_data"),
  totalDevices: integer("total_devices").default(0).notNull(),
  workstations: integer("workstations").default(0).notNull(),
  servers: integer("servers").default(0).notNull(),
  needsReplacementCount: integer("needs_replacement_count").default(0).notNull(),
  patchCompliancePercent: real("patch_compliance_percent").default(100).notNull(),
  pendingPatchCount: integer("pending_patch_count").default(0).notNull(),
  eolOsCount: integer("eol_os_count").default(0).notNull(),
  staleDeviceCount: integer("stale_device_count").default(0).notNull(),
  totalIncidents: integer("total_incidents").default(0).notNull(),
  pendingIncidents: integer("pending_incidents").default(0).notNull(),
  activeAgents: integer("active_agents").default(0).notNull(),
  satLearnerCount: integer("sat_learner_count"),
  satTotalUsers: integer("sat_total_users"),
  totalTickets: integer("total_tickets").default(0).notNull(),
  oldOpenTicketCount: integer("old_open_ticket_count").default(0).notNull(),
  mfaTotalUsers: integer("mfa_total_users"),
  mfaCoveredCount: integer("mfa_covered_count"),
  mfaCoveragePercent: real("mfa_coverage_percent"),
  licenseTotalWasted: integer("license_total_wasted"),
  licenseMonthlyWaste: real("license_monthly_waste"),
  licenseAnnualWaste: real("license_annual_waste"),
  roadmapItemCount: integer("roadmap_item_count").default(0).notNull(),
  urgentItemCount: integer("urgent_item_count").default(0).notNull(),
});

export const insertTbrSnapshotSchema = createInsertSchema(tbrSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTbrSnapshot = z.infer<typeof insertTbrSnapshotSchema>;
export type TbrSnapshot = typeof tbrSnapshots.$inferSelect;

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export interface Organization {
  id: number;
  name: string;
  description?: string;
}

export type DeviceCategory = "Windows Desktop" | "Windows Laptop" | "Mac Desktop" | "Mac Laptop" | "Windows Server";

export interface DeviceInfo {
  id: number;
  systemName: string;
  deviceType: DeviceCategory;
  osName: string;
  lastContact?: string;
  purchaseDate?: string;
  age?: number;
  ageSource?: "warranty" | "purchase" | "model" | "created";
  isOld: boolean;
  isEolOs: boolean;
  isStale: boolean;
  daysSinceContact?: number;
  patchStatus?: string;
  manufacturer?: string;
  model?: string;
  createdDate?: string;
}

export interface DeviceTypeCounts {
  windowsDesktops: number;
  windowsLaptops: number;
  macDesktops: number;
  macLaptops: number;
  windowsServers: number;
}

export interface DeviceHealthSummary {
  totalDevices: number;
  workstations: number;
  servers: number;
  deviceTypeCounts: DeviceTypeCounts;
  oldDevices: DeviceInfo[];
  eolOsDevices: DeviceInfo[];
  staleDevices: DeviceInfo[];
  needsReplacementCount: number;
  patchCompliancePercent: number;
  pendingPatchCount: number;
  installedPatchCount: number;
  criticalAlerts: Array<{
    id: number;
    message: string;
    severity: string;
    deviceName: string;
    created: string;
  }>;
}

export interface IncidentDetail {
  id: number;
  subject: string;
  severity: string;
  status: string;
  sentAt: string;
  closedAt: string | null;
}

export interface SatCampaignDetail {
  name: string;
  sentCount: number;
  clickCount: number;
  compromiseCount: number;
  reportCount: number;
  clickRate: number;
  compromiseRate: number;
  reportRate: number;
  launchedAt: string;
}

export interface UnprotectedAgent {
  hostname: string;
  defenderStatus: string;
}

export interface SecuritySummary {
  totalIncidents: number;
  resolvedIncidents: number;
  pendingIncidents: number;
  recentIncidents: IncidentDetail[];
  activeAgents: number;
  managedAntivirusCount: number;
  antivirusNotProtectedCount: number;
  unprotectedAgents: UnprotectedAgent[];
  satCompletionPercent: number | null;
  phishingClickRate: number | null;
  satLearnerCount: number | null;
  satTotalUsers: number | null;
  satCoveragePercent: number | null;
  satModulesCompleted: number | null;
  satModulesAssigned: number | null;
  phishingCampaignCount: number | null;
  phishingCompromiseRate: number | null;
  phishingReportRate: number | null;
  recentPhishingCampaigns: SatCampaignDetail[];
  satUnenrolledUsers: Array<{ name: string; email: string }>;
  identitiesMonitored: number | null;
  trendDirection: "better" | "worse" | "stable" | null;
  notInHuntress?: boolean;
}

export interface TicketSummary {
  totalTickets: number;
  topCategories: Array<{ name: string; count: number }>;
  recurringIssues: Array<{ subject: string; count: number }>;
  oldOpenTickets: Array<{
    id: number;
    summary: string;
    ageDays: number;
    dateEntered: string;
  }>;
  monthlyVolume: Array<{ month: string; count: number }>;
}

export type MfaCoverageMethod = "perUser" | "conditionalAccess" | "securityDefaults";

export interface MfaUser {
  displayName: string;
  email: string;
  perUserMfa: string;
  coveredByCA: boolean;
  coveredBySD: boolean;
  isCovered: boolean;
  coverageMethod: MfaCoverageMethod | null;
}

export interface MfaReport {
  totalUsers: number;
  coveredCount: number;
  uncoveredCount: number;
  coveredByPerUser: number;
  coveredByCA: number;
  coveredBySD: number;
  uncoveredUsers: MfaUser[];
  allUsers: MfaUser[];
}

export interface LicenseEntry {
  licenseName: string;
  totalLicenses: number;
  quantityUsed: number;
  quantityAvailable: number;
  wasted: number;
  monthlyPricePerLicense: number;
  monthlyWastedCost: number;
}

export interface LicenseReport {
  licenses: LicenseEntry[];
  totalWasted: number;
  totalMonthlyWaste: number;
  totalAnnualWaste: number;
}

export interface RoadmapItem {
  title: string;
  issue: string;
  businessImpact: string;
  priority: "urgent" | "plan_for" | "nice_to_have";
}

export interface RoadmapAnalysis {
  executiveSummary: string;
  items: RoadmapItem[];
  generatedAt: string;
}

export interface ProjectItem {
  id: number;
  name: string;
  status: string;
  source: "project" | "ticket";
  dateEntered: string;
  closedDate?: string;
  boardName?: string;
}

export interface ProjectSummaryData {
  completed: ProjectItem[];
  inProgress: ProjectItem[];
  aiSummary?: string;
}

export interface DeviceUserEntry {
  hostname: string;
  lastLoggedInUser: string;
  osName: string;
  deviceType: DeviceCategory;
  age?: number;
  ageSource?: "warranty" | "purchase" | "model" | "created";
  model?: string;
  huntressProtected: boolean;
}

export interface DashboardData {
  deviceHealth: DeviceHealthSummary | null;
  security: SecuritySummary | null;
  tickets: TicketSummary | null;
  mfaReport: MfaReport | null;
  licenseReport: LicenseReport | null;
  roadmap: RoadmapAnalysis | null;
}

export interface ApiStatus {
  ninjaone: boolean;
  huntress: boolean;
  connectwise: boolean;
}

export type User = { id: string; username: string; password: string };
export type InsertUser = { username: string; password: string };
