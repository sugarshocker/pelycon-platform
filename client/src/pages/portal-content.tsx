import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Megaphone, BookOpen, FileText, Send, Globe, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AnnouncementType = "announcement" | "kb" | "service_guide";

interface Announcement {
  id: number;
  tenantId: number;
  clientId: number | null;
  title: string;
  body: string;
  type: AnnouncementType;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Client {
  id: number;
  companyName: string;
  portalEnabled: string;
}

const TYPE_META: Record<AnnouncementType, { label: string; icon: typeof Megaphone; color: string }> = {
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  kb: { label: "KB Article", icon: BookOpen, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  service_guide: { label: "Service Guide", icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
};

type Filter = "all" | AnnouncementType | "drafts";

function formatDateLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // Format for datetime-local input: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusOf(a: Announcement): "draft" | "published" | "expired" | "scheduled" {
  if (!a.publishedAt) return "draft";
  const now = new Date();
  const pub = new Date(a.publishedAt);
  if (pub > now) return "scheduled";
  if (a.expiresAt && new Date(a.expiresAt) < now) return "expired";
  return "published";
}

const STATUS_BADGE: Record<ReturnType<typeof statusOf>, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function PortalContent() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formType, setFormType] = useState<AnnouncementType>("announcement");
  const [formClientId, setFormClientId] = useState<string>("all"); // "all" or stringified client ID
  const [formPublishedAt, setFormPublishedAt] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");

  const { data: items = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/portal-management/clients"],
  });

  const clientById = useMemo(() => {
    const m = new Map<number, Client>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return items.filter(a => {
      if (filter === "all") return true;
      if (filter === "drafts") return !a.publishedAt;
      return a.type === filter;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [items, filter]);

  function openCreate() {
    setEditing(null);
    setFormTitle("");
    setFormBody("");
    setFormType("announcement");
    setFormClientId("all");
    setFormPublishedAt("");
    setFormExpiresAt("");
    setShowDialog(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setFormTitle(a.title);
    setFormBody(a.body);
    setFormType(a.type);
    setFormClientId(a.clientId == null ? "all" : String(a.clientId));
    setFormPublishedAt(formatDateLocal(a.publishedAt));
    setFormExpiresAt(formatDateLocal(a.expiresAt));
    setShowDialog(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: formTitle.trim(),
        body: formBody.trim(),
        type: formType,
        clientId: formClientId === "all" ? null : parseInt(formClientId),
        publishedAt: formPublishedAt ? new Date(formPublishedAt).toISOString() : null,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/announcements/${editing.id}`, payload);
      }
      return apiRequest("POST", "/api/announcements", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setShowDialog(false);
      toast({ title: editing ? "Updated" : "Created" });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/announcements/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Published" });
    },
    onError: (err: any) => toast({ title: "Publish failed", description: err.message, variant: "destructive" }),
  });

  const unpublishMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/announcements/${id}`, { publishedAt: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Unpublished — moved back to draft" });
    },
    onError: (err: any) => toast({ title: "Unpublish failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setDeleteTarget(null);
      toast({ title: "Deleted" });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "announcement", label: "Announcements" },
    { key: "kb", label: "Knowledge Base" },
    { key: "service_guide", label: "Service Guide" },
    { key: "drafts", label: "Drafts" },
  ];

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#394442] dark:text-white">Portal Content</h1>
          <p className="text-sm text-muted-foreground mt-1">Announcements, KB articles, and service guides shown in client portals.</p>
        </div>
        <Button onClick={openCreate} className="bg-[#E77125] hover:bg-[#E77125]/90 text-white gap-2">
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key
                ? "border-[#E77125] text-[#E77125]"
                : "border-transparent text-muted-foreground hover:text-[#394442] dark:hover:text-white"
            }`}
          >
            {tab.label}
            {tab.key === "drafts" && items.filter(i => !i.publishedAt).length > 0 && (
              <span className="ml-1.5 text-[10px] bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                {items.filter(i => !i.publishedAt).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>}

      {!isLoading && filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          {filter === "all" ? "No content yet. Click \"New\" to publish your first announcement." : "Nothing in this category yet."}
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map(a => {
          const meta = TYPE_META[a.type];
          const status = statusOf(a);
          const Icon = meta.icon;
          return (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${meta.color.split(" ")[1]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-[#394442] dark:text-white">{a.title}</h3>
                          <Badge className={`${meta.color} border-0 text-[10px] px-2`}>{meta.label}</Badge>
                          <Badge className={`${STATUS_BADGE[status]} border-0 text-[10px] px-2 capitalize`}>{status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {a.clientId == null
                              ? <><Globe className="h-3 w-3" /> All clients</>
                              : <><Users className="h-3 w-3" /> {clientById.get(a.clientId)?.companyName ?? `Client #${a.clientId}`}</>}
                          </span>
                          {a.publishedAt && <><span>·</span><span>Published {new Date(a.publishedAt).toLocaleDateString()}</span></>}
                          {a.expiresAt && <><span>·</span><span>Expires {new Date(a.expiresAt).toLocaleDateString()}</span></>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 whitespace-pre-wrap">{a.body}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {status === "draft" || status === "expired" ? (
                          <Button size="sm" variant="ghost" onClick={() => publishMutation.mutate(a.id)} disabled={publishMutation.isPending} title="Publish now" className="h-8 w-8 p-0">
                            <Send className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => unpublishMutation.mutate(a.id)} disabled={unpublishMutation.isPending} title="Unpublish (back to draft)" className="h-8 w-8 p-0 text-muted-foreground">
                            <Send className="h-4 w-4 rotate-180" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(a)} title="Edit" className="h-8 w-8 p-0">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(a)} title="Delete" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit content" : "New content"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as AnnouncementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="kb">Knowledge Base article</SelectItem>
                    <SelectItem value="service_guide">Service Guide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visible to</Label>
                <Select value={formClientId} onValueChange={setFormClientId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Scheduled maintenance Saturday" />
            </div>

            <div>
              <Label>Body</Label>
              <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} rows={6} placeholder="Markdown is fine. Clients see this exactly as written." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Publish at <span className="text-muted-foreground text-xs">(blank = draft)</span></Label>
                <Input type="datetime-local" value={formPublishedAt} onChange={(e) => setFormPublishedAt(e.target.value)} />
              </div>
              <div>
                <Label>Expires at <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="datetime-local" value={formExpiresAt} onChange={(e) => setFormExpiresAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !formTitle.trim() || !formBody.trim()}
              className="bg-[#E77125] hover:bg-[#E77125]/90 text-white"
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this {deleteTarget && TYPE_META[deleteTarget.type].label.toLowerCase()}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">"{deleteTarget?.title}" will be permanently removed. This can't be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
