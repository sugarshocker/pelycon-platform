import { useState } from "react";
import { CollapsibleSection } from "./collapsible-section";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Wrench, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InternalNotes {
  serviceManagerNotes: string;
  leadEngineerNotes: string;
}

interface InternalNotesProps {
  notes: InternalNotes;
  onNotesChange: (notes: InternalNotes) => void;
}

export function InternalNotesSection({ notes, onNotesChange }: InternalNotesProps) {
  const [showSm, setShowSm] = useState(false);
  const [showEng, setShowEng] = useState(false);

  const hasSmNotes = notes.serviceManagerNotes.trim().length > 0;
  const hasEngNotes = notes.leadEngineerNotes.trim().length > 0;

  return (
    <CollapsibleSection
      title="Internal Notes"
      icon={<ClipboardList className="h-5 w-5" />}
      testId="section-internal-notes"
      headerRight={
        <Badge variant="outline" className="text-xs">
          Not shown to client
        </Badge>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          These notes are used to inform the AI roadmap but are <strong>never shown directly</strong> to the client.
          The AI will diplomatically rephrase any observations into professional recommendations.
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Service Manager Comments</span>
              {hasSmNotes && <Badge variant="secondary" className="text-xs">Entered</Badge>}
            </div>
            {hasSmNotes && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSm(!showSm)}
                data-testid="button-toggle-sm-notes"
              >
                {showSm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <Textarea
            placeholder="Ticket trends, recurring user issues, staffing observations, training needs..."
            value={notes.serviceManagerNotes}
            onChange={(e) => onNotesChange({ ...notes, serviceManagerNotes: e.target.value })}
            className={`min-h-[80px] resize-y text-sm ${hasSmNotes && !showSm ? "text-transparent selection:text-transparent caret-foreground" : ""}`}
            data-testid="textarea-sm-notes"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lead Engineer Comments</span>
              {hasEngNotes && <Badge variant="secondary" className="text-xs">Entered</Badge>}
            </div>
            {hasEngNotes && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEng(!showEng)}
                data-testid="button-toggle-eng-notes"
              >
                {showEng ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <Textarea
            placeholder="Network infrastructure needs, server health, warranty/hardware replacements, WiFi recommendations..."
            value={notes.leadEngineerNotes}
            onChange={(e) => onNotesChange({ ...notes, leadEngineerNotes: e.target.value })}
            className={`min-h-[80px] resize-y text-sm ${hasEngNotes && !showEng ? "text-transparent selection:text-transparent caret-foreground" : ""}`}
            data-testid="textarea-eng-notes"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
