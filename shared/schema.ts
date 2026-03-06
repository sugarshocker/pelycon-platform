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
  cwTicketId: integer("cw_ticket_id"),
  scheduleId: integer("schedule_id"),
  reviewDate: text("review_date"),
});

export const insertTbrSnapshotSchema = createInsertSchema(tbrSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTbrSnapshot = z.infer<typeof insertTbrSnapshotSchema>;
export type TbrSnapshot = typeof tbrSnapshots.$inferSelect;

export const clientAccounts = pgTable("client_accounts", {
  id: serial("id").primaryKey(),
  cwCompanyId: integer("cw_company_id").notNull().unique(),
  companyName: text("company_name").notNull(),
  tier: text("tier").default("B").notNull(),
  tierOverride: text("tier_override"),
  agreementRevenue: real("agreement_revenue"),
  projectRevenue: real("project_revenue"),
  totalRevenue: real("total_revenue"),
  laborCost: real("labor_cost"),
  serviceLaborCost: real("service_labor_cost"),
  projectLaborCost: real("project_labor_cost"),
  additionCost: real("addition_cost"),
  projectProductCost: real("project_product_cost"),
  expenseCost: real("expense_cost"),
  msLicensingRevenue: real("ms_licensing_revenue"),
  msLicensingCost: real("ms_licensing_cost"),
  totalCost: real("total_cost"),
  serviceMarginPercent: real("service_margin_percent"),
  projectMarginPercent: real("project_margin_percent"),
  grossMarginPercent: real("gross_margin_percent"),
  serviceHours: real("service_hours"),
  projectHours: real("project_hours"),
  totalHours: real("total_hours"),
  engineerBreakdown: jsonb("engineer_breakdown"),
  agreementAdditions: jsonb("agreement_additions"),
  marginAnalysis: jsonb("margin_analysis"),
  arSummary: jsonb("ar_summary"),
  agreementTypes: text("agreement_types"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClientAccountSchema = createInsertSchema(clientAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientAccount = z.infer<typeof insertClientAccountSchema>;
export type ClientAccount = typeof clientAccounts.$inferSelect;

export interface ClientAccountWithStatus extends ClientAccount {
  lastTbrDate: string | null;
  nextTbrDate: string | null;
  tbrStatus: "green" | "yellow" | "red";
  tbrStatusReason: string;
  effectiveTier: string;
  scheduleFrequency: number | null;
}

export interface EngineerCostBreakdown {
  memberId: number;
  memberName: string;
  memberIdentifier: string;
  serviceHours: number;
  projectHours: number;
  totalHours: number;
  hourlyCost: number;
  totalCost: number;
}

export interface AgreementAdditionInfo {
  additionName: string;
  agreementName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  annualCost: number;
  annualRevenue: number;
  margin: number;
  category: "labor" | "microsoft" | "other";
}

export interface MarginInsight {
  type: "warning" | "suggestion" | "info";
  category: "labor" | "additions" | "project" | "overall";
  title: string;
  detail: string;
  impact?: string;
}

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

export const tbrSchedules = pgTable("tbr_schedules", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().unique(),
  orgName: text("org_name").notNull(),
  frequencyMonths: integer("frequency_months").default(6).notNull(),
  nextReviewDate: timestamp("next_review_date"),
  lastReviewDate: timestamp("last_review_date"),
  notes: text("notes"),
  reminderEmail: text("reminder_email"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTbrScheduleSchema = createInsertSchema(tbrSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTbrSchedule = z.infer<typeof insertTbrScheduleSchema>;
export type TbrSchedule = typeof tbrSchedules.$inferSelect;

export const tbrStaging = pgTable("tbr_staging", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().unique(),
  orgName: text("org_name").notNull(),
  engineerNotes: text("engineer_notes"),
  serviceManagerNotes: text("service_manager_notes"),
  mfaReportData: jsonb("mfa_report_data"),
  licenseReportData: jsonb("license_report_data"),
  mfaFileName: text("mfa_file_name"),
  licenseFileName: text("license_file_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTbrStagingSchema = createInsertSchema(tbrStaging).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTbrStaging = z.infer<typeof insertTbrStagingSchema>;
export type TbrStaging = typeof tbrStaging.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("viewer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const loginUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const createUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  displayName: z.string().min(1, "Display name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});
