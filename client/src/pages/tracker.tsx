import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Loader2,
  FileDown,
  ClipboardCheck,
  Users,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Mail,
  ExternalLink,
  Pencil,
  Eye,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiRequest, getToken, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Organization, TbrSnapshot, TbrSchedule } from "@shared/schema";
import { DollarSign } from "lucide-react";

function getMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseLocalDate(dateStr: string | Date): Date {
  const s = typeof dateStr === "string" ? dateStr : dateStr.toISOString();
  const parts = s.split("T")[0].split("-");
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function getMonthLabel(key: string) {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function getWeekStart(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - day.getDay());
  return day;
}

function getWeekKey(d: Date): string {
  const ws = getWeekStart(d);
  return ws.toISOString().split("T")[0];
}

function getWeekLabel(key: string): string {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TopClientsNeedingTbr() {
  const [, setLocation] = useLocation();
  const { data: accounts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/accounts"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-6 w-64 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const needingTbr = (accounts || [])
    .filter((a: any) => a.tbrStatus === "red" || a.tbrStatus === "yellow" || a.tbrStatus === "scheduled")
    .sort((a: any, b: any) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
    .slice(0, 5);

  if (needingTbr.length === 0) return null;

  const fmtCurrency = (val: number) => "$" + Math.round(val).toLocaleString();

  const statusColors: Record<string, string> = {
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <Card data-testid="card-top-clients-needing-tbr">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#E77125]" />
          Top Clients Needing a TBR
        </CardTitle>
        <span className="text-xs text-muted-foreground">By annual revenue</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {needingTbr.map((acct: any, idx: number) => (
            <button
              key={acct.id}
              data-testid={`btn-tbr-needed-${acct.id}`}
              onClick={() => setLocation(`/reviews?orgId=${acct.cwCompanyId}&orgName=${encodeURIComponent(acct.companyName)}`)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-muted-foreground w-4">{idx + 1}.</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[acct.tbrStatus] || ""}`}>
                  {acct.tbrStatus === "red" ? "Never" : acct.tbrStatus === "scheduled" ? "Scheduled" : "Overdue"}
                </span>
                <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{acct.companyName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">{acct.tbrStatusReason}</span>
                <span className="text-sm font-semibold tabular-nums flex items-center gap-0.5">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  {fmtCurrency(acct.totalRevenue || 0).replace("$", "")}/yr
                </span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TbrEmailSettings() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: settings } = useQuery<{
    tbrEmailServiceManager: string;
    tbrEmailOther: string;
  }>({ queryKey: ["/api/app-settings"] });

  const [smEmail, setSmEmail] = useState("");
  const [otherEmail, setOtherEmail] = useState("");

  useEffect(() => {
    if (settings) {
      setSmEmail(settings.tbrEmailServiceManager ?? "");
      setOtherEmail(settings.tbrEmailOther ?? "");
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/app-settings", {
      tbrEmailServiceManager: smEmail.trim(),
      tbrEmailOther: otherEmail.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Reminder email settings saved" });
      setOpen(false);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const configured = !!(settings?.tbrEmailServiceManager || settings?.tbrEmailOther);

  return (
    <Card data-testid="card-tbr-email-settings">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            TBR Reminder Emails
          </CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(!open)} data-testid="button-toggle-email-settings">
            {open ? "Close" : "Configure"}
          </Button>
        </div>
        {!open && (
          <p className="text-xs text-muted-foreground mt-1">
            {configured
              ? `Reminders sent 3 days before each scheduled TBR${[settings?.tbrEmailServiceManager, settings?.tbrEmailOther].filter(Boolean).map((e, i) => i === 0 ? ` to ${e}` : `, ${e}`).join("")}`
              : "No global recipients configured. Click Configure to add them."}
          </p>
        )}
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-3">
          <p className="text-xs text-muted-foreground">These global addresses receive reminders 3 days before <em>any</em> TBR. Lead Engineer is set per-client on each schedule.</p>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium block mb-1">Service Manager Email</label>
              <Input
                type="email"
                value={smEmail}
                onChange={e => setSmEmail(e.target.value)}
                placeholder="servicemanager@pelycon.com"
                className="h-8 text-sm"
                data-testid="input-tbr-sm-email"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Other Recipient Email</label>
              <Input
                type="email"
                value={otherEmail}
                onChange={e => setOtherEmail(e.target.value)}
                placeholder="other@pelycon.com"
                className="h-8 text-sm"
                data-testid="input-tbr-other-email"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-email-settings">
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function Tracker() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleOrgId, setScheduleOrgId] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [frequency, setFrequency] = useState("6");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [reminderEmail, setReminderEmail] = useState("");
  const [leadEngineerEmail, setLeadEngineerEmail] = useState("");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [chartMode, setChartMode] = useState<"weekly" | "monthly">("weekly");
  const [eventActionItem, setEventActionItem] = useState<{
    label: string;
    type: "completed" | "scheduled";
    snapshotId?: number;
    scheduleId?: number;
    orgId?: number;
    reviewDate?: string;
  } | null>(null);

  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: allFinalized, isLoading: finalizedLoading } = useQuery<TbrSnapshot[]>({
    queryKey: ["/api/tbr/all-finalized"],
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery<TbrSchedule[]>({
    queryKey: ["/api/schedules"],
  });

  const upsertScheduleMutation = useMutation({
    mutationFn: async (data: { orgId: number; orgName: string; frequencyMonths: number; nextReviewDate: string | null; notes: string | null; reminderEmail: string | null; leadEngineerEmail: string | null }) => {
      const res = await apiRequest("POST", "/api/schedules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setScheduleDialogOpen(false);
      setEditingScheduleId(null);
      setScheduleOrgId("");
      toast({ title: "Schedule saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setScheduleDialogOpen(false);
      setEditingScheduleId(null);
      toast({ title: "Schedule cancelled" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const now = new Date();
  const finalized = allFinalized || [];

  const overdueCount = (schedules || []).filter(
    (s) => s.nextReviewDate && parseLocalDate(s.nextReviewDate) < now
  ).length;

  const upcomingCount = (schedules || []).filter((s) => {
    if (!s.nextReviewDate) return false;
    const d = parseLocalDate(s.nextReviewDate);
    return d >= now && d <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  }).length;

  const chartData = useMemo(() => {
    if (chartMode === "monthly") {
      const monthMap: Record<string, number> = {};
      const endMonth = new Date();
      const startMonth = new Date();
      startMonth.setMonth(startMonth.getMonth() - 11);

      for (let d = new Date(startMonth); d <= endMonth; d.setMonth(d.getMonth() + 1)) {
        monthMap[getMonthKey(d)] = 0;
      }

      finalized.forEach((snap) => {
        const key = getMonthKey(new Date(snap.createdAt));
        if (key in monthMap) monthMap[key]++;
      });

      return Object.entries(monthMap).map(([key, count]) => ({
        label: getMonthLabel(key),
        reviews: count,
      }));
    } else {
      const weekMap: Record<string, number> = {};
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 12 * 7);

      for (let d = new Date(getWeekStart(start)); d <= now; d.setDate(d.getDate() + 7)) {
        weekMap[getWeekKey(d)] = 0;
      }

      finalized.forEach((snap) => {
        const key = getWeekKey(new Date(snap.createdAt));
        if (key in weekMap) weekMap[key]++;
      });

      return Object.entries(weekMap).map(([key, count]) => ({
        label: getWeekLabel(key),
        reviews: count,
      }));
    }
  }, [finalized, chartMode]);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarEvents = useMemo(() => {
    type CalendarItem = { label: string; type: "completed" | "scheduled"; snapshotId?: number; scheduleId?: number; orgId?: number; reviewDate?: string };
    const events: Record<number, { items: CalendarItem[] }> = {};

    finalized.forEach((snap) => {
      const d = snap.reviewDate ? parseLocalDate(snap.reviewDate) : new Date(snap.createdAt);
      if (d.getFullYear() === calendarYear && d.getMonth() === calendarMonth) {
        const day = d.getDate();
        if (!events[day]) events[day] = { items: [] };
        events[day].items.push({
          label: snap.orgName,
          type: "completed",
          snapshotId: snap.id,
          orgId: snap.orgId,
          scheduleId: snap.scheduleId || undefined,
          reviewDate: snap.reviewDate || undefined,
        });
      }
    });

    const completedScheduleIds = new Set(
      finalized.filter((snap) => snap.scheduleId).map((snap) => snap.scheduleId as number)
    );

    (schedules || []).forEach((s) => {
      if (!s.nextReviewDate) return;
      if (completedScheduleIds.has(s.id)) return;
      const d = parseLocalDate(s.nextReviewDate);
      if (d.getFullYear() === calendarYear && d.getMonth() === calendarMonth) {
        const day = d.getDate();
        if (!events[day]) events[day] = { items: [] };
        const reviewDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        events[day].items.push({ label: s.orgName, type: "scheduled", scheduleId: s.id, orgId: s.orgId, reviewDate });
      }
    });

    return events;
  }, [finalized, schedules, calendarYear, calendarMonth]);

  const prevMonth = () => setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));

  const openNewScheduleDialog = (prefilledDate?: string) => {
    setEditingScheduleId(null);
    setScheduleOrgId("");
    setNextDate(prefilledDate || "");
    setFrequency("6");
    setScheduleNotes("");
    setReminderEmail("");
    setLeadEngineerEmail("");
    setScheduleDialogOpen(true);
  };

  const openEditScheduleDialog = (scheduleId: number) => {
    const schedule = (schedules || []).find((s) => s.id === scheduleId);
    if (!schedule) return;
    setEditingScheduleId(schedule.id);
    setScheduleOrgId(String(schedule.orgId));
    if (schedule.nextReviewDate) {
      const rd = schedule.nextReviewDate instanceof Date ? schedule.nextReviewDate : new Date(schedule.nextReviewDate as string);
      const y = rd.getUTCFullYear();
      const m = String(rd.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(rd.getUTCDate()).padStart(2, "0");
      setNextDate(`${y}-${m}-${dd}`);
    } else {
      setNextDate("");
    }
    setFrequency(String(schedule.frequencyMonths));
    setScheduleNotes(schedule.notes || "");
    setReminderEmail(schedule.reminderEmail || "");
    setLeadEngineerEmail(schedule.leadEngineerEmail || "");
    setScheduleDialogOpen(true);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    openNewScheduleDialog(dateStr);
  };

  const handleEventClick = (e: React.MouseEvent, item: { type: string; scheduleId?: number; snapshotId?: number; label?: string; orgId?: number; reviewDate?: string }) => {
    e.stopPropagation();
    setEventActionItem(item as any);
  };

  const findScheduleForOrg = (orgId: number) => {
    return (schedules || []).find(s => s.orgId === orgId);
  };

  const handleSaveSchedule = () => {
    const org = organizations?.find((o) => o.id === parseInt(scheduleOrgId));
    if (!org) return;
    upsertScheduleMutation.mutate({
      orgId: org.id,
      orgName: org.name,
      frequencyMonths: parseInt(frequency),
      nextReviewDate: nextDate || null,
      notes: scheduleNotes || null,
      reminderEmail: reminderEmail || null,
      leadEngineerEmail: leadEngineerEmail || null,
    });
  };

  const handleDeleteSchedule = () => {
    if (editingScheduleId) {
      deleteScheduleMutation.mutate(editingScheduleId);
    }
  };

  const handleDownloadPdf = async (snapshotId: number) => {
    const token = getToken();
    try {
      const res = await fetch(`/api/export/snapshot/${snapshotId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const html = await res.text();
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch {
      toast({ title: "Could not load report", variant: "destructive" });
    }
  };

  const isLoading = orgsLoading || finalizedLoading || schedulesLoading;

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const recentTbrs = finalized.slice(0, 8);

  return (
    <div className="h-full bg-background overflow-auto">
      <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-80" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-lg font-semibold" data-testid="text-tracker-title">Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <Button onClick={() => openNewScheduleDialog()} data-testid="button-schedule-new">
                <Calendar className="h-4 w-4 mr-1" />
                Schedule TBR
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card data-testid="card-total-reviews">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-muted-foreground font-medium">Total Reviews</p>
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold">{finalized.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </CardContent>
              </Card>
              <Card data-testid="card-clients">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-muted-foreground font-medium">Clients</p>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold">{organizations?.length || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active organizations</p>
                </CardContent>
              </Card>
              <Card data-testid="card-overdue">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-muted-foreground font-medium">Overdue</p>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <p className={`text-2xl font-bold ${overdueCount > 0 ? "text-destructive" : ""}`}>{overdueCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Past due date</p>
                </CardContent>
              </Card>
              <Card data-testid="card-upcoming">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-muted-foreground font-medium">Upcoming</p>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold">{upcomingCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Next 60 days</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <Card className="lg:col-span-3" data-testid="card-tbr-chart">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">TBR Activity</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-md border border-border overflow-hidden">
                      <button
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${chartMode === "weekly" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setChartMode("weekly")}
                        data-testid="button-chart-weekly"
                      >
                        Weekly
                      </button>
                      <button
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${chartMode === "monthly" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setChartMode("monthly")}
                        data-testid="button-chart-monthly"
                      >
                        Monthly
                      </button>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {chartMode === "weekly" ? "Last 12 weeks" : "Last 12 months"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="reviews"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(var(--primary))" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2" data-testid="card-recent-reviews">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Reviews</CardTitle>
                  <Badge variant="secondary" className="text-xs">{finalized.length} total</Badge>
                </CardHeader>
                <CardContent>
                  {recentTbrs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No finalized reviews yet</p>
                  ) : (
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {recentTbrs.map((snap) => (
                        <div
                          key={snap.id}
                          className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0"
                          data-testid={`recent-tbr-${snap.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{snap.orgName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(snap.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDownloadPdf(snap.id)}
                            data-testid={`button-pdf-${snap.id}`}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-calendar">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Review Calendar</CardTitle>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-calendar-month">
                    {monthNames[calendarMonth]} {calendarYear}
                  </span>
                  <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px">
                  {weekDays.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                  {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[72px]" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === now.getDate() && calendarMonth === now.getMonth() && calendarYear === now.getFullYear();
                    const event = calendarEvents[day];
                    return (
                      <div
                        key={day}
                        className={`min-h-[72px] border rounded-md p-1 cursor-pointer hover-elevate transition-colors ${isToday ? "border-primary bg-primary/5" : "border-border/50"}`}
                        data-testid={`calendar-day-${day}`}
                        onClick={() => handleDayClick(day)}
                      >
                        <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                        {event && (
                          <div className="mt-0.5 space-y-0.5">
                            {event.items.slice(0, 2).map((item, idx) => (
                              <div
                                key={idx}
                                className={`text-[10px] leading-tight truncate rounded px-1 py-0.5 cursor-pointer hover-elevate ${
                                  item.type === "completed"
                                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                    : "bg-primary/15 text-primary"
                                }`}
                                title={item.label}
                                onClick={(e) => handleEventClick(e, item)}
                                data-testid={`calendar-event-${day}-${idx}`}
                              >
                                {item.label}
                              </div>
                            ))}
                            {event.items.length > 2 && (
                              <p className="text-[10px] text-muted-foreground pointer-events-none">+{event.items.length - 2} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500/15 border border-green-500/30" />
                    Completed
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-primary/15 border border-primary/30" />
                    Scheduled
                  </div>
                </div>
              </CardContent>
            </Card>

            <TbrEmailSettings />
            <TopClientsNeedingTbr />
          </>
        )}
      </div>

      <Dialog open={!!eventActionItem} onOpenChange={(open) => { if (!open) setEventActionItem(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-event-action-title">
              {eventActionItem?.type === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Calendar className="h-4 w-4 text-primary" />
              )}
              {eventActionItem?.label}
            </DialogTitle>
          </DialogHeader>
          {eventActionItem && (() => {
            const linkedSchedule = eventActionItem.type === "completed" && eventActionItem.orgId
              ? findScheduleForOrg(eventActionItem.orgId)
              : null;
            return (
              <div className="space-y-1.5 pt-1">
                {eventActionItem.orgId && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => {
                      const params = new URLSearchParams({
                        orgId: String(eventActionItem.orgId),
                        orgName: eventActionItem.label || "",
                      });
                      if (eventActionItem.scheduleId) params.set("scheduleId", String(eventActionItem.scheduleId));
                      if (eventActionItem.reviewDate) params.set("reviewDate", eventActionItem.reviewDate);
                      setEventActionItem(null);
                      setLocation(`/reviews?${params.toString()}`);
                    }}
                    data-testid="button-event-open-review"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in TBR Reviews
                  </Button>
                )}
                {eventActionItem.snapshotId && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => {
                      handleDownloadPdf(eventActionItem.snapshotId!);
                      setEventActionItem(null);
                    }}
                    data-testid="button-event-download-pdf"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}
                {eventActionItem.scheduleId && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => {
                      setEventActionItem(null);
                      openEditScheduleDialog(eventActionItem.scheduleId!);
                    }}
                    data-testid="button-event-edit-schedule"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit / Reschedule
                  </Button>
                )}
                {eventActionItem.type === "completed" && !eventActionItem.scheduleId && linkedSchedule && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => {
                      setEventActionItem(null);
                      openEditScheduleDialog(linkedSchedule.id);
                    }}
                    data-testid="button-event-linked-schedule"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Schedule
                  </Button>
                )}
                {eventActionItem.type === "completed" && !eventActionItem.scheduleId && !linkedSchedule && eventActionItem.orgId && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-9 text-sm"
                    onClick={() => {
                      const oid = String(eventActionItem.orgId);
                      setEventActionItem(null);
                      setScheduleOrgId(oid);
                      openNewScheduleDialog();
                    }}
                    data-testid="button-event-create-schedule"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Next Review
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => { setScheduleDialogOpen(open); if (!open) setEditingScheduleId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-schedule-dialog-title">
              {editingScheduleId ? "Edit Schedule" : "Schedule TBR"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Client</label>
              <Select value={scheduleOrgId} onValueChange={setScheduleOrgId} disabled={!!editingScheduleId}>
                <SelectTrigger data-testid="select-schedule-client">
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations?.slice().sort((a, b) => a.name.localeCompare(b.name)).map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Review Date</label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                data-testid="input-next-review-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Frequency</label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger data-testid="select-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Every 3 months</SelectItem>
                  <SelectItem value="6">Every 6 months</SelectItem>
                  <SelectItem value="12">Every 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Account Manager Email</label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  type="email"
                  placeholder="manager@example.com"
                  value={reminderEmail}
                  onChange={(e) => setReminderEmail(e.target.value)}
                  data-testid="input-reminder-email"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Client-facing account manager for this client</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Engineer Email</label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  type="email"
                  placeholder="engineer@pelycon.com"
                  value={leadEngineerEmail}
                  onChange={(e) => setLeadEngineerEmail(e.target.value)}
                  data-testid="input-lead-engineer-email"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Lead engineer assigned to this client</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Input
                placeholder="Optional notes..."
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                data-testid="input-schedule-notes"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              {editingScheduleId ? (
                <Button
                  variant="destructive"
                  onClick={handleDeleteSchedule}
                  disabled={deleteScheduleMutation.isPending}
                  data-testid="button-delete-schedule"
                >
                  {deleteScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Cancel This Review
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} data-testid="button-cancel-schedule">
                  Close
                </Button>
                <Button
                  onClick={handleSaveSchedule}
                  disabled={!scheduleOrgId || upsertScheduleMutation.isPending}
                  data-testid="button-save-schedule"
                >
                  {upsertScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editingScheduleId ? "Save Changes" : "Save Schedule"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
