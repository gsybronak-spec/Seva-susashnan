import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  organisationCreate,
  organisationDelete,
  organisationList,
  organisationUpdate,
} from "@/lib/organisation.functions";
import { Building2, Plus, Trash2 } from "lucide-react";
import { invalidateEventQueries } from "@/lib/query-cache";

type Org = {
  id: string;
  name: string;
  status: "active" | "inactive";
  notes: string | null;
  created_at: string;
};

const empty = { name: "", notes: "", status: "active" as "active" | "inactive" };

export function OrganisationsManager({
  eventId,
  readOnly,
}: {
  eventId: string | undefined;
  readOnly: boolean;
}) {
  const list = useServerFn(organisationList);
  const create = useServerFn(organisationCreate);
  const update = useServerFn(organisationUpdate);
  const del = useServerFn(organisationDelete);
  const qc = useQueryClient();

  const enabled = !!eventId;
  const { data, isFetching } = useQuery({
    queryKey: ["organisations", eventId ?? "none"],
    queryFn: () => list({ data: { event_id: eventId as string } }),
    enabled,
  });

  const rows = (data?.ok ? (data.rows as Org[]) : []) ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Org | null>(null);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (data && !data.ok) toast.error(data.error);
  }, [data]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(o: Org) {
    setEditing(o);
    setForm({ name: o.name, notes: o.notes ?? "", status: o.status });
    setOpen(true);
  }

  async function onSave() {
    if (!eventId) return toast.error("Select a event first.");
    if (!form.name.trim()) return toast.error("Organisation name is required.");
    const res = editing
      ? await update({ data: { id: editing.id, ...form } })
      : await create({ data: { event_id: eventId, ...form } });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
    toast.success(editing ? "Organisation updated" : "Organisation added");
    setOpen(false);
  }

  async function onDelete(o: Org) {
    if (!confirm(`Delete "${o.name}"? Existing partners keep their organisation label.`)) return;
    const res = await del({ data: { id: o.id } });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
  }

  async function toggleStatus(o: Org, next: boolean) {
    const res = await update({
      data: { id: o.id, name: o.name, notes: o.notes ?? "", status: next ? "active" : "inactive" },
    });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Select a specific event from the Event Scope selector above to manage its organisation list.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
            <Building2 className="h-5 w-5" /> Organisations
          </h2>
          <p className="text-sm text-muted-foreground">
            Per-event organisation list. Used by the Partner Registration form for this event only.
          </p>
        </div>
        {!readOnly && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Organisation
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Notes</th>
              <th className="p-3">Status</th>
              {!readOnly && <th className="p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="p-6 text-center text-muted-foreground">
                  {isFetching ? "Loading…" : "No organisations yet."}
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-border align-top">
                <td className="p-3 font-medium">{o.name}</td>
                <td className="p-3 text-xs text-muted-foreground">{o.notes ?? "—"}</td>
                <td className="p-3">
                  <Switch
                    checked={o.status === "active"}
                    disabled={readOnly}
                    onCheckedChange={(v) => toggleStatus(o, v)}
                  />
                </td>
                {!readOnly && (
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(o)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(o)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Organisation" : "Add Organisation"}</DialogTitle>
            <DialogDescription>Visible only inside this event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSave}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
