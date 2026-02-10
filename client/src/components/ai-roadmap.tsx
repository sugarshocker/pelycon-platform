import { useState } from "react";
import { CollapsibleSection } from "./collapsible-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/queryClient";
import type {
  RoadmapAnalysis,
  RoadmapItem,
  DeviceHealthSummary,
  SecuritySummary,
  TicketSummary,
  MfaReport,
  LicenseReport,
  Organization,
} from "@shared/schema";

interface AiRoadmapProps {
  client: Organization;
  deviceHealth: DeviceHealthSummary | null;
  security: SecuritySummary | null;
  tickets: TicketSummary | null;
  mfaReport: MfaReport | null;
  licenseReport: LicenseReport | null;
  roadmap: RoadmapAnalysis | null;
  onRoadmapGenerated: (roadmap: RoadmapAnalysis) => void;
}

const priorityConfig = {
  urgent: {
    label: "Urgent",
    variant: "destructive" as const,
  },
  plan_for: {
    label: "Plan For",
    variant: "default" as const,
  },
  nice_to_have: {
    label: "Nice to Have",
    variant: "secondary" as const,
  },
};

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const config = priorityConfig[item.priority];
  return (
    <div className="rounded-md bg-muted/50 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold">{item.title}</h4>
        <Badge variant={config.variant} className="flex-shrink-0">
          {config.label}
        </Badge>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm text-foreground">{item.issue}</p>
        <p className="text-sm text-muted-foreground italic">
          {item.businessImpact}
        </p>
      </div>
    </div>
  );
}

export function AiRoadmap({
  client,
  deviceHealth,
  security,
  tickets,
  mfaReport,
  licenseReport,
  roadmap,
  onRoadmapGenerated,
}: AiRoadmapProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/roadmap/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientName: client.name,
          deviceHealth,
          security,
          tickets,
          mfaReport,
          licenseReport,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const data: RoadmapAnalysis = await res.json();
      onRoadmapGenerated(data);
    } catch (err: any) {
      toast({
        title: "Generation Failed",
        description: err.message || "Could not generate roadmap. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const hasAnyData = deviceHealth || security || tickets || mfaReport || licenseReport;

  return (
    <CollapsibleSection
      title="Priority Roadmap"
      icon={<Sparkles className="h-5 w-5" />}
      testId="section-roadmap"
      headerRight={
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleGenerate();
          }}
          disabled={isGenerating || !hasAnyData}
          data-testid="button-generate-roadmap"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generate Roadmap
            </>
          )}
        </Button>
      }
    >
      {roadmap ? (
        <div className="space-y-3">
          {roadmap.items.map((item, i) => (
            <RoadmapCard key={i} item={item} />
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">
            Generated {new Date(roadmap.generatedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {hasAnyData ? (
            <p>
              Click <strong>Generate Roadmap</strong> to create an AI-powered
              priority plan based on the data above.
            </p>
          ) : (
            <p>
              Select a client and load data from at least one section before
              generating a roadmap.
            </p>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
