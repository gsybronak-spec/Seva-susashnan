import { useState } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  adminListDistricts,
  adminCreateDistrict,
  adminUpdateDistrict,
  adminDeleteDistrict,
  adminSetDistrictRegistrationOpen,
} from "@/lib/district.functions";
import { Copy, Edit, Link as LinkIcon, MapPin, Plus, Trash2 } from "lucide-react";
import { invalidateEventQueries } from "@/lib/query-cache";

type DistrictRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  registration_count: number;
  event_id: string | null;
  event_is_active: boolean;
  event_title: string;
  registration_open: boolean;
};

function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function copy(text: string, label: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error("Clipboard not available");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Could not copy ${label}`),
  );
}

export function DistrictManager() {
  const list = useServerFn(adminListDistricts);
  const create = useServerFn(adminCreateDistrict);
  const update = useServerFn(adminUpdateDistrict);
  const remove = useServerFn(adminDeleteDistrict);
  const setRegOpen = useServerFn(adminSetDistrictRegistrationOpen);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-districts"],
    queryFn: () => list(),
    refetchInterval: 15_000,
  });
  const loadFailed = isError || (data !== undefined && !data.ok);
  const rows = (data?.ok ? (data.rows as DistrictRow[]) : []) ?? [];

  const [creating, setCreating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editRow, setEditRow] = useState<DistrictRow | null>(null);

  function refresh() {
    invalidateEventQueries(qc);
  }

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await create({
        data: { name: name.trim(), slug: (slug || slugify(name)).toLowerCase() },
      });
      if (!res.ok) return toast.error(res.error);
      toast.success("District created");
      setName(""); setSlug("");
      setAddOpen(false);
      refresh();
    } finally { setCreating(false); }
  }

  async function onToggleActive(row: DistrictRow, next: boolean) {
    const res = await update({ data: { id: row.id, is_active: next } });
    if (!res.ok) return toast.error(res.error);
    toast.success(next ? "District enabled" : "District disabled");
    refresh();
  }

  async function onToggleRegistration(row: DistrictRow, next: boolean) {
    // Must target the EXACT event — never "the most recent event for the
    // district", which could flip a different event's registration when a
    // district has several events.
    if (!row.event_id) {
      toast.error("This district has no event to toggle.");
      return;
    }
    const res = await setRegOpen({
      data: { event_id: row.event_id, district_id: row.id, open: next },
    });
    if (!res.ok) return toast.error(res.error);
    toast.success(next ? "Registration opened" : "Registration closed");
    refresh();
  }

  async function onDelete(row: DistrictRow) {
    if (!confirm(`Delete district "${row.name}"? This cannot be undone.`)) return;
    const res = await remove({ data: { id: row.id } });
    if (!res.ok) return toast.error(res.error);
    toast.success("District deleted");
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-primary">Districts</h2>
          <p className="text-sm text-muted-foreground">
            Each active district gets its own registration, live, certificate and partner links.
            Multiple districts can be active simultaneously.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add District</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New District</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }}
                  required minLength={2} maxLength={120}
                  placeholder="e.g. Surat"
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL Slug *</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required minLength={2} maxLength={60}
                  pattern="[a-z0-9-]+"
                  placeholder="surat"
                />
                <p className="text-xs text-muted-foreground">
                  The public URL will be <code>/{slug || "your-slug"}/register</code>
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">
            Unable to load districts. Please refresh.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof Error ? error.message : data && !data.ok ? data.error : ""}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!loadFailed && (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">District</th>
              <th className="p-3">Event</th>
              <th className="p-3">Registrations</th>
              <th className="p-3">Registration</th>
              <th className="p-3">Active</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  {isLoading ? "Loading…" : "No districts yet. Add your first one."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-3">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <MapPin className="h-4 w-4 text-brand-primary" />
                    {r.name}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">/{r.slug}</div>
                </td>
                <td className="p-3">
                  {r.event_id ? (
                    <>
                      <div className="text-xs">{r.event_title || "(untitled)"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.event_is_active ? "Active" : "Inactive"}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">No event</span>
                  )}
                </td>
                <td className="p-3">{r.registration_count}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={r.registration_open}
                      disabled={!r.event_id}
                      onCheckedChange={(v) => onToggleRegistration(r, v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {r.registration_open ? "Open" : "Closed"}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <Switch checked={r.is_active} onCheckedChange={(v) => onToggleActive(r, v)} />
                </td>
                <td className="p-3">
                  <div className="flex flex-col items-end gap-2">
                    <PublicLinks slug={r.slug} />
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditRow(r)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Delete" onClick={() => onDelete(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {editRow && (
        <EditDialog
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); refresh(); }}
        />
      )}
    </div>
  );
}

function PublicLinks({ slug }: { slug: string }) {
  const origin = siteOrigin();
  const reg = `${origin}/${slug}/register`;
  const live = `${origin}/${slug}/live`;
  const cert = `${origin}/${slug}/certificate`;
  const all = `Registration:\n${reg}\n\nLive:\n${live}\n\nCertificate:\n${cert}`;

  return (
    <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
      <div className="mb-1 flex items-center gap-1 font-medium text-brand-primary">
        <LinkIcon className="h-3 w-3" /> Public Links
      </div>
      <div className="flex flex-wrap gap-1">
        <LinkChip label="Register" url={reg} onCopy={() => copy(reg, "Registration link")} />
        <LinkChip label="Live" url={live} onCopy={() => copy(live, "Live link")} />
        <LinkChip label="Certificate" url={cert} onCopy={() => copy(cert, "Certificate link")} />
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          onClick={() => copy(all, "All links")}
        >
          <Copy className="mr-1 h-3 w-3" /> Copy All
        </Button>
      </div>
    </div>
  );
}

function LinkChip({ label, url, onCopy }: { label: string; url: string; onCopy: () => void }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title={url}
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-accent"
    >
      <Copy className="h-3 w-3" />
      {label}
    </button>
  );
}

function EditDialog({
  row, onClose, onSaved,
}: {
  row: DistrictRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const update = useServerFn(adminUpdateDistrict);
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug);
  const [sortOrder, setSortOrder] = useState(row.sort_order);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await update({
        data: { id: row.id, name: name.trim(), slug: slug.toLowerCase(), sort_order: sortOrder },
      });
      if (!res.ok) return toast.error(res.error);
      toast.success("District updated");
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit District</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>URL Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              required minLength={2} maxLength={60}
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-muted-foreground">
              Changing the slug also changes every public URL for this district.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Sort Order</Label>
            <Input
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(e) => setSortOrder(Math.max(0, Math.min(9999, Number(e.target.value) || 0)))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
