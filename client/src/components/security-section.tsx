import { useQuery } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { StatusIndicator, TrendIndicator } from "./status-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { SecuritySummary, Organization } from "@shared/schema";

interface SecuritySectionProps {
  client: Organization;
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold">{data.totalIncidents}</span>
            <span className="text-xs text-muted-foreground text-center">
              Incidents (6 Months)
            </span>
          </div>
          <StatusIndicator
            value={resolvedPercent}
            label="Incidents Resolved"
          />
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold">{data.pendingIncidents}</span>
            <span className="text-xs text-muted-foreground text-center">
              Pending Review
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold">{data.activeAgents}</span>
            <span className="text-xs text-muted-foreground text-center">
              Protected Devices
            </span>
          </div>
          {data.satCompletionPercent !== null && (
            <StatusIndicator
              value={data.satCompletionPercent}
              thresholds={{ good: 80, warning: 60 }}
              label="Security Training Complete"
            />
          )}
          {data.phishingClickRate !== null && (
            <StatusIndicator
              value={data.phishingClickRate}
              thresholds={{ good: 95, warning: 90 }}
              label="Phishing Test Pass Rate"
              suffix="%"
            />
          )}
        </div>

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
