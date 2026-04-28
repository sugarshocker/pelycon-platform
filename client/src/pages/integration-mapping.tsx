import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Check, X, Pencil, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  cwCompanyId: number;
  cwCompanyName: string;
  current: {
    ninjaOrgId: number | null;
    huntressOrgId: number | null;
    cippTenantId: string | null;
  };
  suggested: {
    ninja: { id: number; name: string; score: number } | null;
    huntress: { id: number; name: string; score: number } | null;
    cipp: { id: string; name: string; score: number } | null;
  };
}

interface SuggestResponse {
  suggestions: Suggestion[];
  platformCounts: { ninja: number; huntress: number; cipp: number };
  platformErrors: { ninja?: string; huntress?: string; cipp?: string };
}

interface ClientMapping {
  id: number;
  cwCompanyId: number;
  companyName: string;
  ninjaOrgId: number | null;
  huntressOrgId: number | null;
  cippTenantId: string | null;
}

type PlatformKey = "ninja" | "huntress" | "cipp";

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  ninja: "NinjaOne",
  huntress: "Huntress",
  cipp: "CIPP / M365",
};

function scoreColor(score: number): string {
  if (score >= 0.95) return "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700";
  if (score >= 0.75) return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700";
  return "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
}

function scoreLabel(score: number): string {
  if (score >= 0.95) return "high";
  if (score >= 0.75) return "medium";
  return "low";
}

