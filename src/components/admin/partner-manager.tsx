import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  partnerCreate,
  partnerDelete,
  partnerList,
  partnerRegenerateSlug,
  partnerSetLinkDisabled,
  partnerSetStatus,
  partnerUpdate,
} from "@/lib/partner.functions";
import { organisationList } from "@/lib/organisation.functions";
import { adminGetEventConfig } from "@/lib/event.functions";
import { mergePartnerForm } from "@/lib/event-config";
import {
  getPartnerFormDefinition,
  validateFieldValue,
  type PartnerField,
  type PartnerFormDefinition,
} from "@/lib/partner-form";
import { PartnerDynamicForm, type PartnerFormValues } from "@/components/partner-dynamic-form";
import { Copy, Download, Link2, Plus, RefreshCcw, Settings2, Trash2, ArrowUpDown } from "lucide-react";
import { PartnerFormBuilder } from "@/components/admin/partner-form-builder";
import { invalidateEventQueries } from "@/lib/query-cache";

type Partner = {
  id: string;
  slug: string;
  partner_name: string;
  organization: string | null;
  organizations: string[] | null;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  district: string | null;
  taluka: string | null;
  status: string;
  link_disabled: boolean;
  created_at: string;
  registration_count: number;
  custom_fields: Record<string, unknown> | null;
};

const SYSTEM_KEYS = new Set([
  "partner_name",
  "organizations",
  "contact_person",
  "mobile",
  "email",
  "district",
  "taluka",
]);

function partnerToValues(p: Partner | null, def: PartnerFormDefinition): PartnerFormValues {
  const v: PartnerFormValues = {};
  for (const f of def.fields) {
    if (f.systemKey === "partner_name") v[f.key] = p?.partner_name ?? "";
    else if (f.systemKey === "organizations") {
      const orgs = (p?.organizations && p.organizations.length
        ? p.organizations
        : p?.organization ? [p.organization] : []).filter(Boolean);
      v[f.key] = f.multi === false ? (orgs[0] ?? "") : orgs;
    } else if (f.systemKey === "contact_person") v[f.key] = p?.contact_person ?? "";
    else if (f.systemKey === "mobile") v[f.key] = p?.mobile ?? "";
    else if (f.systemKey === "email") v[f.key] = p?.email ?? "";
    else if (f.systemKey === "district") v[f.key] = p?.district ?? "";
    else if (f.systemKey === "taluka") v[f.key] = p?.taluka ?? "";
    else v[f.key] = p?.custom_fields?.[f.key] ?? (f.type === "multiselect" ? [] : "");
  }
  return v;
}

function valuesToPayload(values: PartnerFormValues, def: PartnerFormDefinition) {
  const payload: Record<string, unknown> = {
    partner_name: "",
    organizations: [] as string[],
    contact_person: "",
    mobile: "",
    email: "",
    district: "",
    taluka: "",
  };
  const custom: Record<string, unknown> = {};
  for (const f of def.fields) {
    const raw = values[f.key];
    if (f.systemKey === "organizations") {
      const arr = Array.isArray(raw)
        ? (raw as string[])
        : raw
          ? [String(raw)]
          : [];
      payload.organizations = arr.filter(Boolean);
    } else if (f.systemKey) {
      payload[f.systemKey] = raw == null ? "" : String(raw);
    } else if (!SYSTEM_KEYS.has(f.key)) {
      // Only store into custom_fields when field is enabled + visible (otherwise skip)
      if (f.visible && f.enabled && raw !== undefined && raw !== "" && !(Array.isArray(raw) && raw.length === 0)) {
        custom[f.key] = raw;
      }
    }
  }
  return { payload, custom };
}

