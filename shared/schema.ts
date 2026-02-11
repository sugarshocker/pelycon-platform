import { z } from "zod";

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export interface Organization {
  id: number;
  name: string;
  description?: string;
}

export interface DeviceInfo {
  id: number;
  systemName: string;
  deviceType: string;
  osName: string;
  lastContact?: string;
  purchaseDate?: string;
  age?: number;
  isOld: boolean;
  isEolOs: boolean;
  patchStatus?: string;
}

export interface DeviceHealthSummary {
  totalDevices: number;
  workstations: number;
  servers: number;
  oldDevices: DeviceInfo[];
  eolOsDevices: DeviceInfo[];
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

export interface SecuritySummary {
  totalIncidents: number;
  resolvedIncidents: number;
  pendingIncidents: number;
  recentIncidents: IncidentDetail[];
  activeAgents: number;
  managedAntivirusCount: number;
  antivirusNotProtectedCount: number;
  satCompletionPercent: number | null;
  phishingClickRate: number | null;
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
}

export interface LicenseEntry {
  licenseName: string;
  quantityAssigned: number;
  quantityUsed: number;
  wasted: number;
}

export interface LicenseReport {
  licenses: LicenseEntry[];
  totalWasted: number;
}

export interface RoadmapItem {
  title: string;
  issue: string;
  businessImpact: string;
  priority: "urgent" | "plan_for" | "nice_to_have";
}

export interface RoadmapAnalysis {
  items: RoadmapItem[];
  generatedAt: string;
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
