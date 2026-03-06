import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Shield, Eye, UserCog, Lock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCurrentUser, ALL_PAGE_KEYS } from "@/App";
import { useToast } from "@/hooks/use-toast";

interface UserRecord {
  id: number;
  email: string;
  displayName: string;
  role: string;
  pageAccess: Record<string, boolean> | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Shield }> = {
  admin: { label: "Admin", icon: Shield },
  editor: { label: "Editor", icon: UserCog },
  viewer: { label: "Viewer", icon: Eye },
};

function PageAccessToggles({
  pageAccess,
  onChange,
  disabled,
}: {
  pageAccess: Record<string, boolean>;
  onChange: (updated: Record<string, boolean>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5" />
        Page Access
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {ALL_PAGE_KEYS.map(({ key, label }) => {
          const enabled = pageAccess[key] !== false;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...pageAccess, [key]: !enabled })}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                enabled
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-muted bg-muted/30 text-muted-foreground"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/60"}`}
              data-testid={`toggle-page-${key}`}
            >
              <div
                className={`h-3 w-3 rounded-sm border ${
                  enabled ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getDefaultPageAccess(): Record<string, boolean> {
  const access: Record<string, boolean> = {};
  ALL_PAGE_KEYS.forEach(({ key }) => { access[key] = true; });
  return access;
}

function getPageAccessSummary(user: UserRecord): string {
  if (user.role === "admin") return "All pages";
  if (!user.pageAccess) return "All pages";
  const denied = ALL_PAGE_KEYS.filter(({ key }) => user.pageAccess?.[key] === false);
  if (denied.length === 0) return "All pages";
  const allowed = ALL_PAGE_KEYS.filter(({ key }) => user.pageAccess?.[key] !== false);
  return `${allowed.length}/${ALL_PAGE_KEYS.length} pages`;
}

export default function UserManagement() {
  const { user: currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("viewer");
  const [formPageAccess, setFormPageAccess] = useState<Record<string, boolean>>(getDefaultPageAccess());

  const { data: usersList = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { email: string; displayName: string; password: string; role: string; pageAccess: Record<string, boolean> }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "User Created", description: "New user account has been created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; email?: string; displayName?: string; password?: string; role?: string; pageAccess?: Record<string, boolean> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      resetForm();
      toast({ title: "User Updated", description: "User account has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteTarget(null);
      toast({ title: "User Deleted", description: "User account has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormEmail("");
    setFormName("");
    setFormPassword("");
    setFormRole("viewer");
    setFormPageAccess(getDefaultPageAccess());
  }

  function openCreate() {
    resetForm();
    setShowCreateDialog(true);
  }

  function openEdit(user: UserRecord) {
    setFormEmail(user.email);
    setFormName(user.displayName);
    setFormPassword("");
    setFormRole(user.role);
    setFormPageAccess(user.pageAccess || getDefaultPageAccess());
    setEditingUser(user);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      email: formEmail,
      displayName: formName,
      password: formPassword,
      role: formRole,
      pageAccess: formRole === "admin" ? getDefaultPageAccess() : formPageAccess,
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    const data: any = {
      id: editingUser.id,
      email: formEmail,
      displayName: formName,
      role: formRole,
      pageAccess: formRole === "admin" ? getDefaultPageAccess() : formPageAccess,
    };
    if (formPassword) data.password = formPassword;
    updateMutation.mutate(data);
  }

  function roleBadgeVariant(role: string) {
    switch (role) {
      case "admin": return "default" as const;
      case "editor": return "secondary" as const;
      default: return "outline" as const;
    }
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-users-title">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage who can access the TBR dashboard</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-create-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {usersList.map((u) => (
            <Card key={u.id} data-testid={`card-user-${u.id}`}>
              <CardContent className="py-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium">
                      {u.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate" data-testid={`text-user-name-${u.id}`}>{u.displayName}</div>
                    <div className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${u.id}`}>{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs" data-testid={`badge-page-access-${u.id}`}>
                    {getPageAccessSummary(u)}
                  </Badge>
                  <Badge variant={roleBadgeVariant(u.role)} data-testid={`badge-user-role-${u.id}`}>
                    {ROLE_LABELS[u.role]?.label || u.role}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(u)}
                    data-testid={`button-edit-user-${u.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={u.id === currentUser?.id}
                    onClick={() => setDeleteTarget(u)}
                    data-testid={`button-delete-user-${u.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {usersList.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No users found.</p>
          )}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Display Name</Label>
              <Input id="create-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" data-testid="input-create-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input id="create-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="user@example.com" data-testid="input-create-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input id="create-password" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Min 6 characters" data-testid="input-create-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger data-testid="select-create-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                  <SelectItem value="editor">Editor - Can create/edit reviews</SelectItem>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formRole !== "admin" && (
              <PageAccessToggles
                pageAccess={formPageAccess}
                onChange={setFormPageAccess}
              />
            )}
            {formRole === "admin" && (
              <p className="text-xs text-muted-foreground italic">Admins automatically have access to all pages.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !formEmail || !formName || !formPassword}
                data-testid="button-confirm-create"
              >
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display Name</Label>
              <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} data-testid="input-edit-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} data-testid="input-edit-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input id="edit-password" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Leave blank to keep current" data-testid="input-edit-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                  <SelectItem value="editor">Editor - Can create/edit reviews</SelectItem>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formRole !== "admin" && (
              <PageAccessToggles
                pageAccess={formPageAccess}
                onChange={setFormPageAccess}
              />
            )}
            {formRole === "admin" && (
              <p className="text-xs text-muted-foreground italic">Admins automatically have access to all pages.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !formEmail || !formName}
                data-testid="button-confirm-edit"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.displayName}</strong> ({deleteTarget?.email})?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
