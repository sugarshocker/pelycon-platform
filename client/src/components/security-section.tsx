import { useQuery } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { StatusDot, TrendIndicator } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import type { SecuritySummary, Organization } from "@shared/schema";

interface SecuritySectionProps {
  client: Organization;
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "text-red-600 dark:text-red-400";
    case "high":
      return "text-orange-600 dark:text-orange-400";
    case "low":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-muted-foreground";
  }
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

export function SecuritySection({ client }: SecuritySectionProps) {
  const { data, isLoading, error } = useQuery<SecuritySummary>({
    queryKey: ["/api/security", client.id],
    enabled: !!client.id,
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
