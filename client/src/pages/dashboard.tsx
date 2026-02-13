import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClientSelector } from "@/components/client-selector";
import { DeviceHealth } from "@/components/device-health";
import { SecuritySection } from "@/components/security-section";
import { TicketTrends } from "@/components/ticket-trends";
import { ProjectSummary } from "@/components/project-summary";
import { CippReports } from "@/components/cipp-reports";
import { InternalNotesSection, type InternalNotes } from "@/components/internal-notes";
import { ClientFeedbackSection, type ClientFeedback } from "@/components/client-feedback";
import { AiRoadmap } from "@/components/ai-roadmap";
import { MeetingExport } from "@/components/meeting-export";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme-provider";
import {
  Sun, Moon, LogOut, CheckCircle2, XCircle, Save, Loader2,
  History, FileText, AlertCircle, Plus, ArrowLeft, ChevronDown,
  ChevronUp, Monitor, Shield, Ticket, KeyRound, AlertTriangle,
  MessageSquare, StickyNote, CheckSquare, Square, FileDown,
  Unlock, Zap, Copy, Mail, Check,
} from "lucide-react";
import { apiRequest, clearToken, getToken, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import pelyconLogo from "@assets/Pelycon_Logomark_RGB_Orange_1770825725925.png";
import type {
  Organization,
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  RoadmapAnalysis,
  ApiStatus,
  TbrSnapshot,
  DeviceUserEntry,
} from "@shared/schema";

type DashboardView = "overview" | "editor";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [selectedClient, setSelectedClient] = useState<Organization | null>(null);
  const [view, setView] = useState<DashboardView>("overview");
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const { data: apiStatus } = useQuery<ApiStatus>({
    queryKey: ["/api/status"],
    retry: 2,
    retryDelay: 1000,
  });

  const handleClientSelect = useCallback((client: Organization) => {
    setSelectedClient(client);
    setView("overview");
  }, []);

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      onLogout();
    } catch {
      onLogout();
    }
  };

  const today = new Date();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={pelyconLogo} alt="Pelycon Technologies" className="h-8 w-8 object-contain flex-shrink-0" />
            <div>
              <h1 className="text-base font-semibold leading-none" data-testid="text-dashboard-title">
                Technology Business Review
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pelycon Technologies &middot; {today.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {apiStatus && (
              <div className="hidden md:flex items-center gap-2 mr-2">
                <ConnectionBadge name="NinjaOne" connected={apiStatus.ninjaone} />
                <ConnectionBadge name="Huntress" connected={apiStatus.huntress} />
                <ConnectionBadge name="ConnectWise" connected={apiStatus.connectwise} />
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {view === "overview" && (
          <>
            <ClientSelector selectedClient={selectedClient} onSelectClient={handleClientSelect} />
            {selectedClient ? (
              <ClientOverview
                client={selectedClient}
                onStartNew={() => setView("editor")}
                onResumeDraft={() => setView("editor")}
                onEditSnapshot={() => setView("editor")}
              />
            ) : (
              <div className="text-center py-20">
                <img src={pelyconLogo} alt="Pelycon Technologies" className="h-16 w-16 object-contain mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2" data-testid="text-select-prompt">
                  Select a Client
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Choose a client from the dropdown above to view their review history
                  or start a new Technology Business Review.
                </p>
              </div>
            )}
          </>
        )}

        {view === "editor" && selectedClient && (
          <TbrEditor
            key={`editor-${selectedClient.id}`}
            client={selectedClient}
            onBack={() => {
              setView("overview");
              queryClient.invalidateQueries({ queryKey: ["/api/tbr/history", selectedClient.id] });
              queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", selectedClient.id] });
              queryClient.invalidateQueries({ queryKey: ["/api/tbr/latest", selectedClient.id] });
            }}
          />
        )}
      </main>
    </div>
  );
}

function ClientOverview({
  client,
  onStartNew,
  onResumeDraft,
  onEditSnapshot,
}: {
  client: Organization;
  onStartNew: () => void;
  onResumeDraft: () => void;
  onEditSnapshot: () => void;
}) {
  const { toast } = useToast();

  const { data: snapshots, isLoading: historyLoading } = useQuery<TbrSnapshot[]>({
    queryKey: ["/api/tbr/history", client.id],
    enabled: !!client.id,
  });

  const { data: draftData } = useQuery<{ draft: TbrSnapshot | null }>({
    queryKey: ["/api/tbr/draft", client.id],
    enabled: !!client.id,
  });

  const draft = draftData?.draft || null;

  const unfinalizeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/tbr/unfinalize/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/history", client.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", client.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/latest", client.id] });
      toast({ title: "TBR Reopened", description: "The review has been reopened as a draft. You can now edit it." });
      onEditSnapshot();
    },
    onError: (err: any) => {
      const msg = err?.message || "Could not un-finalize this review.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const discardDraftMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/tbr/draft/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", client.id] });
      toast({ title: "Draft discarded" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to discard draft.", variant: "destructive" });
    },
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-client-name">{client.name}</h2>
          <p className="text-sm text-muted-foreground">Review History & Management</p>
        </div>
        <Button onClick={onStartNew} data-testid="button-start-new-tbr">
          <Plus className="h-4 w-4 mr-1.5" />
          Start New Review
        </Button>
      </div>

      {draft && (
        <Card className="border-[hsl(var(--brand-orange,30_80%_53%))] bg-[hsl(var(--brand-orange,30_80%_53%)/0.05)]">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-[hsl(var(--brand-orange,30_80%_53%))] flex-shrink-0" />
                <span>
                  Draft in progress — last saved{" "}
                  <strong>
                    {new Date(draft.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </strong>
                  {" at "}
                  {new Date(draft.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => discardDraftMutation.mutate(draft.id)} data-testid="button-discard-draft">
                  Discard
                </Button>
                <Button size="sm" onClick={onResumeDraft} data-testid="button-resume-draft">
                  <FileText className="h-4 w-4 mr-1.5" />
                  Resume Draft
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Past Reviews</h3>
        </div>

        {historyLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
          </div>
        )}

        {!historyLoading && (!snapshots || snapshots.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No finalized reviews yet for this client.</p>
              <p className="text-xs mt-1 opacity-70">
                Start a new review to begin tracking this client's technology health over time.
              </p>
            </CardContent>
          </Card>
        )}

        {snapshots?.map((snapshot, index) => (
          <SnapshotCard
            key={snapshot.id}
            snapshot={snapshot}
            isExpanded={expandedId === snapshot.id}
            onToggle={() => setExpandedId(expandedId === snapshot.id ? null : snapshot.id)}
            previousSnapshot={snapshots[index + 1] || null}
            onUnfinalize={() => unfinalizeMutation.mutate(snapshot.id)}
            isUnfinalizing={unfinalizeMutation.isPending}
            hasDraft={!!draft}
          />
        ))}
      </div>
    </div>
  );
}

function SnapshotCard({
  snapshot,
  isExpanded,
  onToggle,
  previousSnapshot,
  onUnfinalize,
  isUnfinalizing,
  hasDraft,
}: {
  snapshot: TbrSnapshot;
  isExpanded: boolean;
  onToggle: () => void;
  previousSnapshot: TbrSnapshot | null;
  onUnfinalize: () => void;
  isUnfinalizing: boolean;
  hasDraft: boolean;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const date = new Date(snapshot.createdAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const headers: Record<string, string> = {};
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/export/snapshot/${snapshot.id}`, { headers });
      if (!res.ok) throw new Error("Export failed");
      const html = await res.text();

      const html2pdf = (await import("html2pdf.js")).default;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:fixed;left:0;top:0;width:800px;z-index:99999;pointer-events:none;background:white;";

      const styleEl = doc.querySelector("style");
      if (styleEl) {
        const s = document.createElement("style");
        s.textContent = styleEl.textContent || "";
        wrapper.appendChild(s);
      }

      const content = document.createElement("div");
      content.innerHTML = doc.body.innerHTML;
      content.style.cssText = "font-family:'Poppins',sans-serif;padding:36px 24px;color:#394442;line-height:1.5;font-size:13px;max-width:780px;margin:0 auto;background:white;";
      wrapper.appendChild(content);
      document.body.appendChild(wrapper);

      await new Promise(r => setTimeout(r, 100));

      const dateStr = new Date(snapshot.createdAt).toISOString().split("T")[0];
      const filename = `TBR_${snapshot.orgName.replace(/\s+/g, "_")}_${dateStr}.pdf`;

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename,
          image: { type: "jpeg" as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true, width: 800, scrollX: 0, scrollY: 0, windowWidth: 800 },
          jsPDF: { unit: "mm", format: "letter", orientation: "portrait" as const },
          pagebreak: { mode: ["css"], avoid: [".section-top", ".item", ".action-card", ".snap-card", ".snapshot-grid"] },
        } as any)
        .from(content)
        .save();

      document.body.removeChild(wrapper);
      toast({ title: "PDF Downloaded", description: "The review PDF has been saved." });
    } catch (err: any) {
      toast({ title: "PDF Export Failed", description: err.message || "Could not generate PDF.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card data-testid={`tbr-snapshot-${snapshot.id}`}>
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
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-4 border-t">
          <div className="flex items-center gap-2 mt-3 mb-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isDownloading} data-testid={`button-pdf-snapshot-${snapshot.id}`}>
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-1.5" />}
              Download PDF
            </Button>
            <FollowUpEmailDraft clientName={snapshot.orgName} fullData={snapshot.fullData} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnfinalize}
              disabled={isUnfinalizing || hasDraft}
              data-testid={`button-unfinalize-${snapshot.id}`}
            >
              {isUnfinalizing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5 mr-1.5" />}
              Reopen as Draft
            </Button>
            {hasDraft && (
              <span className="text-xs text-muted-foreground">Discard existing draft to reopen this review</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard icon={<Monitor className="h-3.5 w-3.5" />} label="Devices" value={snapshot.totalDevices} detail={`${snapshot.workstations} workstations, ${snapshot.servers} servers`} />
            <MetricCard icon={<Monitor className="h-3.5 w-3.5" />} label="Needs Replacement" value={snapshot.needsReplacementCount} detail={`${snapshot.eolOsCount} unsupported OS, ${snapshot.staleDeviceCount} stale`} />
            <MetricCard icon={<Monitor className="h-3.5 w-3.5" />} label="Patch Compliance" value={`${Math.round(snapshot.patchCompliancePercent)}%`} detail={`${snapshot.pendingPatchCount} patches pending`} />
            <MetricCard icon={<Shield className="h-3.5 w-3.5" />} label="Security Incidents" value={snapshot.totalIncidents} detail={`${snapshot.pendingIncidents} pending, ${snapshot.activeAgents} agents`} />
            {snapshot.satLearnerCount !== null && (
              <MetricCard icon={<Shield className="h-3.5 w-3.5" />} label="SAT Enrollment" value={snapshot.satLearnerCount} detail={snapshot.satTotalUsers ? `of ${snapshot.satTotalUsers} total users` : undefined} />
            )}
            <MetricCard icon={<Ticket className="h-3.5 w-3.5" />} label="Tickets" value={snapshot.totalTickets} detail={`${snapshot.oldOpenTicketCount} aging tickets`} />
            {snapshot.mfaCoveragePercent !== null && (
              <MetricCard icon={<KeyRound className="h-3.5 w-3.5" />} label="MFA Coverage" value={`${snapshot.mfaCoveragePercent}%`} detail={`${snapshot.mfaCoveredCount ?? 0} of ${snapshot.mfaTotalUsers ?? 0} users`} />
            )}
            {snapshot.licenseAnnualWaste !== null && snapshot.licenseAnnualWaste > 0 && (
              <MetricCard icon={<AlertTriangle className="h-3.5 w-3.5" />} label="License Waste" value={`$${Math.round(snapshot.licenseAnnualWaste).toLocaleString()}/yr`} detail={`${snapshot.licenseTotalWasted ?? 0} unused licenses`} />
            )}
            <MetricCard icon={<FileText className="h-3.5 w-3.5" />} label="Roadmap Items" value={snapshot.roadmapItemCount} detail={`${snapshot.urgentItemCount} urgent`} />
          </div>

          {previousSnapshot && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Changes from previous review</p>
              <div className="flex flex-wrap gap-2">
                <TrendBadge label="Devices" current={snapshot.totalDevices} previous={previousSnapshot.totalDevices} />
                <TrendBadge label="Incidents" current={snapshot.totalIncidents} previous={previousSnapshot.totalIncidents} invertColor />
                <TrendBadge label="Tickets" current={snapshot.totalTickets} previous={previousSnapshot.totalTickets} invertColor />
                <TrendBadge label="Needs Replacement" current={snapshot.needsReplacementCount} previous={previousSnapshot.needsReplacementCount} invertColor />
                {snapshot.mfaCoveragePercent !== null && previousSnapshot.mfaCoveragePercent !== null && (
                  <TrendBadge label="MFA" current={snapshot.mfaCoveragePercent} previous={previousSnapshot.mfaCoveragePercent} suffix="%" />
                )}
              </div>
            </div>
          )}

          <NotesAndFeedbackSection fullData={snapshot.fullData} />
        </CardContent>
      )}
    </Card>
  );
}

function TbrEditor({ client, onBack }: { client: Organization; onBack: () => void }) {
  const [mfaReport, setMfaReport] = useState<MfaReport | null>(null);
  const [licenseReport, setLicenseReport] = useState<LicenseReport | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapAnalysis | null>(null);
  const [internalNotes, setInternalNotes] = useState<InternalNotes>({ serviceManagerNotes: "", leadEngineerNotes: "" });
  const [clientFeedback, setClientFeedback] = useState<ClientFeedback>({ notes: "", followUpTasks: [] });
  const [hasDraft, setHasDraft] = useState(false);
  const [showFinalizationEmail, setShowFinalizationEmail] = useState(false);
  const { toast } = useToast();

  const { data: deviceHealth } = useQuery<DeviceHealthSummary>({
    queryKey: ["/api/devices", client.id],
    enabled: !!client.id,
  });

  const { data: security } = useQuery<SecuritySummary>({
    queryKey: ["/api/security", client.id],
    enabled: !!client.id,
  });

  const { data: tickets } = useQuery<TicketSummary>({
    queryKey: ["/api/tickets", client.id],
    enabled: !!client.id,
  });

  const { data: tbrHistory } = useQuery<{ latest: TbrSnapshot | null; previous: TbrSnapshot | null }>({
    queryKey: ["/api/tbr/latest", client.id],
    enabled: !!client.id,
  });

  const { data: draftData } = useQuery<{ draft: TbrSnapshot | null }>({
    queryKey: ["/api/tbr/draft", client.id],
    enabled: !!client.id,
  });

  const { data: deviceUserData } = useQuery<{ devices: DeviceUserEntry[] }>({
    queryKey: ["/api/device-users", client.id],
    enabled: !!client.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (draftData?.draft?.fullData) {
      const fd = draftData.draft.fullData as any;
      setMfaReport(fd.mfaReport || null);
      setLicenseReport(fd.licenseReport || null);
      setRoadmap(fd.roadmap || null);
      setInternalNotes(fd.internalNotes || { serviceManagerNotes: "", leadEngineerNotes: "" });
      setClientFeedback(fd.clientFeedback || { notes: "", followUpTasks: [] });
      setHasDraft(true);
    } else {
      setMfaReport(null);
      setLicenseReport(null);
      setRoadmap(null);
      setInternalNotes({ serviceManagerNotes: "", leadEngineerNotes: "" });
      setClientFeedback({ notes: "", followUpTasks: [] });
      setHasDraft(false);
    }
  }, [draftData]);

  useEffect(() => {
    if (!client || !deviceUserData?.devices) return;
    const unprotected = deviceUserData.devices.filter(d => !d.huntressProtected);

    setClientFeedback(prev => {
      const withoutAuto = prev.followUpTasks.filter(t => t.id !== "auto-huntress-gap");
      if (unprotected.length === 0) {
        if (withoutAuto.length === prev.followUpTasks.length) return prev;
        return { ...prev, followUpTasks: withoutAuto };
      }
      const names = unprotected.map(d => d.hostname).slice(0, 10).join(", ");
      const suffix = unprotected.length > 10 ? ` (+${unprotected.length - 10} more)` : "";
      return {
        ...prev,
        followUpTasks: [...withoutAuto, {
          id: "auto-huntress-gap",
          text: `Reconcile Huntress/NinjaOne disparity: ${unprotected.length} device(s) not protected by Huntress — ${names}${suffix}. Ensure Huntress is reporting properly on all managed machines.`,
          completed: false,
        }],
      };
    });
  }, [deviceUserData, client]);

  useEffect(() => {
    if (!client || !licenseReport) return;
    const unused = licenseReport.licenses.filter(l => l.wasted > 0);

    setClientFeedback(prev => {
      const withoutAuto = prev.followUpTasks.filter(t => t.id !== "auto-license-cleanup");
      if (unused.length === 0) {
        if (withoutAuto.length === prev.followUpTasks.length) return prev;
        return { ...prev, followUpTasks: withoutAuto };
      }
      const lines = unused.map(l => `${l.licenseName}: ${l.wasted} unused ($${(l.monthlyWastedCost * 12).toFixed(0)}/yr)`).join("; ");
      return {
        ...prev,
        followUpTasks: [...withoutAuto, {
          id: "auto-license-cleanup",
          text: `Remove unused MS365 licenses to reduce waste — ${lines}. Total annual savings: $${Math.round(licenseReport.totalAnnualWaste).toLocaleString()}.`,
          completed: false,
        }],
      };
    });
  }, [licenseReport, client]);

  const buildPayload = useCallback(() => {
    return {
      orgId: client.id,
      orgName: client.name,
      deviceHealth: deviceHealth || null,
      security: security || null,
      tickets: tickets || null,
      mfaReport: mfaReport,
      licenseReport: licenseReport,
      roadmap: roadmap,
      internalNotes: internalNotes,
      clientFeedback: clientFeedback,
    };
  }, [client, deviceHealth, security, tickets, mfaReport, licenseReport, roadmap, internalNotes, clientFeedback]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tbr/save-draft", buildPayload());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", client.id] });
      setHasDraft(true);
      toast({ title: "Draft Saved", description: `TBR draft saved for ${client.name}. You can resume this review later.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save the draft. Please try again.", variant: "destructive" });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tbr/finalize", buildPayload());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/latest", client.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", client.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/history", client.id] });
      setHasDraft(false);
      setShowFinalizationEmail(true);
      toast({ title: "TBR Finalized", description: `Review recorded for ${client.name}. Copy the follow-up email below, then head back to overview.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to finalize the TBR. Please try again.", variant: "destructive" });
    },
  });

  const previousSnapshot = tbrHistory?.previous || null;

  if (showFinalizationEmail) {
    const emailFollowUps = clientFeedback.followUpTasks;
    const emailText = generateFollowUpEmail(client.name, emailFollowUps);

    return (
      <FinalizationConfirmation
        clientName={client.name}
        emailText={emailText}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-overview">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-editor-client">{client.name}</h2>
            <p className="text-sm text-muted-foreground">
              {hasDraft ? "Editing Draft" : "New Review"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MeetingExport
            client={client}
            deviceHealth={deviceHealth || null}
            security={security || null}
            tickets={tickets || null}
            mfaReport={mfaReport}
            licenseReport={licenseReport}
            roadmap={roadmap}
            previousSnapshot={previousSnapshot}
            deviceUserInventory={deviceUserData?.devices || null}
          />
          <Button
            variant="outline"
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending}
            data-testid="button-save-draft"
          >
            {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}
            Save Draft
          </Button>
          <Button
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending}
            data-testid="button-finalize-tbr"
          >
            {finalizeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Finalize TBR
          </Button>
        </div>
      </div>

      {previousSnapshot && <PreviousTbrBanner snapshot={previousSnapshot} />}

      <DeviceHealth client={client} />
      <SecuritySection client={client} />
      <TicketTrends client={client} />
      <ProjectSummary client={client} />
      <CippReports
        mfaReport={mfaReport}
        licenseReport={licenseReport}
        onMfaUpload={setMfaReport}
        onLicenseUpload={setLicenseReport}
      />
      <InternalNotesSection
        notes={internalNotes}
        onNotesChange={setInternalNotes}
      />
      <ClientFeedbackSection
        feedback={clientFeedback}
        onFeedbackChange={setClientFeedback}
        previousFollowUps={(previousSnapshot?.fullData as any)?.clientFeedback?.followUpTasks}
      />
      <AiRoadmap
        client={client}
        deviceHealth={deviceHealth || null}
        security={security || null}
        tickets={tickets || null}
        mfaReport={mfaReport}
        licenseReport={licenseReport}
        internalNotes={internalNotes}
        roadmap={roadmap}
        onRoadmapGenerated={setRoadmap}
      />
    </div>
  );
}

function PreviousTbrBanner({ snapshot }: { snapshot: TbrSnapshot }) {
  const date = new Date(snapshot.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">
            Previous TBR recorded on <strong className="text-foreground">{date}</strong>
            {" "}&mdash; {snapshot.totalDevices} devices, {snapshot.totalIncidents} incidents
            {snapshot.mfaCoveragePercent !== null && `, ${snapshot.mfaCoveragePercent}% MFA coverage`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail?: string }) {
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

function NotesAndFeedbackSection({ fullData }: { fullData: any }) {
  if (!fullData) return null;

  const internalNotes = fullData.internalNotes;
  const clientFeedback = fullData.clientFeedback;
  const hasServiceNotes = internalNotes?.serviceManagerNotes?.trim();
  const hasEngineerNotes = internalNotes?.leadEngineerNotes?.trim();
  const hasClientNotes = clientFeedback?.notes?.trim();
  const hasFollowUps = clientFeedback?.followUpTasks?.length > 0;

  if (!hasServiceNotes && !hasEngineerNotes && !hasClientNotes && !hasFollowUps) return null;

  return (
    <div className="mt-4 pt-3 border-t space-y-3">
      {(hasServiceNotes || hasEngineerNotes) && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Internal Notes</p>
          </div>
          <div className="space-y-2">
            {hasServiceNotes && (
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Service Manager</p>
                <p className="text-sm whitespace-pre-wrap">{internalNotes.serviceManagerNotes}</p>
              </div>
            )}
            {hasEngineerNotes && (
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Lead Engineer</p>
                <p className="text-sm whitespace-pre-wrap">{internalNotes.leadEngineerNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {hasClientNotes && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Client Feedback</p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-sm whitespace-pre-wrap">{clientFeedback.notes}</p>
          </div>
        </div>
      )}
      {hasFollowUps && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Follow-Up Tasks</p>
          </div>
          <div className="space-y-1">
            {clientFeedback.followUpTasks.map((task: any) => (
              <div key={task.id} className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-1.5">
                {task.completed ? (
                  <CheckSquare className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <p className={`text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendBadge({ label, current, previous, invertColor = false, suffix = "" }: { label: string; current: number; previous: number; invertColor?: boolean; suffix?: string }) {
  const diff = current - previous;
  if (diff === 0) return null;
  const isUp = diff > 0;
  const isGood = invertColor ? !isUp : isUp;

  return (
    <Badge variant="outline" className="text-xs gap-1">
      <span className={isGood ? "text-emerald-500" : "text-red-500"}>
        {isUp ? "+" : ""}{diff}{suffix}
      </span>
      {label}
    </Badge>
  );
}

function FinalizationConfirmation({ clientName, emailText, onBack }: { clientName: string; emailText: string; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailText);
      setCopied(true);
      toast({ title: "Copied to clipboard", description: "Paste the email into your mail client and attach the PDF." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please select and copy the text manually.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-finalized-title">Review Finalized</h2>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </div>
        </div>
        <Button onClick={onBack} data-testid="button-done-overview">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Overview
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Follow-Up Email Draft</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-finalization-email">
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy to Clipboard"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Copy this email, paste it into your mail client, and attach the PDF summary.
          </p>
          <div className="rounded-md bg-muted/50 px-4 py-3">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" data-testid="text-finalization-email">{emailText}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function generateFollowUpEmail(clientName: string, followUpTasks: Array<{ id: string; text: string; completed: boolean }> | undefined): string {
  const tasks = (followUpTasks || []).filter(t => !t.completed);

  let email = `Hi there,\n\nThank you for taking the time to meet with us today for your Technology Business Review. We really appreciate the partnership and the chance to make sure everything is running smoothly for your team.\n\nAttached you'll find the PDF summary of what we covered during our conversation.`;

  if (tasks.length > 0) {
    email += `\n\nBased on our discussion, here are the items Nick and the team will be working through:\n`;
    tasks.forEach((task, i) => {
      const cleanText = task.text.replace(/^Reconcile Huntress\/NinjaOne disparity: /, "Reconcile endpoint protection coverage: ").replace(/^Remove unused MS365 licenses to reduce waste — /, "Clean up unused Microsoft 365 licenses: ");
      email += `\n  ${i + 1}. ${cleanText}`;
    });
    email += `\n\nWe'll keep you posted on progress and reach out if we need anything from your side.`;
  } else {
    email += `\n\nEverything is looking solid on our end — no outstanding action items from this review.`;
  }

  email += `\n\nAs always, don't hesitate to reach out if anything comes up before our next review. We're here to help.\n\nBest,\nNick\nPelycon Technologies`;

  return email;
}

function FollowUpEmailDraft({ clientName, fullData, className }: { clientName: string; fullData: any; className?: string }) {
  const [showEmail, setShowEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const followUpTasks = fullData?.clientFeedback?.followUpTasks;
  const emailText = generateFollowUpEmail(clientName, followUpTasks);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailText);
      setCopied(true);
      toast({ title: "Copied to clipboard", description: "The follow-up email has been copied. Paste it into your email client." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please select and copy the text manually.", variant: "destructive" });
    }
  };

  if (!showEmail) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowEmail(true)} className={className} data-testid="button-show-followup-email">
        <Mail className="h-3.5 w-3.5 mr-1.5" />
        Follow-Up Email
      </Button>
    );
  }

  return (
    <div className={`mt-3 ${className || ""}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">Follow-Up Email Draft</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-email">
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowEmail(false)} data-testid="button-hide-email">
            Hide
          </Button>
        </div>
      </div>
      <div className="rounded-md bg-muted/50 px-4 py-3">
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" data-testid="text-followup-email">{emailText}</pre>
      </div>
    </div>
  );
}

function ConnectionBadge({ name, connected }: { name: string; connected: boolean }) {
  return (
    <Badge variant="outline" className="text-xs gap-1">
      {connected ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
      {name}
    </Badge>
  );
}
