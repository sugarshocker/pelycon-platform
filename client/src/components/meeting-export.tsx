import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Printer, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/queryClient";
import type {
  Organization,
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  RoadmapAnalysis,
} from "@shared/schema";

interface MeetingExportProps {
  client: Organization;
  deviceHealth: DeviceHealthSummary | null;
  security: SecuritySummary | null;
  tickets: TicketSummary | null;
  mfaReport: MfaReport | null;
  licenseReport: LicenseReport | null;
  roadmap: RoadmapAnalysis | null;
}

export function MeetingExport({
  client,
  deviceHealth,
  security,
  tickets,
  mfaReport,
  licenseReport,
  roadmap,
}: MeetingExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (mode: "download" | "print") => {
    setIsExporting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/export/summary", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientName: client.name,
          deviceHealth,
          security,
          tickets,
          mfaReport,
          licenseReport,
          roadmap,
        }),
      });

      if (!res.ok) throw new Error("Export failed");

      const html = await res.text();

      if (mode === "print") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        }
      } else {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TBR_${client.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: mode === "print" ? "Print Ready" : "Summary Exported",
        description:
          mode === "print"
            ? "Use Save as PDF in the print dialog for a PDF copy."
            : "The meeting summary has been downloaded.",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: "Could not generate the summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => handleExport("print")}
        disabled={isExporting}
        data-testid="button-print-summary"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Printer className="h-4 w-4 mr-1.5" />
        )}
        Print / Save PDF
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleExport("download")}
        disabled={isExporting}
        data-testid="button-download-summary"
      >
        <FileDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
