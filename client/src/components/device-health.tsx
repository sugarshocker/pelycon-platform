import { useQuery } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { StatusIndicator, StatusDot } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Server, AlertTriangle, ShieldAlert } from "lucide-react";
import type { DeviceHealthSummary, Organization } from "@shared/schema";

interface DeviceHealthProps {
  client: Organization;
}

export function DeviceHealth({ client }: DeviceHealthProps) {
  const { data, isLoading, error } = useQuery<DeviceHealthSummary>({
    queryKey: ["/api/devices", client.id],
    enabled: !!client.id,
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-24 rounded-md" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Unable to load device data.</p>
          <p className="text-xs mt-1">Check that NinjaOne is configured correctly.</p>
        </div>
      );
    }

    if (!data) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold">{data.totalDevices}</span>
            <span className="text-xs text-muted-foreground">Total Devices</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{data.workstations}</span>
            </div>
            <span className="text-xs text-muted-foreground">Workstations</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{data.servers}</span>
            </div>
            <span className="text-xs text-muted-foreground">Servers</span>
          </div>
          <StatusIndicator
            value={data.patchCompliancePercent}
            label="Systems Up to Date"
          />
        </div>

        {data.oldDevices.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Aging Hardware (5+ Years Old)
            </h4>
            <div className="grid gap-2">
              {data.oldDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2"
                  data-testid={`device-old-${device.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status="action" />
                    <span className="text-sm font-medium truncate">
                      {device.systemName}
                    </span>
                  </div>
                  <Badge variant="destructive" className="flex-shrink-0">
                    {device.age} years old
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.eolOsDevices.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Unsupported Operating Systems
            </h4>
            <div className="grid gap-2">
              {data.eolOsDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2"
                  data-testid={`device-eol-${device.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status="warning" />
                    <span className="text-sm font-medium truncate">
                      {device.systemName}
                    </span>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0">
                    {device.osName}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.criticalAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Critical Alerts
            </h4>
            <div className="grid gap-2">
              {data.criticalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2"
                  data-testid={`alert-critical-${alert.id}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium">{alert.deviceName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.created).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.oldDevices.length === 0 &&
          data.eolOsDevices.length === 0 &&
          data.criticalAlerts.length === 0 && (
            <div className="text-center py-4">
              <StatusDot status="good" label="All systems healthy — no issues found" />
            </div>
          )}
      </div>
    );
  };

  return (
    <CollapsibleSection
      title="Device Health"
      icon={<Monitor className="h-5 w-5" />}
      testId="section-device-health"
    >
      {renderContent()}
    </CollapsibleSection>
  );
}