export default function IntegrationMapping() {
  const { toast } = useToast();
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Suggestion | null>(null);
  const [hasFetchedSuggestions, setHasFetchedSuggestions] = useState(false);

  const suggestionsQuery = useQuery<SuggestResponse>({
    queryKey: ["/api/client-mappings/auto-suggest"],
    enabled: hasFetchedSuggestions,
    staleTime: 5 * 60_000, // 5 min — re-fetching pulls every platform's full org list
  });

  // Used for the manual-edit dialog: full list of all platform options.
  // Pulled lazily; reuses the same data the suggest endpoint already fetched.
  // NOTE: the suggest endpoint doesn't return the full lists, so for manual
  // editing we use a fresh request to the orgs endpoints. To keep this simple,
  // the edit dialog uses the suggested + current values to build a small
  // dropdown; a full search across all orgs is a nice-to-have for v2.

  const data = suggestionsQuery.data;
  const suggestions = data?.suggestions ?? [];

  const filtered = useMemo(() => {
    let list = suggestions;
    if (showOnlyUnmapped) {
      list = list.filter(s => {
        const allMapped = s.current.ninjaOrgId && s.current.huntressOrgId && s.current.cippTenantId;
        return !allMapped;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => s.cwCompanyName.toLowerCase().includes(q));
    }
    return list;
  }, [suggestions, showOnlyUnmapped, search]);

  // Counts of suggestions by confidence bucket — used for the bulk-apply button label
  const bucketCounts = useMemo(() => {
    let high = 0, medium = 0;
    for (const s of suggestions) {
      for (const k of ["ninja", "huntress", "cipp"] as const) {
        const sug = s.suggested[k];
        if (!sug) continue;
        if (sug.score >= 0.95) high++;
        else if (sug.score >= 0.75) medium++;
      }
    }
    return { high, medium };
  }, [suggestions]);

  const fetchMutation = useMutation({
    mutationFn: async () => {
      setHasFetchedSuggestions(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/client-mappings/auto-suggest"] });
      return suggestionsQuery.refetch();
    },
  });

  const applyOneMutation = useMutation({
    mutationFn: async (params: { cwCompanyId: number; companyName: string; field: string; value: number | string | null }) => {
      return apiRequest("PUT", `/api/client-mappings/${params.cwCompanyId}`, {
        companyName: params.companyName,
        [params.field]: params.value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-mappings/auto-suggest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-mappings"] });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const bulkApplyMutation = useMutation({
    mutationFn: async (minScore: number) => {
      return apiRequest("POST", "/api/client-mappings/auto-apply", { minScore });
    },
    onSuccess: async (data: any) => {
      toast({ title: `Applied ${data.applied} mappings`, description: `Threshold: ${Math.round(data.minScore * 100)}%` });
      await queryClient.invalidateQueries({ queryKey: ["/api/client-mappings/auto-suggest"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/client-mappings"] });
    },
    onError: (err: any) => toast({ title: "Bulk apply failed", description: err.message, variant: "destructive" }),
  });

  function acceptSuggestion(s: Suggestion, platform: PlatformKey) {
    const sug = s.suggested[platform];
    if (!sug) return;
    const fieldMap: Record<PlatformKey, string> = {
      ninja: "ninjaOrgId",
      huntress: "huntressOrgId",
      cipp: "cippTenantId",
    };
    applyOneMutation.mutate({
      cwCompanyId: s.cwCompanyId,
      companyName: s.cwCompanyName,
      field: fieldMap[platform],
      value: sug.id,
    });
  }

  function clearMapping(s: Suggestion, platform: PlatformKey) {
    const fieldMap: Record<PlatformKey, string> = {
      ninja: "ninjaOrgId",
      huntress: "huntressOrgId",
      cipp: "cippTenantId",
    };
    applyOneMutation.mutate({
      cwCompanyId: s.cwCompanyId,
      companyName: s.cwCompanyName,
      field: fieldMap[platform],
      value: null,
    });
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#394442] dark:text-white">Integration Mapping</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Match each ConnectWise company to its NinjaOne org, Huntress org, and CIPP tenant. Use suggestions for confident matches; edit manually for the rest.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchMutation.mutate()}
            disabled={fetchMutation.isPending || suggestionsQuery.isFetching}
            variant="outline"
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {hasFetchedSuggestions ? "Refresh suggestions" : "Find suggestions"}
          </Button>
          {hasFetchedSuggestions && bucketCounts.high > 0 && (
            <Button
              onClick={() => bulkApplyMutation.mutate(0.95)}
              disabled={bulkApplyMutation.isPending}
              className="bg-[#E77125] hover:bg-[#E77125]/90 text-white gap-2"
            >
              <Check className="h-4 w-4" />
              Apply {bucketCounts.high} high-confidence
            </Button>
          )}
        </div>
      </div>

      {data && (
        <Card><CardContent className="py-3 px-4 flex items-center justify-between text-xs">
          <div className="flex gap-4 text-muted-foreground">
            <span><strong className="text-[#394442] dark:text-white">{data.platformCounts.ninja}</strong> NinjaOne orgs</span>
            <span>·</span>
            <span><strong className="text-[#394442] dark:text-white">{data.platformCounts.huntress}</strong> Huntress orgs</span>
            <span>·</span>
            <span><strong className="text-[#394442] dark:text-white">{data.platformCounts.cipp}</strong> CIPP tenants</span>
          </div>
          {(data.platformErrors.ninja || data.platformErrors.huntress || data.platformErrors.cipp) && (
            <div className="flex items-center gap-1 text-amber-700 dark:text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              Some platforms failed to fetch — see server logs
            </div>
          )}
        </CardContent></Card>
      )}

      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter by client name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyUnmapped}
            onChange={(e) => setShowOnlyUnmapped(e.target.checked)}
            className="h-4 w-4"
          />
          Show only clients with unmapped fields
        </label>
      </div>

      {!hasFetchedSuggestions && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Click <strong>Find suggestions</strong> above to fetch current org/tenant lists from NinjaOne, Huntress, and CIPP and propose matches.
        </CardContent></Card>
      )}

      {hasFetchedSuggestions && suggestionsQuery.isFetching && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Fetching org lists from all platforms…</CardContent></Card>
      )}

      {hasFetchedSuggestions && !suggestionsQuery.isFetching && filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {showOnlyUnmapped ? "All clients are fully mapped. Uncheck the filter to see them all." : "No clients match the search."}
        </CardContent></Card>
      )}

      {filtered.length > 0 && (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 px-3">Client</th>
                <th className="py-2 px-3 w-[24%]">NinjaOne</th>
                <th className="py-2 px-3 w-[24%]">Huntress</th>
                <th className="py-2 px-3 w-[24%]">CIPP / M365</th>
                <th className="py-2 px-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(s => (
                <tr key={s.cwCompanyId} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                  <td className="py-2.5 px-3 font-medium text-[#394442] dark:text-white">{s.cwCompanyName}</td>
                  <PlatformCell s={s} platform="ninja"
                    onAccept={() => acceptSuggestion(s, "ninja")}
                    onClear={() => clearMapping(s, "ninja")}
                    pending={applyOneMutation.isPending} />
                  <PlatformCell s={s} platform="huntress"
                    onAccept={() => acceptSuggestion(s, "huntress")}
                    onClear={() => clearMapping(s, "huntress")}
                    pending={applyOneMutation.isPending} />
                  <PlatformCell s={s} platform="cipp"
                    onAccept={() => acceptSuggestion(s, "cipp")}
                    onClear={() => clearMapping(s, "cipp")}
                    pending={applyOneMutation.isPending} />
                  <td className="py-2.5 px-3">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)} title="Edit manually" className="h-7 w-7 p-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      {editing && (
        <ManualEditDialog
          suggestion={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/client-mappings/auto-suggest"] });
            queryClient.invalidateQueries({ queryKey: ["/api/client-mappings"] });
            setEditing(null);
            toast({ title: "Mapping saved" });
          }}
        />
      )}
    </div>
  );
}

interface PlatformCellProps {
  s: Suggestion;
  platform: PlatformKey;
  onAccept: () => void;
  onClear: () => void;
  pending: boolean;
}

function PlatformCell({ s, platform, onAccept, onClear, pending }: PlatformCellProps) {
  const currentField = platform === "ninja" ? s.current.ninjaOrgId : platform === "huntress" ? s.current.huntressOrgId : s.current.cippTenantId;
  const sug = s.suggested[platform];

  if (currentField != null && currentField !== "") {
    // Mapped — show current ID with a clear button
    return (
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
            <Check className="h-3 w-3 mr-1" /> Mapped
          </Badge>
          <span className="text-xs text-muted-foreground">#{currentField}</span>
          <button onClick={onClear} disabled={pending} title="Clear mapping" className="text-muted-foreground hover:text-red-600 ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    );
  }

  if (sug) {
    return (
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs truncate flex-1" title={sug.name}>{sug.name}</span>
          <Badge className={`${scoreColor(sug.score)} text-[10px] border`}>
            {Math.round(sug.score * 100)}% <span className="ml-0.5 opacity-70">{scoreLabel(sug.score)}</span>
          </Badge>
          <Button size="sm" variant="ghost" onClick={onAccept} disabled={pending} title="Accept this match" className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    );
  }

  return <td className="py-2.5 px-3 text-xs text-muted-foreground">—</td>;
}

interface PlatformOption {
  id: number | string;
  name: string;
}

interface OrgsResponse {
  ninjaOrgs: PlatformOption[];
  huntressOrgs: PlatformOption[];
  cippTenants: PlatformOption[];
}

function ManualEditDialog({ suggestion, onClose, onSaved }: { suggestion: Suggestion; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [ninjaId, setNinjaId] = useState<string>(suggestion.current.ninjaOrgId != null ? String(suggestion.current.ninjaOrgId) : "");
  const [huntressId, setHuntressId] = useState<string>(suggestion.current.huntressOrgId != null ? String(suggestion.current.huntressOrgId) : "");
  const [cippId, setCippId] = useState<string>(suggestion.current.cippTenantId ?? "");

  // We don't have a dedicated endpoint that returns all platform options;
  // but the suggest endpoint gives us per-row top suggestions. For manual
  // edit, a v1 approach: free-text input. v2 would call a search/list
  // endpoint scoped to each platform.
  //
  // To keep this useful right now, we offer:
  //   - A select pre-filled with the current value + suggestion (if any)
  //   - A text input for entering an arbitrary ID

  const ninjaOptions = useMemo(() => {
    const opts: PlatformOption[] = [];
    if (suggestion.current.ninjaOrgId != null) opts.push({ id: suggestion.current.ninjaOrgId, name: `Currently mapped (#${suggestion.current.ninjaOrgId})` });
    if (suggestion.suggested.ninja) opts.push({ id: suggestion.suggested.ninja.id, name: `Suggested: ${suggestion.suggested.ninja.name}` });
    return opts;
  }, [suggestion]);

  const huntressOptions = useMemo(() => {
    const opts: PlatformOption[] = [];
    if (suggestion.current.huntressOrgId != null) opts.push({ id: suggestion.current.huntressOrgId, name: `Currently mapped (#${suggestion.current.huntressOrgId})` });
    if (suggestion.suggested.huntress) opts.push({ id: suggestion.suggested.huntress.id, name: `Suggested: ${suggestion.suggested.huntress.name}` });
    return opts;
  }, [suggestion]);

  const cippOptions = useMemo(() => {
    const opts: PlatformOption[] = [];
    if (suggestion.current.cippTenantId) opts.push({ id: suggestion.current.cippTenantId, name: `Currently mapped` });
    if (suggestion.suggested.cipp) opts.push({ id: suggestion.suggested.cipp.id, name: `Suggested: ${suggestion.suggested.cipp.name}` });
    return opts;
  }, [suggestion]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/client-mappings/${suggestion.cwCompanyId}`, {
        companyName: suggestion.cwCompanyName,
        ninjaOrgId: ninjaId.trim() ? parseInt(ninjaId) : null,
        huntressOrgId: huntressId.trim() ? parseInt(huntressId) : null,
        cippTenantId: cippId.trim() || null,
      });
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit mapping for {suggestion.cwCompanyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Pick from the suggested options or enter a specific ID. Leave blank to clear.
          </p>

          {(["ninja", "huntress", "cipp"] as PlatformKey[]).map(platform => {
            const opts = platform === "ninja" ? ninjaOptions : platform === "huntress" ? huntressOptions : cippOptions;
            const value = platform === "ninja" ? ninjaId : platform === "huntress" ? huntressId : cippId;
            const setValue = platform === "ninja" ? setNinjaId : platform === "huntress" ? setHuntressId : setCippId;
            const inputType = platform === "cipp" ? "text" : "number";
            return (
              <div key={platform} className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{PLATFORM_LABELS[platform]}</label>
                <div className="flex gap-2">
                  {opts.length > 0 && (
                    <Select value={value} onValueChange={setValue}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Pick a suggestion..." /></SelectTrigger>
                      <SelectContent>
                        {opts.map(o => <SelectItem key={String(o.id)} value={String(o.id)}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    type={inputType}
                    placeholder={`Or enter ${platform === "cipp" ? "tenant ID" : "org ID"}`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={opts.length > 0 ? "w-40" : "flex-1"}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-[#E77125] hover:bg-[#E77125]/90 text-white">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
