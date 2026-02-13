import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { StatusDot, TrendIndicator } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert, Shield, AlertTriangle, GraduationCap, Crosshair, BookOpen, Users, Monitor, ChevronDown, ChevronUp, Fingerprint } from "lucide-react";
import type { SecuritySummary, Organization, DeviceUserEntry } from "@shared/schema";

interface MissingDevice {
  name: string;
  lastSeen: string | null;
}

interface CoverageGap {
  ninjaCount: number;
  huntressCount: number;
  missingFromHuntress: MissingDevice[];
  missingFromNinja: string[];
}

interface SecuritySectionProps {
  client: Organization;
}

function severityBadgeVariant(severity: string): "destructive" | "outline" | "secondary" {
  switch (severity.toLowerCase()) {
    case "critical":
      return "destructive";
    case "high":
      return "outline";
    default:
      return "secondary";
  }
}

function SatSubsection({ data }: { data: SecuritySummary }) {
  const hasSatData = data.satLearnerCount !== null || data.satTotalUsers !== null;
  const hasPhishingData = data.phishingClickRate !== null || data.phishingCampaignCount !== null;
  const hasCompletionData = data.satCompletionPercent !== null || data.satModulesCompleted !== null;

  if (!hasSatData && !hasPhishingData && !hasCompletionData) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        Security Awareness Training (SAT)
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {hasSatData && (
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span
              className={`text-2xl font-bold ${
                data.satCoveragePercent !== null && data.satCoveragePercent < 80
                  ? "text-amber-600 dark:text-amber-400"
                  : data.satLearnerCount !== null && data.satLearnerCount > 0
                  ? "text-green-600 dark:text-green-400"
                  : ""
              }`}
              data-testid="text-sat-enrollment"
            >
              {data.satCoveragePercent !== null ? `${data.satCoveragePercent}%` : data.satLearnerCount ?? "N/A"}
            </span>
            <span className="text-xs text-muted-foreground text-center">
              {data.satCoveragePercent !== null ? "Enrolled" : "Learners"}
            </span>
            {data.satLearnerCount !== null && data.satTotalUsers !== null && (
              <span className="text-xs text-muted-foreground">
                {data.satLearnerCount} of {data.satTotalUsers}
              </span>
            )}
          </div>
        )}

        {hasCompletionData && (
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span
              className={`text-2xl font-bold ${
                data.satCompletionPercent !== null && data.satCompletionPercent >= 80
                  ? "text-green-600 dark:text-green-400"
                  : data.satCompletionPercent !== null
                  ? "text-amber-600 dark:text-amber-400"
                  : ""
              }`}
              data-testid="text-sat-completion"
            >
              {data.satCompletionPercent !== null ? `${data.satCompletionPercent}%` : "N/A"}
            </span>
            <span className="text-xs text-muted-foreground text-center">Completion</span>
            {data.satModulesCompleted !== null && data.satModulesAssigned !== null && (
              <span className="text-xs text-muted-foreground">
                {data.satModulesCompleted} of {data.satModulesAssigned} modules
              </span>
            )}
          </div>
        )}

        {(data.phishingClickRate !== null || hasPhishingData) && (
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <Crosshair className="h-4 w-4 text-muted-foreground" />
            <span
              className={`text-2xl font-bold ${
                data.phishingClickRate !== null && data.phishingClickRate <= 5
                  ? "text-green-600 dark:text-green-400"
                  : data.phishingClickRate !== null && data.phishingClickRate <= 15
                  ? "text-amber-600 dark:text-amber-400"
                  : data.phishingClickRate !== null
                  ? "text-red-600 dark:text-red-400"
                  : ""
              }`}
              data-testid="text-phishing-click-rate"
            >
              {data.phishingClickRate !== null ? `${data.phishingClickRate}%` : "N/A"}
            </span>
            <span className="text-xs text-muted-foreground text-center">Phishing Click Rate</span>
            {data.phishingCampaignCount !== null && (
              <span className="text-xs text-muted-foreground">
                {data.phishingCampaignCount} campaign{data.phishingCampaignCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {data.phishingReportRate !== null && (
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span
              className={`text-2xl font-bold ${
                data.phishingReportRate >= 70
                  ? "text-green-600 dark:text-green-400"
                  : data.phishingReportRate >= 40
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
              data-testid="text-phishing-report-rate"
            >
              {data.phishingReportRate}%
            </span>
            <span className="text-xs text-muted-foreground text-center">Report Rate</span>
          </div>
        )}
      </div>

      {data.satTotalUsers && data.satLearnerCount !== null && data.satLearnerCount < data.satTotalUsers && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              {data.satTotalUsers - data.satLearnerCount} user{data.satTotalUsers - data.satLearnerCount !== 1 ? "s" : ""} not enrolled in security training
            </span>
          </div>
          {data.satUnenrolledUsers && data.satUnenrolledUsers.length > 0 && (
            <div className="ml-6 space-y-0.5" data-testid="sat-unenrolled-list">
              {data.satUnenrolledUsers.map((user, i) => (
                <div key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{user.name}</span>
                  {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.recentPhishingCampaigns.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Recent Phishing Campaigns</h5>
          <div className="grid gap-1.5">
            {data.recentPhishingCampaigns.slice(0, 5).map((campaign, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2"
                data-testid={`phishing-campaign-${i}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Crosshair className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{campaign.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <Badge
                    variant={campaign.clickRate <= 5 ? "secondary" : campaign.clickRate <= 15 ? "outline" : "destructive"}
                  >
                    {campaign.clickRate}% clicked
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(campaign.launchedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceUserInventory({ client }: { client: Organization }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery<{ devices: DeviceUserEntry[] }>({
    queryKey: ["/api/device-users", client.id],
    enabled: !!client.id && expanded,
  });

  const devices = data?.devices || [];
  const sortedDevices = [...devices].sort((a, b) => {
    const ageA = a.age ?? -1;
    const ageB = b.age ?? -1;
    if (ageB !== ageA) return ageB - ageA;
    return a.hostname.localeCompare(b.hostname);
  });

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full justify-between"
        data-testid="button-toggle-device-inventory"
      >
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Device-User Inventory</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {expanded && (
        <div className="rounded-md border">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-md" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No device data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Hostname</th>
                    <th className="text-left px-3 py-2 font-medium">User</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-left px-3 py-2 font-medium">OS</th>
                    <th className="text-center px-3 py-2 font-medium">Age</th>
                    <th className="text-center px-3 py-2 font-medium">Huntress</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDevices.map((device, i) => (
                    <tr
                      key={i}
                      className={`border-b last:border-b-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                      data-testid={`device-row-${i}`}
                    >
                      <td className="px-3 py-1.5 font-mono text-xs">{device.hostname}</td>
                      <td className="px-3 py-1.5">{device.lastLoggedInUser || <span className="text-muted-foreground">-</span>}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="secondary">{device.deviceType}</Badge>
                      </td>
                      <td className="px-3 py-1.5 text-xs">{device.osName || "-"}</td>
                      <td className="px-3 py-1.5 text-center">
                        {device.age !== undefined && device.age !== null ? (
                          <span className={device.age >= 5 ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                            {device.ageSource === "model" ? "~" : ""}{device.age}y
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {device.huntressProtected ? (
                          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SecuritySection({ client }: SecuritySectionProps) {
  const { data, isLoading, error } = useQuery<SecuritySummary>({
    queryKey: ["/api/security", client.id],
    enabled: !!client.id,
  });

  const { data: coverageGap } = useQuery<CoverageGap>({
    queryKey: ["/api/coverage-gap", client.id],
    enabled: !!client.id && !!data && !data.notInHuntress,
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Unable to load security data.</p>
          <p className="text-xs mt-1">Check that Huntress is configured correctly.</p>
        </div>
      );
    }

    if (!data) return null;

    if (data.notInHuntress) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>This client was not found in Huntress.</p>
          <p className="text-xs mt-1">The organization name may not match between NinjaOne and Huntress.</p>
        </div>
      );
    }

    const resolvedPercent =
      data.totalIncidents > 0
        ? Math.round((data.resolvedIncidents / data.totalIncidents) * 100)
        : 100;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold" data-testid="text-total-incidents">{data.totalIncidents}</span>
            <span className="text-xs text-muted-foreground text-center">
              Incidents (6 Mo)
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className={`text-2xl font-bold ${data.pendingIncidents > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`} data-testid="text-pending-incidents">
              {data.pendingIncidents}
            </span>
            <span className="text-xs text-muted-foreground text-center">
              Open / Pending
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-resolved-incidents">
              {data.resolvedIncidents}
            </span>
            <span className="text-xs text-muted-foreground text-center">
              Resolved
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold" data-testid="text-active-agents">{data.activeAgents}</span>
            <span className="text-xs text-muted-foreground text-center">
              Huntress Agents
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-md bg-muted/50 px-4 py-3">
            <Shield className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold" data-testid="text-antivirus-count">{data.managedAntivirusCount}</span>
                <span className="text-sm text-muted-foreground">Managed Antivirus</span>
              </div>
              {data.antivirusNotProtectedCount > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {data.antivirusNotProtectedCount} not protected
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md bg-muted/50 px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">Incident Resolution</div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${resolvedPercent === 100 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {resolvedPercent}%
                </span>
                <span className="text-xs text-muted-foreground">resolved</span>
              </div>
            </div>
          </div>
        </div>

        {data.identitiesMonitored !== null && data.identitiesMonitored > 0 && (
          <div className="flex items-center gap-3 rounded-md bg-muted/50 px-4 py-3">
            <Fingerprint className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold" data-testid="text-identities-monitored">{data.identitiesMonitored}</span>
                <span className="text-sm text-muted-foreground">M365 Identities Monitored (ITDR)</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Identity Threat Detection & Response via Huntress
              </span>
            </div>
          </div>
        )}

        <SatSubsection data={data} />

        <DeviceUserInventory client={client} />

        {coverageGap && coverageGap.missingFromHuntress.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-sm">
                <strong>{coverageGap.missingFromHuntress.length}</strong> device{coverageGap.missingFromHuntress.length !== 1 ? "s" : ""} in NinjaOne missing Huntress agent
                <span className="text-xs text-muted-foreground ml-1">
                  ({coverageGap.ninjaCount} NinjaOne vs {coverageGap.huntressCount} Huntress)
                </span>
              </span>
            </div>
            <div className="grid gap-1.5">
              {coverageGap.missingFromHuntress.map((device, i) => {
                let lastSeenLabel = "";
                if (device.lastSeen) {
                  const d = new Date(device.lastSeen);
                  const now = new Date();
                  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
                  if (diffDays === 0) lastSeenLabel = "today";
                  else if (diffDays === 1) lastSeenLabel = "yesterday";
                  else if (diffDays < 30) lastSeenLabel = `${diffDays}d ago`;
                  else lastSeenLabel = d.toLocaleDateString();
                }
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-3 py-1.5"
                    data-testid={`missing-huntress-${i}`}
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-300 font-medium">{device.name}</span>
                    {lastSeenLabel && (
                      <span className="text-xs text-muted-foreground" data-testid={`last-seen-${i}`}>
                        Last seen {lastSeenLabel}
                      </span>
                    )}
                    <Badge variant="destructive" className="ml-auto text-xs flex-shrink-0">No Huntress</Badge>
                  </div>
                );
              })}
            </div>
            {coverageGap.missingFromNinja.length > 0 && (
              <div className="text-xs text-muted-foreground px-1">
                {coverageGap.missingFromNinja.length} Huntress agent{coverageGap.missingFromNinja.length !== 1 ? "s" : ""} not in NinjaOne: {coverageGap.missingFromNinja.join(", ")}
              </div>
            )}
          </div>
        )}

        {data.recentIncidents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Recent Incidents (Last 6 Months)
            </h4>
            <div className="grid gap-2">
              {data.recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2"
                  data-testid={`incident-${incident.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StatusDot status={incident.status === "closed" ? "good" : "action"} />
                    <span className="text-sm truncate">{incident.subject}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <Badge variant={severityBadgeVariant(incident.severity)}>
                      {incident.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(incident.sentAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.trendDirection && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">
              Security trend:
            </span>
            <TrendIndicator direction={data.trendDirection} />
          </div>
        )}
      </div>
    );
  };

  return (
    <CollapsibleSection
      title="Security Overview"
      icon={<ShieldCheck className="h-5 w-5" />}
      testId="section-security"
    >
      {renderContent()}
    </CollapsibleSection>
  );
}
