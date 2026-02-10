import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2 } from "lucide-react";
import type { Organization } from "@shared/schema";

interface ClientSelectorProps {
  selectedClient: Organization | null;
  onSelectClient: (client: Organization) => void;
}

export function ClientSelector({
  selectedClient,
  onSelectClient,
}: ClientSelectorProps) {
  const { data: organizations, isLoading, error } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <Skeleton className="h-9 w-64" />
      </div>
    );
  }

  if (error || !organizations || organizations.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="text-sm text-muted-foreground">
          {error
            ? "Unable to load clients. Check NinjaOne connection."
            : "No clients found."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <Select
        value={selectedClient?.id?.toString() || ""}
        onValueChange={(val) => {
          const org = organizations.find((o) => o.id.toString() === val);
          if (org) onSelectClient(org);
        }}
      >
        <SelectTrigger className="w-72" data-testid="select-client">
          <SelectValue placeholder="Select a client..." />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem
              key={org.id}
              value={org.id.toString()}
              data-testid={`select-client-option-${org.id}`}
            >
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
