import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CollapsibleSection } from "./collapsible-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, Sparkles, Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Organization, ProjectItem } from "@shared/schema";

interface ProjectSummaryProps {
  client: Organization;
}

export function ProjectSummary({ client }: ProjectSummaryProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data, isLoading, error } = useQuery<{
    completed: ProjectItem[];
    inProgress: ProjectItem[];
  }>({
    queryKey: ["/api/projects", client.id],
    enabled: !!client.id,
  });

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/projects/summarize", {
        clientName: client.name,
        completed: data?.completed || [],
        inProgress: data?.inProgress || [],
      });
      return res.json();
    },
    onSuccess: (result) => {
      setAiSummary(result.summary);
    },
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Unable to load project data from ConnectWise.</p>
        </div>
      );
    }

    if (!data) return null;

    const { completed, inProgress } = data;
    const totalProjects = completed.length + inProgress.length;

    if (totalProjects === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">No notable projects found in the last 6 months.</p>
          <p className="text-xs mt-1 opacity-70">Routine items like PC setups and replacements are excluded.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs" data-testid="badge-completed-count">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {completed.length} Completed
            </Badge>
            {inProgress.length > 0 && (
              <Badge variant="outline" className="text-xs" data-testid="badge-inprogress-count">
                <Clock className="h-3 w-3 mr-1" />
                {inProgress.length} In Progress
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              data-testid="toggle-project-details"
            >
              Details
              {showDetails ? (
                <ChevronUp className="h-3.5 w-3.5 ml-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              )}
            </Button>
            {!aiSummary && (
              <Button
                size="sm"
                onClick={() => summarizeMutation.mutate()}
                disabled={summarizeMutation.isPending}
                data-testid="button-generate-project-summary"
              >
                {summarizeMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                Summarize
              </Button>
            )}
          </div>
        </div>

        {aiSummary && (
          <div
            className="rounded-md bg-muted/50 px-4 py-3"
            data-testid="project-ai-summary"
          >
            <p className="text-sm leading-relaxed">{aiSummary}</p>
          </div>
        )}

        {showDetails && (
          <div className="space-y-3" data-testid="project-details-list">
            {inProgress.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Currently In Progress
                </h4>
                <div className="grid gap-1.5">
                  {inProgress.map((p) => (
                    <ProjectRow key={`${p.source}-${p.id}`} item={p} />
                  ))}
                </div>
              </div>
            )}
            {completed.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed
                </h4>
                <div className="grid gap-1.5">
                  {completed.map((p) => (
                    <ProjectRow key={`${p.source}-${p.id}`} item={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <CollapsibleSection
      title="Projects & Notable Work"
      icon={<FolderKanban className="h-5 w-5" />}
      testId="section-projects"
    >
      {renderContent()}
    </CollapsibleSection>
  );
}

function ProjectRow({ item }: { item: ProjectItem }) {
  const dateStr = item.closedDate
    ? new Date(item.closedDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : new Date(item.dateEntered).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const isClosed = !!item.closedDate ||
    item.status.toLowerCase().includes("clos") ||
    item.status.toLowerCase().includes("complet");

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2"
      data-testid={`project-item-${item.source}-${item.id}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isClosed ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
        )}
        <span className="text-sm truncate">{item.name}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
        <span className="text-xs text-muted-foreground">{dateStr}</span>
        <Badge variant="outline" className="text-[10px]">
          {item.source === "project" ? "Project" : "Ticket"}
        </Badge>
      </div>
    </div>
  );
}
