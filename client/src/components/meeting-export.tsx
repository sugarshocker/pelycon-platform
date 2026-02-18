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
  DeviceUserEntry,
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
  deviceUserInventory?: DeviceUserEntry[] | null;
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
  deviceUserInventory,
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
        deviceUserInventory: deviceUserInventory || null,
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

      const filename = `TBR_${client.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

      const pdfOptions = {
        margin: [8, 8, 8, 8],
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          width: 800,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 800,
        },
        jsPDF: { unit: "mm", format: "letter", orientation: "portrait" as const },
        pagebreak: { mode: ["css"], avoid: [".item", ".action-card", ".snap-card"] },
      };

      await html2pdf()
        .set(pdfOptions as any)
        .from(content)
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
