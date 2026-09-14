import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminCreateUser,
  adminDeleteUser,
  adminListUsers,
  adminSetUserCanViewPartners,
  adminSetUserDisabled,
  adminSetUserPassword,
} from "@/lib/registration.functions";
import {
  adminListAdminEventAccess,
  adminListEvents,
  adminSetAdminEventAccess,
} from "@/lib/event-admin.functions";
import { KeyRound, ListChecks, Plus, Shield, Trash2, UserCog } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";



type Row = {
  id: string;
  username: string;
  role: "super_admin" | "view_admin";
  disabled: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  has_password: boolean;
  can_view_partners: boolean;
};


export function UserManager({ currentUserId }: { currentUserId: string | null }) {
  const list = useServerFn(adminListUsers);
  const createUser = useServerFn(adminCreateUser);
  const setPwd = useServerFn(adminSetUserPassword);
  const setDisabled = useServerFn(adminSetUserDisabled);
  const setPartnerView = useServerFn(adminSetUserCanViewPartners);
  const del = useServerFn(adminDeleteUser);
  const listEvents = useServerFn(adminListEvents);
  const listAccess = useServerFn(adminListAdminEventAccess);
  const setAccess = useServerFn(adminSetAdminEventAccess);
  const qc = useQueryClient();


  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
    refetchInterval: 15_000,
  });

  const { data: eventsData } = useQuery({
    queryKey: ["admin-events-for-access"],
    queryFn: () => listEvents(),
  });
  const events = (eventsData?.ok
    ? (eventsData.rows as unknown as Array<{ id: string; slug: string | null; general: { title?: string } | null }>)
    : []) ?? [];

  const rows: Row[] = data?.ok ? (data.rows as Row[]) : [];


  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    role: "view_admin" as "super_admin" | "view_admin",
    password: "",
  });

  const [pwdTarget, setPwdTarget] = useState<Row | null>(null);
  const [pwdValue, setPwdValue] = useState("");

  const [accessTarget, setAccessTarget] = useState<Row | null>(null);
  const [accessSel, setAccessSel] = useState<Set<string>>(new Set());
  const [accessSaving, setAccessSaving] = useState(false);

  async function openAccess(r: Row) {
    setAccessTarget(r);
    setAccessSel(new Set());
    const res = await listAccess({ data: { admin_user_id: r.id } });
    if (res.ok) setAccessSel(new Set(res.event_ids));
  }

  async function saveAccess() {
    if (!accessTarget) return;
    setAccessSaving(true);
    try {
      const res = await setAccess({
        data: { admin_user_id: accessTarget.id, event_ids: Array.from(accessSel) },
      });
      if (!res.ok) return toast.error(res.error);
      toast.success("Event access updated");
      setAccessTarget(null);
    } finally {
      setAccessSaving(false);
    }
  }


  async function onCreate() {
    const res = await createUser({ data: newUser });
    if (!res.ok) return toast.error(res.error);
    toast.success("Admin created");
    setCreateOpen(false);
    setNewUser({ username: "", role: "view_admin", password: "" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function onSetPwd() {
    if (!pwdTarget) return;
    const res = await setPwd({
      data: { id: pwdTarget.id, password: pwdValue, require_change: false },
    });
    if (!res.ok) return toast.error(res.error);
    toast.success("Password updated");
    setPwdTarget(null);
    setPwdValue("");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function onToggle(r: Row) {
    const res = await setDisabled({ data: { id: r.id, disabled: !r.disabled } });
    if (!res.ok) return toast.error(res.error);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function onTogglePartnerView(r: Row, allow: boolean) {
    const res = await setPartnerView({ data: { id: r.id, allow } });
    if (!res.ok) return toast.error(res.error);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }


  async function onDelete(r: Row) {
    if (!confirm(`Delete admin "${r.username}"?`)) return;
    const res = await del({ data: { id: r.id } });
    if (!res.ok) return toast.error(res.error);
    toast.success("Admin deleted");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-primary">Admin Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage Super Admins and View Admins. Only Super Admins can access this
            page.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Admin
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Username</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Password</th>
              <th className="p-3">Last Login</th>
              <th className="p-3">Partner View</th>
              <th className="p-3 text-right">Actions</th>

            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">{r.username}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.role === "super_admin"
                        ? "bg-brand-accent/15 text-brand-accent"
                        : "bg-brand-primary/10 text-brand-primary"
                    }`}
                  >
                    <Shield className="h-3 w-3" />
                    {r.role === "super_admin" ? "Super Admin" : "View Admin"}
                  </span>
                </td>
                <td className="p-3">
                  {r.disabled ? (
                    <span className="text-destructive">Disabled</span>
                  ) : (
                    <span className="text-brand-success">Active</span>
                  )}
                </td>
                <td className="p-3">
                  {r.has_password ? (
                    r.must_change_password ? (
                      <span className="text-brand-accent">Must change</span>
                    ) : (
                      <span className="text-muted-foreground">Set</span>
                    )
                  ) : (
                    <span className="text-brand-accent">Not set</span>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {r.last_login_at
                    ? new Date(r.last_login_at).toLocaleString("en-IN")
                    : "—"}
                </td>
                <td className="p-3">
                  {r.role === "super_admin" ? (
                    <span className="text-xs text-muted-foreground">Always on</span>
                  ) : (
                    <Switch
                      checked={r.can_view_partners}
                      onCheckedChange={(v) => onTogglePartnerView(r, v)}
                    />
                  )}
                </td>
                <td className="p-3">

                  <div className="flex flex-wrap justify-end gap-1">
                    {r.role === "view_admin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAccess(r)}
                      >
                        <ListChecks className="mr-1 h-3.5 w-3.5" />
                        Events
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPwdTarget(r)}
                    >
                      <KeyRound className="mr-1 h-3.5 w-3.5" />
                      Password
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onToggle(r)}
                      disabled={r.id === currentUserId}
                    >
                      <UserCog className="mr-1 h-3.5 w-3.5" />
                      {r.disabled ? "Enable" : "Disable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(r)}
                      disabled={r.id === currentUserId}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No admins yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Username</Label>
              <Input
                value={newUser.username}
                onChange={(e) =>
                  setNewUser({ ...newUser, username: e.target.value })
                }
                placeholder="e.g. jane.doe"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(v) =>
                  setNewUser({ ...newUser, role: v as Row["role"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view_admin">View Admin (read-only)</SelectItem>
                  <SelectItem value="super_admin">Super Admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Initial Password (min 8 chars)</Label>
              <PasswordInput
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdTarget} onOpenChange={(o) => !o && setPwdTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password — {pwdTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>New Password (min 8 chars)</Label>
            <PasswordInput
              value={pwdValue}
              onChange={(e) => setPwdValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdTarget(null)}>
              Cancel
            </Button>
            <Button onClick={onSetPwd} disabled={pwdValue.length < 8}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessTarget} onOpenChange={(o) => !o && setAccessTarget(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Event Access — {accessTarget?.username}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Select the events this viewer admin can see. Super Admins always
            see all events.
          </p>
          <div className="space-y-2 py-2">
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events available.</p>
            )}
            {events.map((w) => {
              const checked = accessSel.has(w.id);
              return (
                <label
                  key={w.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = new Set(accessSel);
                      if (v) next.add(w.id);
                      else next.delete(w.id);
                      setAccessSel(next);
                    }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {w.general?.title ?? "(untitled)"}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {w.slug}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveAccess} disabled={accessSaving}>
              {accessSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