function formatCell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function PartnerManager({ readOnly, eventId }: { readOnly: boolean; eventId?: string }) {
  const list = useServerFn(partnerList);
  const create = useServerFn(partnerCreate);
  const update = useServerFn(partnerUpdate);
  const del = useServerFn(partnerDelete);
  const setStatus = useServerFn(partnerSetStatus);
  const setLinkDisabled = useServerFn(partnerSetLinkDisabled);
  const regenerate = useServerFn(partnerRegenerateSlug);
  const qc = useQueryClient();

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["partner-list", eventId ?? "all"],
    queryFn: () => list({ data: { event_id: eventId } }),
    refetchInterval: 15_000,
  });

  const loadOrgs = useServerFn(organisationList);
  const { data: orgData } = useQuery({
    queryKey: ["organisations", eventId ?? "none"],
    queryFn: () => loadOrgs({ data: { event_id: eventId as string } }),
    enabled: !!eventId,
  });
  const orgOptions = (orgData?.ok ? orgData.rows : []).filter(
    (o: { status: string }) => o.status === "active",
  ) as Array<{ id: string; name: string }>;

  const getCfg = useServerFn(adminGetEventConfig);
  const { data: cfgData } = useQuery({
    queryKey: ["event-config-partnerform", eventId ?? "none"],
    queryFn: () => getCfg({ data: { event_id: eventId } }),
    enabled: !!eventId,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPartnerForm = (cfgData?.ok ? (cfgData.config as any)?.partner_form : null) ?? null;
  const legacyForm = mergePartnerForm(rawPartnerForm);
  const definition = useMemo(
    () => getPartnerFormDefinition(legacyForm, rawPartnerForm?.definition ?? null),
    [legacyForm, rawPartnerForm],
  );
  const extraFields: PartnerField[] = definition.fields.filter(
    (f) => !f.systemKey && f.visible && f.enabled && f.type !== "hidden",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventSlug = (cfgData?.ok ? ((cfgData.config as any)?.slug as string | undefined) : undefined) ?? null;

  const rows: Partner[] = data?.ok ? (data.rows as Partner[]) : [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [values, setValues] = useState<PartnerFormValues>({});
  const [dialogStatus, setDialogStatus] = useState<"active" | "inactive">("active");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Search / filter / sort
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (data && !data.ok) toast.error(data.error);
  }, [data]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (orgFilter !== "all") {
        const orgs = (p.organizations && p.organizations.length ? p.organizations : p.organization ? [p.organization] : []).filter(Boolean);
        if (!orgs.includes(orgFilter)) return false;
      }
      if (!q) return true;
      const hay = [
        p.partner_name, p.contact_person, p.mobile, p.email, p.district, p.taluka, p.slug,
        ...(p.organizations ?? []),
        ...Object.values(p.custom_fields ?? {}).map((v) => formatCell(v)),
      ].filter(Boolean).map((s) => String(s).toLowerCase()).join(" ");
      return hay.includes(q);
    });
    out.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      let c: number;
      if (typeof av === "number" && typeof bv === "number") c = av - bv;
      else c = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? c : -c;
    });
    return out;
  }, [rows, search, statusFilter, orgFilter, sortKey, sortDir]);

  function getSortValue(p: Partner, key: string): string | number {
    if (key === "partner_name") return p.partner_name ?? "";
    if (key === "created_at") return p.created_at ?? "";
    if (key === "registration_count") return p.registration_count ?? 0;
    if (key === "status") return p.status ?? "";
    if (key === "district") return p.district ?? "";
    // extra fields
    const v = p.custom_fields?.[key];
    return v == null ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function openCreate() {
    setEditing(null);
    setValues(partnerToValues(null, definition));
    setDialogStatus("active");
    setErrors({});
    setDialogOpen(true);
  }
  function openEdit(p: Partner) {
    setEditing(p);
    setValues(partnerToValues(p, definition));
    setDialogStatus(p.status === "inactive" ? "inactive" : "active");
    setErrors({});
    setDialogOpen(true);
  }

  async function onSave() {
    const errs: Record<string, string | null> = {};
    for (const f of definition.fields) {
      const err = validateFieldValue(f, values[f.key]);
      if (err) errs[f.key] = err;
    }
    setErrors(errs);
    const firstErr = Object.values(errs).find((e) => !!e);
    if (firstErr) return toast.error(firstErr);

    const { payload, custom } = valuesToPayload(values, definition);
    const body = {
      partner_name: String(payload.partner_name || ""),
      organizations: (payload.organizations as string[]) ?? [],
      contact_person: String(payload.contact_person || ""),
      mobile: String(payload.mobile || ""),
      email: String(payload.email || ""),
      district: String(payload.district || ""),
      taluka: String(payload.taluka || ""),
      status: dialogStatus,
      event_id: eventId,
      custom_fields: custom,
    };
    const res = editing
      ? await update({ data: { id: editing.id, ...body } })
      : await create({ data: body });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
    toast.success(editing ? "Partner updated" : "Partner added");
    setDialogOpen(false);
  }

  async function onDelete(p: Partner) {
    if (!confirm(`Delete partner "${p.partner_name}"? Existing registrations will keep their partner tag but the link will stop working.`)) return;
    const res = await del({ data: { id: p.id } });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
    toast.success("Partner deleted");
  }
  async function onToggleStatus(p: Partner, next: boolean) {
    const res = await setStatus({ data: { id: p.id, status: next ? "active" : "inactive" } });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
  }
  async function onToggleLink(p: Partner, disabled: boolean) {
    const res = await setLinkDisabled({ data: { id: p.id, disabled } });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
  }
  async function onRegenerate(p: Partner) {
    if (!confirm(`Regenerate the link for "${p.partner_name}"? The old link will stop working.`)) return;
    const res = await regenerate({ data: { id: p.id } });
    if (!res.ok) return toast.error(res.error);
    invalidateEventQueries(qc, eventId);
    toast.success("New link generated");
  }

  function linkFor(slug: string) {
    const path = eventSlug ? `/${eventSlug}/partner/${slug}` : `/register/partner/${slug}`;
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }
  async function copyLink(slug: string) {
    try { await navigator.clipboard.writeText(linkFor(slug)); toast.success("Link copied"); }
    catch { toast.error("Could not copy link"); }
  }

  function exportCsv() {
    const baseCols: Array<{ label: string; get: (p: Partner) => unknown }> = [
      { label: "Partner Name", get: (p) => p.partner_name },
      { label: "Slug", get: (p) => p.slug },
      { label: "Link", get: (p) => linkFor(p.slug) },
      { label: "Organisations", get: (p) => (p.organizations && p.organizations.length ? p.organizations : p.organization ? [p.organization] : []) },
      { label: "Contact Person", get: (p) => p.contact_person },
      { label: "Mobile", get: (p) => p.mobile },
      { label: "Email", get: (p) => p.email },
      { label: "District", get: (p) => p.district },
      { label: "Taluka", get: (p) => p.taluka },
      { label: "Status", get: (p) => p.status },
      { label: "Link Active", get: (p) => !p.link_disabled },
      { label: "Registrations", get: (p) => p.registration_count },
      { label: "Created", get: (p) => p.created_at },
    ];
    const extraCols = extraFields.map((f) => ({
      label: f.label,
      get: (p: Partner) => p.custom_fields?.[f.key],
    }));
    const cols = [...baseCols, ...extraCols];
    const header = cols.map((c) => csvEscape(c.label)).join(",");
    const body = filteredRows.map((p) => cols.map((c) => csvEscape(c.get(p))).join(",")).join("\n");
    const csv = `${header}\r\n${body}`;
    // UTF-8 BOM ensures Excel opens non-Latin text without mojibake.
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partners-${eventSlug ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const [view, setView] = useState<"list" | "builder">("list");

  if (view === "builder" && eventId && !readOnly) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-primary">Partner Registration Form</h2>
            <p className="text-sm text-muted-foreground">Design the form partners fill in for this event.</p>
          </div>
          <Button variant="outline" onClick={() => setView("list")}>← Back to Partners</Button>
        </div>
        <PartnerFormBuilder eventId={eventId} />
      </div>
    );
  }

  const orgFilterOptions = Array.from(new Set(
    rows.flatMap((p) => (p.organizations && p.organizations.length ? p.organizations : p.organization ? [p.organization] : []).filter(Boolean)),
  )).sort();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-primary">Partner Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage partners and their unique registration links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filteredRows.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
          {!readOnly && eventId && (
            <Button variant="outline" onClick={() => setView("builder")}>
              <Settings2 className="mr-2 h-4 w-4" />Form Builder
            </Button>
          )}
          {!readOnly && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />Add Partner
            </Button>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search partners, contact, custom fields…"
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {orgFilterOptions.length > 0 && (
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organisations</SelectItem>
              {orgFilterOptions.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {filteredRows.length} of {rows.length}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <SortableTh label="Partner" sortKey="partner_name" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="p-3">Contact</th>
              <SortableTh label="District" sortKey="district" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="p-3">Link</th>
              <SortableTh label="Regs" sortKey="registration_count" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableTh label="Status" sortKey="status" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="p-3">Link Active</th>
              {extraFields.map((f) => (
                <SortableTh key={f.id} label={f.label} sortKey={f.key} active={sortKey} dir={sortDir} onClick={toggleSort} />
              ))}
              {!readOnly && <th className="p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={7 + extraFields.length + (readOnly ? 0 : 1)} className="p-6 text-center text-muted-foreground">
                  {isFetching ? "Loading…" : rows.length === 0 ? "No partners yet." : "No partners match your filters."}
                </td>
              </tr>
            )}
            {filteredRows.map((p) => {
              const orgList = (p.organizations && p.organizations.length ? p.organizations : p.organization ? [p.organization] : []).filter(Boolean);
              return (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-medium">{p.partner_name}</div>
                    {orgList.length > 0 && (
                      <div className="text-xs text-muted-foreground">{orgList.join(", ")}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {p.contact_person && <div>{p.contact_person}</div>}
                    {p.mobile && <div className="text-muted-foreground">{p.mobile}</div>}
                    {p.email && <div className="text-muted-foreground">{p.email}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    {p.district ?? "—"}
                    {p.taluka && <div className="text-muted-foreground">{p.taluka}</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.slug}</code>
                      <Button size="sm" variant="ghost" onClick={() => copyLink(p.slug)} title="Copy link">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <a href={linkFor(p.slug)} target="_blank" rel="noreferrer" className="text-brand-primary" title="Open link">
                        <Link2 className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-brand-primary">{p.registration_count}</td>
                  <td className="p-3">
                    <Switch checked={p.status === "active"} disabled={readOnly} onCheckedChange={(v) => onToggleStatus(p, v)} />
                  </td>
                  <td className="p-3">
                    <Switch checked={!p.link_disabled} disabled={readOnly} onCheckedChange={(v) => onToggleLink(p, !v)} />
                  </td>
                  {extraFields.map((f) => (
                    <td key={f.id} className="p-3 text-xs">
                      {formatCell(p.custom_fields?.[f.key])}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => onRegenerate(p)} title="Regenerate link">
                          <RefreshCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDelete(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Partner" : "Add Partner"}</DialogTitle>
            <DialogDescription>
              A unique registration link is generated automatically. Fields below come from the published Partner Form for this event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <PartnerDynamicForm
              definition={definition}
              values={values}
              onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
              errors={errors}
              organisationOptions={orgOptions}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Status</label>
              <Select value={dialogStatus} onValueChange={(v) => setDialogStatus(v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={onSave}>{editing ? "Save Changes" : "Create Partner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableTh({
  label, sortKey, active, dir, onClick,
}: {
  label: string; sortKey: string; active: string; dir: "asc" | "desc"; onClick: (k: string) => void;
}) {
  const isActive = active === sortKey;
  return (
    <th className="p-3">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
        {isActive && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
