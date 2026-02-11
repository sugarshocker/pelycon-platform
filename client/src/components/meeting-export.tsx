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
  TbrSnapshot,
} from "@shared/schema";

interface MeetingExportProps {
  client: Organization;
  deviceHealth: DeviceHealthSummary | null;
  security: SecuritySummary | null;
  tickets: TicketSummary | null;
  mfaReport: MfaReport | null;
  licenseReport: LicenseReport | null;
  roadmap: RoadmapAnalysis | null;
  previousSnapshot?: TbrSnapshot | null;
}

export function MeetingExport({
  client,
  deviceHealth,
  security,
  tickets,
  mfaReport,
  licenseReport,
  roadmap,
  previousSnapshot,
}: MeetingExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const fetchHtml = async (): Promise<string> => {
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
        previousSnapshot: previousSnapshot || null,
      }),
    });

    if (res.status === 401) throw new Error("Session expired. Please log in again.");
    if (!res.ok) throw new Error("Export failed");
    return res.text();
  };

  const handlePrint = async () => {
    setIsExporting(true);
    try {
      const html = await fetchHtml();
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
      toast({
        title: "Print Ready",
        description: "Use Save as PDF in the print dialog for a PDF copy.",
      });
    } catch (err: any) {
      toast({
        title: "Export Failed",
        description: err.message || "Could not generate the summary.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfDownload = async () => {
    setIsExporting(true);
    try {
      const html = await fetchHtml();

      const html2pdf = (await import("html2pdf.js")).default;

      const container = document.createElement("div");
      container.innerHTML = html;
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);

      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:800px;font-family:'Poppins',sans-serif;";

      if (styleMatch) {
        const style = document.createElement("style");
        style.textContent = styleMatch[1];
        wrapper.appendChild(style);
      }

      const content = document.createElement("div");
      content.innerHTML = bodyMatch ? bodyMatch[1] : html;
      content.style.cssText = "padding:40px 24px;color:#394442;line-height:1.6;max-width:800px;margin:0 auto;";
      wrapper.appendChild(content);
      document.body.appendChild(wrapper);

      const filename = `TBR_${client.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

      const pdfOptions = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: "jpeg" as const, quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          width: 800,
        },
        jsPDF: { unit: "mm", format: "letter", orientation: "portrait" as const },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf()
        .set(pdfOptions as any)
        .from(wrapper)
        .save();

      document.body.removeChild(wrapper);

      toast({
        title: "PDF Downloaded",
        description: "The meeting summary PDF has been saved.",
      });
    } catch (err: any) {
      toast({
        title: "PDF Export Failed",
        description: err.message || "Could not generate the PDF. Try Print instead.",
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
        onClick={handlePdfDownload}
        disabled={isExporting}
        data-testid="button-download-pdf"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4 mr-1.5" />
        )}
        Save PDF
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrint}
        disabled={isExporting}
        data-testid="button-print-summary"
      >
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  );
}
