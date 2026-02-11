import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { StatusDot } from "./status-indicator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Monitor,
  Server,
  ShieldAlert,
  RefreshCw,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import type { DeviceHealthSummary, DeviceInfo, Organization } from "@shared/schema";

interface DeviceHealthProps {
  client: Organization;
}

type IssueReason = "aging" | "unsupported-os" | "inactive";

interface FlaggedDevice {
  device: DeviceInfo;
  reasons: IssueReason[];
}

function buildFlaggedDevices(data: DeviceHealthSummary): FlaggedDevice[] {
  const deviceMap = new Map<number, FlaggedDevice>();

  const getOrCreate = (device: DeviceInfo): FlaggedDevice => {
    let entry = deviceMap.get(device.id);
    if (!entry) {
      entry = { device, reasons: [] };
      deviceMap.set(device.id, entry);
    }
    return entry;
  };

  for (const d of data.oldDevices) {
    const entry = getOrCreate(d);
    if (!entry.reasons.includes("aging")) entry.reasons.push("aging");
  }
  for (const d of data.eolOsDevices) {
    const entry = getOrCreate(d);
    if (d.isEolOs && !entry.reasons.includes("unsupported-os")) entry.reasons.push("unsupported-os");
    if (d.isOld && !entry.reasons.includes("aging")) entry.reasons.push("aging");
  }
  for (const d of data.staleDevices || []) {
    const entry = getOrCreate(d);
    if (!entry.reasons.includes("inactive")) entry.reasons.push("inactive");
  }

  const list = Array.from(deviceMap.values());
  list.sort((a, b) => b.reasons.length - a.reasons.length || (b.device.age ?? 0) - (a.device.age ?? 0));
  return list;
}

function DeviceRow({ entry }: { entry: FlaggedDevice }) {
  const { device, reasons } = entry;
  const modelLabel = device.model
    ? device.manufacturer
      ? `${device.manufacturer} ${device.model}`
      : device.model
    : null;

  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-border/50 px-3 py-2.5"
      data-testid={`device-flagged-${device.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={reasons.length > 1 ? "action" : "warning"} />
          <span className="text-sm font-medium truncate" data-testid={`device-name-${device.id}`}>
            {device.systemName}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {device.deviceType}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {reasons.includes("unsupported-os") && (
            <Badge variant="outline" data-testid={`badge-eol-${device.id}`}>
              Unsupported OS
            </Badge>
          )}
          {reasons.includes("aging") && device.age !== undefined && (
            <Badge variant="destructive" data-testid={`badge-aging-${device.id}`}>
              {device.ageSource === "model" ? "~" : ""}
              {device.age} yr{device.age !== 1 ? "s" : ""} old
            </Badge>
          )}
          {reasons.includes("inactive") && device.daysSinceContact !== undefined && (
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400" data-testid={`badge-inactive-${device.id}`}>
              {device.daysSinceContact}d offline
            </Badge>
          )}
        </div>
      </div>
      {(modelLabel || (reasons.includes("unsupported-os") && device.osName)) && (
        <div className="flex items-center gap-3 ml-5 text-xs text-muted-foreground flex-wrap">
          {modelLabel && <span>{modelLabel}</span>}
          {reasons.includes("unsupported-os") && device.osName && (
            <span className="italic">{device.osName}</span>
          )}
          {device.ageSource === "model" && (
            <span className="text-[10px] italic">(age est. from model)</span>
          )}
        </div>
      )}
    </div>
  );
}

export function DeviceHealth({ client }: DeviceHealthProps) {
  const [showDetails, setShowDetails] = useState(true);
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
      { label: "Servers", count: tc?.windowsServers ?? 0, icon: <Server className="h-3.5 w-3.5" /> },
    ].filter((t) => t.count > 0);

    const flagged = buildFlaggedDevices(data);
    const agingCount = flagged.filter((f) => f.reasons.includes("aging")).length;
    const eolCount = flagged.filter((f) => f.reasons.includes("unsupported-os")).length;
    const inactiveCount = flagged.filter((f) => f.reasons.includes("inactive")).length;
    const hasIssues = flagged.length > 0 || data.pendingPatchCount > 0 || data.criticalAlerts.length > 0;

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <span className="text-2xl font-bold" data-testid="text-total-devices">
              {data.totalDevices}
            </span>
            <span className="text-xs text-muted-foreground">Total Devices</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold" data-testid="text-workstations">
                {data.workstations}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Workstations</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold" data-testid="text-servers">
                {data.servers}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Servers</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span
                className={`text-2xl font-bold ${flagged.length > 0 ? "text-red-600 dark:text-red-400" : ""}`}
                data-testid="text-needs-attention"
              >
                {flagged.length}
              </span>
            </div>
            <span className="text-xs text-muted-foreground text-center">Need Attention</span>
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
            <span className="text-sm font-medium" data-testid="text-pending-patches">
              {data.pendingPatchCount} patches awaiting installation (30+ days)
            </span>
          </div>
        )}

        {flagged.length > 0 && (
          <div className="space-y-3" data-testid="devices-needing-attention">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Devices Needing Attention</h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {agingCount > 0 && (
                    <Badge variant="destructive" className="text-[11px]">
                      {agingCount} aging
                    </Badge>
                  )}
                  {eolCount > 0 && (
                    <Badge variant="outline" className="text-[11px]">
                      {eolCount} unsupported OS
                    </Badge>
                  )}
                  {inactiveCount > 0 && (
                    <Badge variant="outline" className="text-[11px] text-amber-600 dark:text-amber-400">
                      {inactiveCount} inactive
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                data-testid="toggle-device-details"
              >
                {showDetails ? "Hide" : "Show"}
                {showDetails ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-1" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                )}
              </Button>
            </div>

            {showDetails && (
              <div className="grid gap-1.5" data-testid="flagged-device-list">
                {flagged.map((entry) => (
                  <DeviceRow key={entry.device.id} entry={entry} />
                ))}
              </div>
            )}
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
                  <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasIssues && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            All systems healthy — no issues found
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
