import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClientSelector } from "@/components/client-selector";
import { DeviceHealth } from "@/components/device-health";
import { SecuritySection } from "@/components/security-section";
import { TicketTrends } from "@/components/ticket-trends";
import { CippReports } from "@/components/cipp-reports";
import { AiRoadmap } from "@/components/ai-roadmap";
import { MeetingExport } from "@/components/meeting-export";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, LogOut, Shield, CheckCircle2, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type {
  Organization,
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  RoadmapAnalysis,
  ApiStatus,
} from "@shared/schema";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [selectedClient, setSelectedClient] = useState<Organization | null>(null);
  const [mfaReport, setMfaReport] = useState<MfaReport | null>(null);
  const [licenseReport, setLicenseReport] = useState<LicenseReport | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapAnalysis | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const { data: apiStatus } = useQuery<ApiStatus>({
    queryKey: ["/api/status"],
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

  const handleClientSelect = useCallback(
    (client: Organization) => {
      setSelectedClient(client);
      setMfaReport(null);
      setLicenseReport(null);
      setRoadmap(null);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none" data-testid="text-dashboard-title">
                Technology Business Review
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {today.toLocaleDateString("en-US", {
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
            <MeetingExport
              client={selectedClient}
              deviceHealth={deviceHealth || null}
              security={security || null}
              tickets={tickets || null}
              mfaReport={mfaReport}
              licenseReport={licenseReport}
              roadmap={roadmap}
            />
          )}
        </div>

        {selectedClient ? (
          <div className="space-y-4">
            <DeviceHealth client={selectedClient} />
            <SecuritySection client={selectedClient} />
            <TicketTrends client={selectedClient} />
            <CippReports
              mfaReport={mfaReport}
              licenseReport={licenseReport}
              onMfaUpload={setMfaReport}
              onLicenseUpload={setLicenseReport}
            />
            <AiRoadmap
              client={selectedClient}
              deviceHealth={deviceHealth || null}
              security={security || null}
              tickets={tickets || null}
              mfaReport={mfaReport}
              licenseReport={licenseReport}
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
            <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
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
    </div>
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
