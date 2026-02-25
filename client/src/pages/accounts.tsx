import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { ClientAccountWithStatus } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Loader2,
  Building2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  ArrowUpDown,
} from "lucide-react";

type SortField = "companyName" | "effectiveTier" | "totalRevenue" | "tbrStatus" | "agreementRevenue" | "projectRevenue" | "grossMarginPercent";
type SortDir = "asc" | "desc";

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status, reason }: { status: string; reason: string }) {
  const config = {
    green: { icon: CheckCircle2, label: "On Track", className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" },
    yellow: { icon: Clock, label: "Attention", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
    red: { icon: XCircle, label: "Needs TBR", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
  }[status] || { icon: AlertCircle, label: "Unknown", className: "" };

  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`${config.className} cursor-help gap-1 text-xs`} data-testid={`badge-tbr-status-${status}`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <p className="text-xs">{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const className = {
    A: "bg-primary/15 text-primary border-primary/30",
    B: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    C: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
  }[tier] || "";

  return (
    <Badge variant="outline" className={`${className} text-xs font-semibold`} data-testid={`badge-tier-${tier}`}>
      Tier {tier}
    </Badge>
  );
}

export default function Accounts() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [sortField, setSortField] = useState<SortField>("companyName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: accounts, isLoading } = useQuery<ClientAccountWithStatus[]>({
    queryKey: ["/api/accounts"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/accounts/sync");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Sync Complete", description: `${data.synced} client accounts synced from ConnectWise.` });
    },
    onError: (err: any) => {
      toast({ title: "Sync Failed", description: err.message || "Could not sync accounts from ConnectWise.", variant: "destructive" });
    },
  });

  const tierMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: number; tier: string }) => {
      const res = await apiRequest("PATCH", `/api/accounts/${id}/tier`, { tier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "companyName" ? "asc" : "desc");
    }
  };

  const statusOrder = { red: 0, yellow: 1, green: 2 };

  const filtered = (accounts || [])
    .filter(a => filterTier === "all" || a.effectiveTier === filterTier)
    .filter(a => filterStatus === "all" || a.tbrStatus === filterStatus)
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "companyName": cmp = a.companyName.localeCompare(b.companyName); break;
        case "effectiveTier": cmp = a.effectiveTier.localeCompare(b.effectiveTier); break;
        case "totalRevenue": cmp = (a.totalRevenue || 0) - (b.totalRevenue || 0); break;
        case "agreementRevenue": cmp = (a.agreementRevenue || 0) - (b.agreementRevenue || 0); break;
        case "projectRevenue": cmp = (a.projectRevenue || 0) - (b.projectRevenue || 0); break;
        case "grossMarginPercent": cmp = (a.grossMarginPercent || 0) - (b.grossMarginPercent || 0); break;
        case "tbrStatus": cmp = (statusOrder[a.tbrStatus] ?? 1) - (statusOrder[b.tbrStatus] ?? 1); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const summary = {
    total: (accounts || []).length,
    green: (accounts || []).filter(a => a.tbrStatus === "green").length,
    yellow: (accounts || []).filter(a => a.tbrStatus === "yellow").length,
    red: (accounts || []).filter(a => a.tbrStatus === "red").length,
    tierA: (accounts || []).filter(a => a.effectiveTier === "A").length,
    tierB: (accounts || []).filter(a => a.effectiveTier === "B").length,
    tierC: (accounts || []).filter(a => a.effectiveTier === "C").length,
    totalAgreementRev: (accounts || []).reduce((sum, a) => sum + (a.agreementRevenue || 0), 0),
    totalProjectRev: (accounts || []).reduce((sum, a) => sum + (a.projectRevenue || 0), 0),
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "opacity-100" : "opacity-30"}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-lg font-semibold" data-testid="text-accounts-title">Client Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Managed services clients from ConnectWise — TBR compliance, revenue, and tier management
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-accounts"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {syncMutation.isPending ? "Syncing..." : "Sync from ConnectWise"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-medium mb-1">No Client Accounts Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click "Sync from ConnectWise" to pull in clients with Top Shelf or Managed Services agreements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">TBR Compliance</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold" data-testid="text-compliance-percent">
                  {summary.total > 0 ? Math.round((summary.green / summary.total) * 100) : 0}%
                </span>
                <div className="flex gap-1 text-xs">
                  <span className="text-green-600">{summary.green}✓</span>
                  <span className="text-yellow-600">{summary.yellow}!</span>
                  <span className="text-red-600">{summary.red}✗</span>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Client Tiers</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-primary">{summary.tierA}A</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-blue-600">{summary.tierB}B</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-gray-500">{summary.tierC}C</span>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Agreement Revenue</div>
              <div className="text-lg font-semibold" data-testid="text-total-agreement-rev">
                {formatCurrency(summary.totalAgreementRev)}
                <span className="text-xs font-normal text-muted-foreground">/yr</span>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Project Revenue</div>
              <div className="text-lg font-semibold" data-testid="text-total-project-rev">
                {formatCurrency(summary.totalProjectRev)}
                <span className="text-xs font-normal text-muted-foreground">/yr</span>
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-filter-tier">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="A">Tier A</SelectItem>
                <SelectItem value="B">Tier B</SelectItem>
                <SelectItem value="C">Tier C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="green">On Track</SelectItem>
                <SelectItem value="yellow">Attention</SelectItem>
                <SelectItem value="red">Needs TBR</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} of {summary.total} clients
            </span>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader field="companyName">Client</SortHeader>
                    <SortHeader field="effectiveTier">Tier</SortHeader>
                    <SortHeader field="tbrStatus">TBR Status</SortHeader>
                    <TableHead>Last TBR</TableHead>
                    <TableHead>Next TBR</TableHead>
                    <SortHeader field="agreementRevenue">Agreement Rev</SortHeader>
                    <SortHeader field="projectRevenue">Project Rev</SortHeader>
                    <SortHeader field="totalRevenue">Total Rev</SortHeader>
                    <SortHeader field="grossMarginPercent">Margin</SortHeader>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((acct) => (
                    <TableRow key={acct.id} data-testid={`row-account-${acct.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm" data-testid={`text-company-${acct.id}`}>{acct.companyName}</span>
                          {acct.agreementTypes && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{acct.agreementTypes}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={acct.effectiveTier}
                          onValueChange={(val) => tierMutation.mutate({ id: acct.id, tier: val })}
                        >
                          <SelectTrigger className="h-7 w-[80px] text-xs p-1 border-0 bg-transparent" data-testid={`select-tier-${acct.id}`}>
                            <TierBadge tier={acct.effectiveTier} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Tier A</SelectItem>
                            <SelectItem value="B">Tier B</SelectItem>
                            <SelectItem value="C">Tier C</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={acct.tbrStatus} reason={acct.tbrStatusReason} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" data-testid={`text-last-tbr-${acct.id}`}>
                        {formatDate(acct.lastTbrDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" data-testid={`text-next-tbr-${acct.id}`}>
                        {acct.nextTbrDate ? (
                          <span>{formatDate(acct.nextTbrDate)}</span>
                        ) : (
                          <span className="text-yellow-600 dark:text-yellow-400">Not scheduled</span>
                        )}
                        {acct.scheduleFrequency && (
                          <span className="ml-1 text-muted-foreground/60">({acct.scheduleFrequency}mo)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-agreement-rev-${acct.id}`}>
                        {formatCurrency(acct.agreementRevenue)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-project-rev-${acct.id}`}>
                        {formatCurrency(acct.projectRevenue)}
                      </TableCell>
                      <TableCell className="text-xs font-medium tabular-nums" data-testid={`text-total-rev-${acct.id}`}>
                        {formatCurrency(acct.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums" data-testid={`text-margin-${acct.id}`}>
                        {formatPercent(acct.grossMarginPercent)}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setLocation(`/reviews?orgId=${acct.cwCompanyId}&orgName=${encodeURIComponent(acct.companyName)}`)}
                              data-testid={`button-open-review-${acct.id}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open TBR Reviews</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
