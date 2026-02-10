import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  testId?: string;
}

export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  headerRight,
  testId,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card data-testid={testId}>
      <CardHeader
        className="flex flex-row items-center justify-between gap-4 cursor-pointer select-none pb-3"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={`${testId}-header`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 text-primary">{icon}</div>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {headerRight}
          <Button
            variant="ghost"
            size="icon"
            data-testid={`${testId}-toggle`}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="pt-0">{children}</CardContent>
      </div>
    </Card>
  );
}
