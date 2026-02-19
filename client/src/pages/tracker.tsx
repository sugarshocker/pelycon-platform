import { useState } from "react";
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
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Calendar,
  Loader2,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Organization, TbrSnapshot, TbrSchedule } from "@shared/schema";

export default function Tracker() {
  const { toast } = useToast();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [nextDate, setNextDate] = useState("");
  const [frequency, setFrequency] = useState("6");
  const [scheduleNotes, setScheduleNotes] = useState("");

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
    mutationFn: async (data: { orgId: number; orgName: string; frequencyMonths: number; nextReviewDate: string | null; notes: string | null }) => {
      const res = await apiRequest("POST", "/api/schedules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setScheduleDialogOpen(false);
      setEditingOrg(null);
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
      toast({ title: "Schedule removed" });
    },
  });

  const now = new Date();
  const recentTbrs = (allFinalized || []).slice(0, 10);

  const upcomingSchedules = (schedules || [])
    .filter((s) => s.nextReviewDate)
    .sort((a, b) => new Date(a.nextReviewDate!).getTime() - new Date(b.nextReviewDate!).getTime());

  const overdue = upcomingSchedules.filter((s) => new Date(s.nextReviewDate!) < now);
  const upcoming = upcomingSchedules.filter((s) => {
    const d = new Date(s.nextReviewDate!);
    return d >= now && d <= new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  });

  const openScheduleDialog = (org: Organization) => {
    setEditingOrg(org);
    const existing = schedules?.find((s) => s.orgId === org.id);
    if (existing) {
      setFrequency(String(existing.frequencyMonths));
      setNextDate(existing.nextReviewDate ? new Date(existing.nextReviewDate).toISOString().split("T")[0] : "");
      setScheduleNotes(existing.notes || "");
    } else {
      setFrequency("6");
      setNextDate("");
      setScheduleNotes("");
    }
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = () => {
    if (!editingOrg) return;
    upsertScheduleMutation.mutate({
      orgId: editingOrg.id,
      orgName: editingOrg.name,
      frequencyMonths: parseInt(frequency),
      nextReviewDate: nextDate || null,
      notes: scheduleNotes || null,
    });
  };

  const getDaysDiff = (date: Date) => Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const getStatusBadge = (schedule: TbrSchedule) => {
    if (!schedule.nextReviewDate) return <Badge variant="secondary" data-testid={`badge-status-${schedule.orgId}`}>Not scheduled</Badge>;
    const days = getDaysDiff(new Date(schedule.nextReviewDate));
    if (days < 0) return <Badge variant="destructive" data-testid={`badge-status-${schedule.orgId}`}>Overdue ({Math.abs(days)}d)</Badge>;
    if (days <= 14) return <Badge className="bg-amber-500 text-white" data-testid={`badge-status-${schedule.orgId}`}>Due soon ({days}d)</Badge>;
    return <Badge variant="secondary" data-testid={`badge-status-${schedule.orgId}`}>In {days} days</Badge>;
  };

  const getLastReview = (orgId: number) => {
    const reviews = allFinalized?.filter((s) => s.orgId === orgId);
    return reviews?.[0] || null;
  };

  const isLoading = orgsLoading || finalizedLoading || schedulesLoading;

  return (
    <div className="h-full bg-background">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold" data-testid="text-tracker-title">TBR Tracker</h1>
          <p className="text-sm text-muted-foreground">Track review schedules and completion across all clients</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="space-y-6">
            {(overdue.length > 0 || upcoming.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overdue.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        Overdue Reviews
                      </CardTitle>
                      <Badge variant="destructive">{overdue.length}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {overdue.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-sm" data-testid={`overdue-${s.orgId}`}>
                          <span className="font-medium truncate">{s.orgName}</span>
                          <span className="text-xs text-destructive whitespace-nowrap">
                            {Math.abs(getDaysDiff(new Date(s.nextReviewDate!)))} days overdue
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {upcoming.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Upcoming Reviews (60 days)
                      </CardTitle>
                      <Badge variant="secondary">{upcoming.length}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {upcoming.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-sm" data-testid={`upcoming-${s.orgId}`}>
                          <span className="font-medium truncate">{s.orgName}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(s.nextReviewDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {" "}({getDaysDiff(new Date(s.nextReviewDate!))} days)
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {recentTbrs.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Recent Completed Reviews
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentTbrs.map((snap) => (
                      <div key={snap.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b last:border-0" data-testid={`recent-tbr-${snap.id}`}>
                        <span className="font-medium truncate">{snap.orgName}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                          <span>{snap.totalDevices} devices</span>
                          <span>{snap.totalTickets} tickets</span>
                          <span>
                            {new Date(snap.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  All Client Schedules
                </CardTitle>
              </CardHeader>
              <CardContent>
                {organizations && organizations.length > 0 ? (
                  <div className="space-y-1">
                    {organizations.map((org) => {
                      const schedule = schedules?.find((s) => s.orgId === org.id);
                      const lastReview = getLastReview(org.id);
                      return (
                        <div
                          key={org.id}
                          className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                          data-testid={`client-schedule-${org.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{org.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {lastReview
                                ? `Last review: ${new Date(lastReview.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                                : "No reviews yet"}
                              {schedule && ` · Every ${schedule.frequencyMonths} months`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {schedule && getStatusBadge(schedule)}
                            <Button
                              size="sm"
                              variant={schedule ? "outline" : "default"}
                              onClick={() => openScheduleDialog(org)}
                              data-testid={`button-schedule-${org.id}`}
                            >
                              {schedule ? (
                                <>
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Edit
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Schedule
                                </>
                              )}
                            </Button>
                            {schedule && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                                data-testid={`button-delete-schedule-${org.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No clients found. Connect NinjaOne to see your client list.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-schedule-dialog-title">
              {editingOrg ? `Schedule TBR — ${editingOrg.name}` : "Schedule TBR"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Next Review Date</label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                data-testid="input-next-review-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Review Frequency</label>
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
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Input
                placeholder="Optional scheduling notes..."
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                data-testid="input-schedule-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} data-testid="button-cancel-schedule">
                Cancel
              </Button>
              <Button
                onClick={handleSaveSchedule}
                disabled={upsertScheduleMutation.isPending}
                data-testid="button-save-schedule"
              >
                {upsertScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
