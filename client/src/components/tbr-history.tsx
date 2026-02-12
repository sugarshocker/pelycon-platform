import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  History,
  Monitor,
  Shield,
  Ticket,
  KeyRound,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import type { Organization, TbrSnapshot } from "@shared/schema";

interface TbrHistoryViewerProps {
  client: Organization;
  onClose: () => void;
}

export function TbrHistoryViewer({ client, onClose }: TbrHistoryViewerProps) {
  const { data: snapshots, isLoading } = useQuery<TbrSnapshot[]>({
    queryKey: ["/api/tbr/history", client.id],
    enabled: !!client.id,
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-12 pb-12">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">
                Past Reviews &mdash; {client.name}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-history"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-16 rounded-md" />
              </div>
            )}

            {!isLoading && (!snapshots || snapshots.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No finalized reviews found for this client yet.</p>
                <p className="text-xs mt-1 opacity-70">
                  Reviews will appear here after you finalize a TBR.
                </p>
              </div>
            )}

            {snapshots?.map((snapshot, index) => (
              <SnapshotRow
                key={snapshot.id}
                snapshot={snapshot}
                isExpanded={expandedId === snapshot.id}
                onToggle={() =>
                  setExpandedId(expandedId === snapshot.id ? null : snapshot.id)
                }
                previousSnapshot={snapshots[index + 1] || null}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SnapshotRow({
  snapshot,
  isExpanded,
  onToggle,
  previousSnapshot,
}: {
  snapshot: TbrSnapshot;
  isExpanded: boolean;
  onToggle: () => void;
  previousSnapshot: TbrSnapshot | null;
}) {
  const date = new Date(snapshot.createdAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-md border" data-testid={`tbr-snapshot-${snapshot.id}`}>
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover-elevate rounded-md"
        onClick={onToggle}
        data-testid={`button-expand-snapshot-${snapshot.id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{date}</p>
            <p className="text-xs text-muted-foreground">
              {snapshot.totalDevices} devices &middot; {snapshot.totalIncidents} incidents
              &middot; {snapshot.totalTickets} tickets
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {snapshot.urgentItemCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {snapshot.urgentItemCount} urgent
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <MetricCard
              icon={<Monitor className="h-3.5 w-3.5" />}
              label="Devices"
              value={snapshot.totalDevices}
              detail={`${snapshot.workstations} workstations, ${snapshot.servers} servers`}
            />
            <MetricCard
              icon={<Monitor className="h-3.5 w-3.5" />}
              label="Needs Replacement"
              value={snapshot.needsReplacementCount}
              detail={`${snapshot.eolOsCount} unsupported OS, ${snapshot.staleDeviceCount} stale`}
            />
            <MetricCard
              icon={<Monitor className="h-3.5 w-3.5" />}
              label="Patch Compliance"
              value={`${Math.round(snapshot.patchCompliancePercent)}%`}
              detail={`${snapshot.pendingPatchCount} patches pending`}
            />
            <MetricCard
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Security Incidents"
              value={snapshot.totalIncidents}
              detail={`${snapshot.pendingIncidents} pending, ${snapshot.activeAgents} agents`}
            />
            {snapshot.satLearnerCount !== null && (
              <MetricCard
                icon={<Shield className="h-3.5 w-3.5" />}
                label="SAT Enrollment"
                value={snapshot.satLearnerCount}
                detail={snapshot.satTotalUsers ? `of ${snapshot.satTotalUsers} total users` : undefined}
              />
            )}
            <MetricCard
              icon={<Ticket className="h-3.5 w-3.5" />}
              label="Tickets"
              value={snapshot.totalTickets}
              detail={`${snapshot.oldOpenTicketCount} aging tickets`}
            />
            {snapshot.mfaCoveragePercent !== null && (
              <MetricCard
                icon={<KeyRound className="h-3.5 w-3.5" />}
                label="MFA Coverage"
                value={`${snapshot.mfaCoveragePercent}%`}
                detail={`${snapshot.mfaCoveredCount ?? 0} of ${snapshot.mfaTotalUsers ?? 0} users`}
              />
            )}
            {snapshot.licenseAnnualWaste !== null && snapshot.licenseAnnualWaste > 0 && (
              <MetricCard
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="License Waste"
                value={`$${Math.round(snapshot.licenseAnnualWaste).toLocaleString()}/yr`}
                detail={`${snapshot.licenseTotalWasted ?? 0} unused licenses`}
              />
            )}
            <MetricCard
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Roadmap Items"
              value={snapshot.roadmapItemCount}
              detail={`${snapshot.urgentItemCount} urgent`}
            />
          </div>

          {previousSnapshot && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Changes from previous review
              </p>
              <div className="flex flex-wrap gap-2">
                <TrendBadge
                  label="Devices"
                  current={snapshot.totalDevices}
                  previous={previousSnapshot.totalDevices}
                />
                <TrendBadge
                  label="Incidents"
                  current={snapshot.totalIncidents}
                  previous={previousSnapshot.totalIncidents}
                  invertColor
                />
                <TrendBadge
                  label="Tickets"
                  current={snapshot.totalTickets}
                  previous={previousSnapshot.totalTickets}
                  invertColor
                />
                <TrendBadge
                  label="Needs Replacement"
                  current={snapshot.needsReplacementCount}
                  previous={previousSnapshot.needsReplacementCount}
                  invertColor
                />
                {snapshot.mfaCoveragePercent !== null && previousSnapshot.mfaCoveragePercent !== null && (
                  <TrendBadge
                    label="MFA"
                    current={snapshot.mfaCoveragePercent}
                    previous={previousSnapshot.mfaCoveragePercent}
                    suffix="%"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
    </div>
  );
}

function TrendBadge({
  label,
  current,
  previous,
  invertColor = false,
  suffix = "",
}: {
  label: string;
  current: number;
  previous: number;
  invertColor?: boolean;
  suffix?: string;
}) {
  const diff = current - previous;
  if (diff === 0) return null;

  const isUp = diff > 0;
  const isGood = invertColor ? !isUp : isUp;

  return (
    <Badge variant="outline" className="text-xs gap-1">
      <span className={isGood ? "text-emerald-500" : "text-red-500"}>
        {isUp ? "+" : ""}
        {diff}{suffix}
      </span>
      {label}
    </Badge>
  );
}
