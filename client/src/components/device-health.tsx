import { useQuery } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { StatusIndicator, StatusDot } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Server, AlertTriangle, ShieldAlert, RefreshCw, Laptop, Clock } from "lucide-react";

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

    const tc = data.deviceTypeCounts;
    const deviceTypes = [
      { label: "Win Laptops", count: tc?.windowsLaptops ?? 0, icon: <Laptop className="h-3.5 w-3.5" /> },
      { label: "Win Desktops", count: tc?.windowsDesktops ?? 0, icon: <Monitor className="h-3.5 w-3.5" /> },
      { label: "Mac Laptops", count: tc?.macLaptops ?? 0, icon: <Laptop className="h-3.5 w-3.5" /> },
      { label: "Mac Desktops", count: tc?.macDesktops ?? 0, icon: <Monitor className="h-3.5 w-3.5" /> },
      { label: "Win Servers", count: tc?.windowsServers ?? 0, icon: <Server className="h-3.5 w-3.5" /> },
    ].filter(t => t.count > 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold" data-testid="text-total-devices">{data.totalDevices}</span>
            <span className="text-xs text-muted-foreground">Total Devices</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold" data-testid="text-workstations">{data.workstations}</span>
            </div>
            <span className="text-xs text-muted-foreground">Workstations</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span className={`text-2xl font-bold ${data.needsReplacementCount > 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-needs-replacement">
                {data.needsReplacementCount}
              </span>
            </div>
            <span className="text-xs text-muted-foreground text-center">Needs Replacement</span>
          </div>
        </div>

        {deviceTypes.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="device-type-breakdown">
            {deviceTypes.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-1.5 rounded-md bg-muted/30 px-3 py-1.5"
              >
                {t.icon}
                <span className="text-sm font-semibold">{t.count}</span>
                <span className="text-xs text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </div>
        )}

        {data.pendingPatchCount > 0 && (
          <div className="flex items-center gap-3 rounded-md bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
            <StatusDot status="warning" />
            <div className="flex-1">
              <span className="text-sm font-medium" data-testid="text-pending-patches">{data.pendingPatchCount} patches awaiting installation (30+ days)</span>
            </div>
          </div>
        )}

        {data.oldDevices.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Aging Hardware (5+ Years Old) — {data.oldDevices.length} device{data.oldDevices.length !== 1 ? "s" : ""}
            </h4>
            <div className="grid gap-2">
              {data.oldDevices.map((device) => {
                const modelLabel = device.model
                  ? (device.manufacturer ? `${device.manufacturer} ${device.model}` : device.model)
                  : null;
                return (
                  <div
                    key={device.id}
                    className="rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2"
                    data-testid={`device-old-${device.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status="action" />
                        <span className="text-sm font-medium truncate">
                          {device.systemName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({device.deviceType})
                        </span>
                      </div>
                      <Badge variant="destructive" className="flex-shrink-0">
                        {device.ageSource === "model" ? "~" : ""}{device.age} yr{device.age !== 1 ? "s" : ""} old
                      </Badge>
                    </div>
                    {modelLabel && (
                      <div className="flex items-center gap-2 mt-1 ml-5 text-xs text-muted-foreground flex-wrap">
                        <span>{modelLabel}</span>
                        {device.ageSource === "model" && (
                          <span className="text-[10px] italic">(est. from model)</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.eolOsDevices.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Needs Attention — {data.eolOsDevices.length} device{data.eolOsDevices.length !== 1 ? "s" : ""}
            </h4>
            <div className="grid gap-2">
              {data.eolOsDevices.map((device) => {
                const modelLabel = device.model
                  ? (device.manufacturer ? `${device.manufacturer} ${device.model}` : device.model)
                  : null;

                return (
                  <div
                    key={device.id}
                    className="rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2"
                    data-testid={`device-eol-${device.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={device.isOld ? "action" : "warning"} />
                        <span className="text-sm font-medium truncate">
                          {device.systemName}
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {device.deviceType}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {device.isEolOs && (
                          <Badge variant="outline">
                            {device.osName}
                          </Badge>
                        )}
                        {device.isOld && device.age !== undefined && device.age >= 1 && (
                          <Badge variant="destructive">
                            {device.ageSource === "model" ? "~" : ""}{device.age} yr{device.age !== 1 ? "s" : ""} old
                          </Badge>
                        )}
                      </div>
                    </div>
                    {modelLabel && (
                      <div className="flex items-center gap-2 mt-1 ml-5 text-xs text-muted-foreground flex-wrap">
                        <span>{modelLabel}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.staleDevices && data.staleDevices.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Inactive Devices (30+ Days) — {data.staleDevices.length} device{data.staleDevices.length !== 1 ? "s" : ""}
            </h4>
            <div className="grid gap-2">
              {data.staleDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2"
                  data-testid={`device-stale-${device.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status="warning" />
                    <span className="text-sm font-medium truncate">
                      {device.systemName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({device.deviceType})
                    </span>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0 text-amber-600 dark:text-amber-400">
                    {device.daysSinceContact} days offline
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
          (!data.staleDevices || data.staleDevices.length === 0) &&
          data.criticalAlerts.length === 0 &&
          data.pendingPatchCount === 0 && (
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
