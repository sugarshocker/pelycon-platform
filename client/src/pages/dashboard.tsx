import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClientSelector } from "@/components/client-selector";
import { DeviceHealth } from "@/components/device-health";
import { SecuritySection } from "@/components/security-section";
import { TicketTrends } from "@/components/ticket-trends";
import { ProjectSummary } from "@/components/project-summary";
import { CippReports } from "@/components/cipp-reports";
import { InternalNotesSection, type InternalNotes } from "@/components/internal-notes";
import { AiRoadmap } from "@/components/ai-roadmap";
import { MeetingExport } from "@/components/meeting-export";
import { TbrHistoryViewer } from "@/components/tbr-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, LogOut, CheckCircle2, XCircle, Save, Loader2, History, FileText, AlertCircle } from "lucide-react";
import { apiRequest, clearToken, queryClient } from "@/lib/queryClient";
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

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [selectedClient, setSelectedClient] = useState<Organization | null>(null);
  const [mfaReport, setMfaReport] = useState<MfaReport | null>(null);
  const [licenseReport, setLicenseReport] = useState<LicenseReport | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapAnalysis | null>(null);
  const [internalNotes, setInternalNotes] = useState<InternalNotes>({ serviceManagerNotes: "", leadEngineerNotes: "" });
  const [hasDraft, setHasDraft] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const { data: apiStatus } = useQuery<ApiStatus>({
    queryKey: ["/api/status"],
    retry: 2,
    retryDelay: 1000,
  });

  const { data: deviceHealth } = useQuery<DeviceHealthSummary>({
    queryKey: ["/api/devices", selectedClient?.id],
    enabled: !!selectedClient,
  });

  const { data: security } = useQuery<SecuritySummary>({
    queryKey: ["/api/security", selectedClient?.id],
    enabled: !!selectedClient,
  });

  const { data: tickets } = useQuery<TicketSummary>({
    queryKey: ["/api/tickets", selectedClient?.id],
    enabled: !!selectedClient,
  });

  const { data: tbrHistory } = useQuery<{ latest: TbrSnapshot | null; previous: TbrSnapshot | null }>({
    queryKey: ["/api/tbr/latest", selectedClient?.id],
    enabled: !!selectedClient,
  });

  const { data: draftData } = useQuery<{ draft: TbrSnapshot | null }>({
    queryKey: ["/api/tbr/draft", selectedClient?.id],
    enabled: !!selectedClient,
  });

  const { data: deviceUserData } = useQuery<{ devices: DeviceUserEntry[] }>({
    queryKey: ["/api/device-users", selectedClient?.id],
    enabled: !!selectedClient,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (draftData?.draft?.fullData) {
      const fd = draftData.draft.fullData as any;
      if (fd.mfaReport) setMfaReport(fd.mfaReport);
      if (fd.licenseReport) setLicenseReport(fd.licenseReport);
      if (fd.roadmap) setRoadmap(fd.roadmap);
      if (fd.internalNotes) setInternalNotes(fd.internalNotes);
      setHasDraft(true);
    } else {
      setHasDraft(false);
    }
  }, [draftData]);

  const buildPayload = useCallback(() => {
    if (!selectedClient) throw new Error("No client selected");
    return {
      orgId: selectedClient.id,
      orgName: selectedClient.name,
      deviceHealth: deviceHealth || null,
      security: security || null,
      tickets: tickets || null,
      mfaReport: mfaReport,
      licenseReport: licenseReport,
      roadmap: roadmap,
      internalNotes: internalNotes,
    };
  }, [selectedClient, deviceHealth, security, tickets, mfaReport, licenseReport, roadmap, internalNotes]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tbr/save-draft", buildPayload());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", selectedClient?.id] });
      setHasDraft(true);
      toast({
        title: "Draft Saved",
        description: `TBR draft saved for ${selectedClient?.name}. You can resume this review later.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save the draft. Please try again.",
        variant: "destructive",
      });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tbr/finalize", buildPayload());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/latest", selectedClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", selectedClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tbr/history", selectedClient?.id] });
      setHasDraft(false);
      toast({
        title: "TBR Finalized",
        description: `This review has been recorded for ${selectedClient?.name}. The next review will show trends compared to this snapshot.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to finalize the TBR. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClientSelect = useCallback(
    (client: Organization) => {
      setSelectedClient(client);
      setMfaReport(null);
      setLicenseReport(null);
      setRoadmap(null);
      setInternalNotes({ serviceManagerNotes: "", leadEngineerNotes: "" });
      setHasDraft(false);
    },
    []
  );

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      onLogout();
    } catch {
      onLogout();
    }
  };

  const today = new Date();
  const nextTbr = new Date(today);
  nextTbr.setMonth(nextTbr.getMonth() + 6);

  const previousSnapshot = tbrHistory?.previous || null;

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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <ClientSelector
            selectedClient={selectedClient}
            onSelectClient={handleClientSelect}
          />
          {selectedClient && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setShowHistory(true)}
                data-testid="button-tbr-history"
              >
                <History className="h-4 w-4 mr-1.5" />
                Past Reviews
              </Button>
              <MeetingExport
                client={selectedClient}
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
                {saveDraftMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-1.5" />
                )}
                Save Draft
              </Button>
              <Button
                onClick={() => finalizeMutation.mutate()}
                disabled={finalizeMutation.isPending}
                data-testid="button-finalize-tbr"
              >
                {finalizeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Finalize TBR
              </Button>
            </div>
          )}
        </div>

        {hasDraft && selectedClient && draftData?.draft && (
          <DraftBanner
            draft={draftData.draft}
            onDiscard={async () => {
              try {
                await apiRequest("DELETE", `/api/tbr/draft/${draftData.draft!.id}`);
                queryClient.invalidateQueries({ queryKey: ["/api/tbr/draft", selectedClient.id] });
                setMfaReport(null);
                setLicenseReport(null);
                setRoadmap(null);
                setInternalNotes({ serviceManagerNotes: "", leadEngineerNotes: "" });
                setHasDraft(false);
                toast({ title: "Draft discarded" });
              } catch {
                toast({ title: "Error", description: "Failed to discard draft.", variant: "destructive" });
              }
            }}
          />
        )}

        {previousSnapshot && selectedClient && (
          <PreviousTbrBanner snapshot={previousSnapshot} />
        )}

        {selectedClient ? (
          <div className="space-y-4">
            <DeviceHealth client={selectedClient} />
            <SecuritySection client={selectedClient} />
            <TicketTrends client={selectedClient} />
            <ProjectSummary client={selectedClient} />
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
            <AiRoadmap
              client={selectedClient}
              deviceHealth={deviceHealth || null}
              security={security || null}
              tickets={tickets || null}
              mfaReport={mfaReport}
              licenseReport={licenseReport}
              internalNotes={internalNotes}
              roadmap={roadmap}
              onRoadmapGenerated={setRoadmap}
            />

            <div className="text-center py-4 text-sm text-muted-foreground">
              Next Technology Business Review:{" "}
              <strong>
                {nextTbr.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <img src={pelyconLogo} alt="Pelycon Technologies" className="h-16 w-16 object-contain mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2" data-testid="text-select-prompt">
              Select a Client
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Choose a client from the dropdown above to load their technology
              review data.
            </p>
          </div>
        )}
      </main>

      {showHistory && selectedClient && (
        <TbrHistoryViewer
          client={selectedClient}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

function DraftBanner({ draft, onDiscard }: { draft: TbrSnapshot; onDiscard: () => void }) {
  const date = new Date(draft.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = new Date(draft.updatedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="border-[hsl(var(--brand-orange,30_80%_53%))] bg-[hsl(var(--brand-orange,30_80%_53%)/0.05)]">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-[hsl(var(--brand-orange,30_80%_53%))] flex-shrink-0" />
            <span>
              Draft saved on <strong>{date}</strong> at {time}
              {" "}&mdash; uploaded reports and notes have been restored.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onDiscard} data-testid="button-discard-draft">
            Discard Draft
          </Button>
        </div>
      </CardContent>
    </Card>
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

function ConnectionBadge({
  name,
  connected,
}: {
  name: string;
  connected: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className="text-xs gap-1"
    >
      {connected ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <XCircle className="h-3 w-3 text-muted-foreground" />
      )}
      {name}
    </Badge>
  );
}
