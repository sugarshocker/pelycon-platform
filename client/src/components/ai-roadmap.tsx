import { useState, useEffect, useRef } from "react";
import { CollapsibleSection } from "./collapsible-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Pencil, Check, X } from "lucide-react";
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
import type { InternalNotes } from "./internal-notes";

interface AiRoadmapProps {
  client: Organization;
  deviceHealth: DeviceHealthSummary | null;
  security: SecuritySummary | null;
  tickets: TicketSummary | null;
  mfaReport: MfaReport | null;
  licenseReport: LicenseReport | null;
  internalNotes?: InternalNotes;
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

function ExecutiveSummaryEditor({ summary, onSave }: { summary: string; onSave: (val: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(summary);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(summary);
  }, [summary]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleSave = () => {
    onSave(draft);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(summary);
    setIsEditing(false);
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-2" data-testid="roadmap-executive-summary">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Executive Summary</h4>
        {!isEditing && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            data-testid="button-edit-executive-summary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="text-sm leading-relaxed"
            data-testid="input-executive-summary"
          />
          <div className="flex items-center gap-1 justify-end">
            <Button size="sm" variant="ghost" onClick={handleCancel} data-testid="button-cancel-executive-summary">
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} data-testid="button-save-executive-summary">
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed">{summary || "No executive summary generated."}</p>
      )}
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
  internalNotes,
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
          internalNotes: internalNotes?.serviceManagerNotes || internalNotes?.leadEngineerNotes ? internalNotes : undefined,
        }),
      });

      if (res.status === 401) throw new Error("Session expired. Please log in again.");
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
          {roadmap.executiveSummary !== undefined && (
            <ExecutiveSummaryEditor
              summary={roadmap.executiveSummary}
              onSave={(updated) => {
                onRoadmapGenerated({ ...roadmap, executiveSummary: updated });
              }}
            />
          )}
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
