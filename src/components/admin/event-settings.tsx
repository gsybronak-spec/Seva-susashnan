import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateEventQueries } from "@/lib/query-cache";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  adminGetEventConfig,
  adminUpdateEventSection,

} from "@/lib/event.functions";
import { adminListDistricts } from "@/lib/district.functions";
import { Check } from "lucide-react";
import {
  DEFAULT_CONFIG,
  deepClone,
  mergeConfig,
  type EventConfig,
  type EventSection,
  type SocialPlatformKey,
  PARTNER_FIELD_KEYS,
  PARTNER_FIELD_ESSENTIAL,
  type PartnerFieldKey,
  type EventPartnerForm,
} from "@/lib/event-config";
import { FormBuilder } from "@/components/admin/form-builder";
import { CertificateSimple } from "@/components/admin/certificate-simple";

export function EventSettings({
  eventId,
  initialTab,
}: {
  eventId: string;
  initialTab?: "status" | "coverage" | "form" | "partner_form" | "general" | "features" | "attendance" | "certificate" | "referral" | "whatsapp" | "social";
}) {
  const load = useServerFn(adminGetEventConfig);
  const { data, isLoading } = useQuery({
    // Strictly event-scoped: never fall back to the "active" event, which
    // would let one event's config be cached under a shared key.
    queryKey: ["admin-event-config", eventId],
    queryFn: () => load({ data: { event_id: eventId } }),
    enabled: !!eventId,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!data?.ok) {
    return <div className="p-6 text-sm text-destructive">{data?.error ?? "Failed to load config"}</div>;
  }
  if (!data.config) {
    return <div className="p-6 text-sm text-muted-foreground">Selected event has no configuration.</div>;
  }
  const raw = data.config as unknown as Partial<EventConfig> & { id: string };
  const config = mergeConfig(raw);
  // key includes initialTab so a "Form Builder" click while already on
  // settings remounts with the right subtab active.
  return (
    <SettingsTabs
      key={`${raw.id}:${initialTab ?? "status"}`}
      config={{ ...config, id: raw.id }}
      initialTab={initialTab}
    />
  );
}

function SettingsTabs({ config, initialTab }: { config: EventConfig; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab ?? "status");
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        <TabsTrigger value="status">Status</TabsTrigger>
        <TabsTrigger value="coverage">Coverage & Districts</TabsTrigger>
        <TabsTrigger value="form">Form Builder</TabsTrigger>
        <TabsTrigger value="partner_form">Partner Form</TabsTrigger>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="features">Feature Toggles</TabsTrigger>
        <TabsTrigger value="attendance">Check-In Rules</TabsTrigger>
        <TabsTrigger value="certificate">Certificate</TabsTrigger>
        <TabsTrigger value="referral">Referral</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="social">Social Media</TabsTrigger>
      </TabsList>
      <TabsContent value="status">
        <StatusForm config={config} />
      </TabsContent>

      <TabsContent value="coverage"><CoverageForm config={config} /></TabsContent>
      <TabsContent value="form"><FormBuilder eventId={config.id} /></TabsContent>
      <TabsContent value="partner_form"><PartnerFormBuilder config={config} /></TabsContent>
      <TabsContent value="general"><GeneralForm config={config} /></TabsContent>
      <TabsContent value="features"><FeaturesForm config={config} /></TabsContent>
      <TabsContent value="attendance"><AttendanceForm config={config} /></TabsContent>
      <TabsContent value="certificate"><CertificateSimple eventId={config.id} /></TabsContent>
      <TabsContent value="referral"><ReferralForm config={config} /></TabsContent>
      <TabsContent value="whatsapp"><WhatsappForm config={config} /></TabsContent>
      <TabsContent value="social"><SocialForm config={config} /></TabsContent>
    </Tabs>
  );
}

function PartnerFormBuilder({ config }: { config: EventConfig }) {
  const [v, setV] = useState<EventPartnerForm>(config.partner_form);
  useEffect(() => setV(config.partner_form), [config.partner_form]);
  const m = useSaveSection("partner_form", config.id);
  function patch(k: PartnerFieldKey, patch: Partial<EventPartnerForm["fields"][PartnerFieldKey]>) {
    setV((prev) => ({ fields: { ...prev.fields, [k]: { ...prev.fields[k], ...patch } } }));
  }
  return (
    <Panel title="Partner Registration Form">
      <p className="-mt-2 text-xs text-muted-foreground">
        Control which fields appear on the Partner form for this event, their labels, placeholders, and whether they're required.
      </p>
      <div className="space-y-2">
        {PARTNER_FIELD_KEYS.map((k) => {
          const f = v.fields[k];
          const essential = PARTNER_FIELD_ESSENTIAL.includes(k);
          return (
            <div key={k} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[160px_1fr_1fr_auto_auto] sm:items-center">
              <div>
                <div className="text-sm font-medium capitalize">{k.replace("_", " ")}</div>
                {essential && <div className="text-[10px] text-muted-foreground">Always visible & required</div>}
              </div>
              <Input value={f.label} onChange={(e) => patch(k, { label: e.target.value })} placeholder="Label" />
              <Input value={f.placeholder} onChange={(e) => patch(k, { placeholder: e.target.value })} placeholder="Placeholder" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Visible</span>
                <Switch checked={f.visible} disabled={essential} onCheckedChange={(b) => patch(k, { visible: b })} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Required</span>
                <Switch checked={f.required} disabled={essential} onCheckedChange={(b) => patch(k, { required: b })} />
              </div>
            </div>
          );
        })}
      </div>
      <Button onClick={() => m.mutate(v as unknown as Record<string, unknown>)} disabled={m.isPending}>
        {m.isPending ? "Saving…" : "Save"}
      </Button>
    </Panel>
  );
}

function StatusForm({ config }: { config: EventConfig }) {
  const [v, setV] = useState(config.status);
  useEffect(() => setV(config.status), [config.status]);
  const m = useSaveSection("status", config.id);
  return (
    <Panel title="Event Status">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <Select value={v.value} onValueChange={(val) => setV({ ...v, value: val as EventConfig["status"]["value"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="live">Live Now</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Banner Text (optional)">
          <Input value={v.banner_text} onChange={(e) => setV({ ...v, banner_text: e.target.value })} placeholder="LIVE NOW — Join the event" />
        </Field>
      </div>
      <ToggleRow label="Show status banner on public website" checked={v.show_banner} onChange={(b) => setV({ ...v, show_banner: b })} />
      <Button onClick={() => m.mutate(v as unknown as Record<string, unknown>)} disabled={m.isPending}>
        {m.isPending ? "Saving…" : "Save Status"}
      </Button>
    </Panel>
  );
}


// ---------------- Coverage & Districts ----------------
// Event-first coverage model. Super-Admin only (the whole Event Settings
// tab is super-admin gated). Every save is scoped to config.id — there is no
// global/active-event/default-district state anywhere in this form.
type CoverageType = "single" | "zone" | "state";

const COVERAGE_HINTS: Record<CoverageType, string> = {
  single: "One district participates. The participant's district is fixed to it.",
  zone: "Participants pick their district from exactly the districts selected here.",
  state: "All active districts participate — no manual selection needed.",
};

function CoverageForm({ config }: { config: EventConfig }) {
  const listDistricts = useServerFn(adminListDistricts);
  const { data: districtsData } = useQuery({
    queryKey: ["admin-districts"],
    queryFn: () => listDistricts(),
  });
  const districtOptions =
    ((districtsData?.ok ? districtsData.rows : []) as Array<{
      id: string;
      name: string;
      slug: string;
      is_active: boolean;
    }>) ?? [];

  const coverage = config.coverage ?? { type: "single" as const, district_ids: null };
  const [type, setType] = useState<CoverageType>(coverage.type);
  const [selected, setSelected] = useState<string[]>(() =>
    coverage.type === "zone" && coverage.district_ids
      ? coverage.district_ids
      : coverage.type === "single" && config.district_id
        ? [config.district_id]
        : [],
  );
  // Re-sync local state whenever the server config changes (save → refetch,
  // or switching to another event remounts this component with key=eventId).
  useEffect(() => {
    const c = config.coverage ?? { type: "single" as const, district_ids: null };
    setType(c.type);
    setSelected(
      c.type === "zone" && c.district_ids
        ? c.district_ids
        : c.type === "single" && config.district_id
          ? [config.district_id]
          : [],
    );
  }, [config.coverage, config.district_id]);

  const m = useSaveSection("coverage", config.id);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function save() {
    const hasSelection = type === "state" ? true : selected.length > 0;
    if (!hasSelection) return toast.error("Select at least one district for this coverage type.");
    m.mutate({
      type,
      district_ids: type === "zone" ? selected : type === "single" ? selected : null,
      district_id: type === "single" ? selected[0] : undefined,
    } as unknown as Record<string, unknown>);
  }

  const names = selected
    .map((id) => districtOptions.find((d) => d.id === id)?.name)
    .filter((v): v is string => !!v);
  const hasInactive = selected.some((id) => {
    const d = districtOptions.find((x) => x.id === id);
    return d ? !d.is_active : false;
  });

  return (
    <Panel title="Coverage & Districts">
      <p className="-mt-2 text-xs text-muted-foreground">
        Defines which districts participate in this event. The public registration form and
        server-side validation both use exactly this configuration — nothing global.
      </p>

      <div className="space-y-1.5">
        <Label>Coverage Type</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["single", "zone", "state"] as CoverageType[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setType(c);
                if (c === "state") setSelected([]);
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                type === c
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              {c === "single" ? "Single District" : c === "zone" ? "Zone" : "State-wide"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{COVERAGE_HINTS[type]}</p>
      </div>

      {type !== "state" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>{type === "single" ? "District" : "Districts (select all that apply)"}</Label>
            {type === "zone" && districtOptions.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(districtOptions.map((d) => d.id))}
                >
                  Select All
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setSelected([])}>
                  Clear All
                </Button>
              </div>
            )}
          </div>
          <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
            {districtOptions.length === 0 && (
              <span className="text-xs text-muted-foreground">
                No districts yet. Add them under the Districts tab first.
              </span>
            )}
            {districtOptions.map((d) => {
              const on = selected.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggle(d.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    on
                      ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {on && <Check className="h-3 w-3" />}
                  {d.name}
                  {d.is_active ? "" : " (inactive)"}
                </button>
              );
            })}
          </div>
          {hasInactive && (
            <p className="text-xs text-amber-600">
              Note: some selected districts are inactive — they won't appear on the public form.
            </p>
          )}
        </div>
      )}

      {type === "state" && (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          All active districts are allowed for this event.
        </p>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        {type === "state" ? (
          "Selected districts: All Districts"
        ) : names.length ? (
          <>Selected districts: <span className="font-medium text-foreground">{names.join(", ")}</span></>
        ) : (
          "No districts selected yet."
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={m.isPending}>
          {m.isPending ? "Saving…" : "Save Coverage"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const c = config.coverage ?? { type: "single" as const, district_ids: null };
            setType(c.type);
            setSelected(
              c.type === "zone" && c.district_ids
                ? c.district_ids
                : c.type === "single" && config.district_id
                  ? [config.district_id]
                  : [],
            );
          }}
        >
          Reset
        </Button>
      </div>
    </Panel>
  );
}

function useSaveSection(section: EventSection, id: string) {
  const save = useServerFn(adminUpdateEventSection);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: Record<string, unknown>) =>
      save({ data: { id, section, value } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      toast.success("Saved");
      invalidateEventQueries(qc, id);
    },
  });
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-brand-primary">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label, checked, onChange, hint,
}: { label: string; checked: boolean; onChange: (b: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ---------------- General ----------------
function GeneralForm({ config }: { config: EventConfig }) {
  const [v, setV] = useState(config.general);
  useEffect(() => setV(config.general), [config.general]);
  const m = useSaveSection("general", config.id);
  // Venue is stored in a dedicated column, not inside the general JSONB.
  const [venue, setVenue] = useState<string>((config as { venue?: string | null }).venue ?? "");
  useEffect(() => setVenue((config as { venue?: string | null }).venue ?? ""), [config]);
  const venueSave = useSaveSection("venue", config.id);
  return (
    <Panel title="Event Details">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event Title"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Subtitle"><Input value={v.subtitle} onChange={(e) => setV({ ...v, subtitle: e.target.value })} /></Field>
        <Field label="Theme / Tagline"><Input value={v.theme} onChange={(e) => setV({ ...v, theme: e.target.value })} /></Field>
        <Field label="Banner Image URL"><Input value={v.banner_url} onChange={(e) => setV({ ...v, banner_url: e.target.value })} placeholder="https://..." /></Field>
        <Field label="Venue (शिबिर स्थળ)">
          <Input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Yogagram ground, Junagadh"
            maxLength={300}
          />
        </Field>
        <Field label="Contact Mobile(s)">
          <Input
            value={(v as any).contact_mobile ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              const parts = val.split(/[,/]/).map((s: string) => s.trim()).filter(Boolean);
              setV({ ...v, contact_mobile: val, contact_mobiles: parts } as any);
            }}
            placeholder="e.g. 9826200631 or 9826200631 / 8200607328"
          />
        </Field>
        <Field label="Registration Mode">
          <Select
            value={(v as any).registration_mode || "internal"}
            onValueChange={(val) => setV({ ...v, registration_mode: val } as any)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal (Portal Registration)</SelectItem>
              <SelectItem value="external">External / Closed (e.g. Vadodara)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Expected Participants">
          <Input
            type="number"
            min={0}
            value={(v as any).expected_participants ?? ""}
            onChange={(e) => setV({ ...v, expected_participants: Number(e.target.value) || 0 } as any)}
            placeholder="e.g. 5000"
          />
        </Field>
      </div>
      <Field label="Description"><Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Registration Opens">
          <Input type="datetime-local" value={v.registration_open_at ?? ""} onChange={(e) => setV({ ...v, registration_open_at: e.target.value || null })} />
        </Field>
        <Field label="Registration Closes">
          <Input type="datetime-local" value={v.registration_close_at ?? ""} onChange={(e) => setV({ ...v, registration_close_at: e.target.value || null })} />
        </Field>
        <Field label="Start Date">
          <Input type="date" value={v.event_date ?? ""} onChange={(e) => setV({ ...v, event_date: e.target.value || null })} />
        </Field>
        <Field label="End Date">
          <Input type="date" value={v.end_date ?? ""} onChange={(e) => setV({ ...v, end_date: e.target.value || null })} />
        </Field>
        <Field label="Duration (minutes)">
          <Input type="number" min={0} value={v.duration_minutes} onChange={(e) => setV({ ...v, duration_minutes: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Start Time">
          <Input type="time" value={v.start_time ?? ""} onChange={(e) => setV({ ...v, start_time: e.target.value || null })} />
        </Field>
        <Field label="End Time">
          <Input type="time" value={v.end_time ?? ""} onChange={(e) => setV({ ...v, end_time: e.target.value || null })} />
        </Field>
        <Field label="Speaker Name (optional)"><Input value={v.speaker_name} onChange={(e) => setV({ ...v, speaker_name: e.target.value })} /></Field>
        <Field label="Speaker Designation (optional)"><Input value={v.speaker_designation} onChange={(e) => setV({ ...v, speaker_designation: e.target.value })} /></Field>
      </div>
      <Button onClick={() => {
        m.mutate(v as unknown as Record<string, unknown>);
        venueSave.mutate({ venue });
      }} disabled={m.isPending || venueSave.isPending}>
        {m.isPending || venueSave.isPending ? "Saving…" : "Save"}
      </Button>
    </Panel>
  );
}

// ---------------- Features ----------------
const FEATURE_LABELS: Record<keyof EventConfig["features"], string> = {
  show_details: "Show Event Details",
  registration: "Enable Registration",
  live: "Live Event (unused for physical camps)",
  attendance: "Enable Attendance / Check-In",
  certificate: "Enable Certificate Download",
  referral: "Enable Referral System",
  whatsapp: "Enable WhatsApp Channel",
  social: "Enable Social Media Links",
  countdown: "Enable Countdown Timer",
  footer: "Show Footer",
  embedded_live: "Embedded Player (unused)",
  backup_live: "Backup Stream (unused)",
};

function FeaturesForm({ config }: { config: EventConfig }) {
  const [v, setV] = useState(config.features);
  useEffect(() => setV(config.features), [config.features]);
  const m = useSaveSection("features", config.id);
  return (
    <Panel title="Feature Toggles — changes apply immediately after saving">
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(FEATURE_LABELS) as (keyof EventConfig["features"])[]).map((k) => (
          <ToggleRow
            key={k}
            label={FEATURE_LABELS[k]}
            checked={v[k]}
            onChange={(b) => setV({ ...v, [k]: b })}
          />
        ))}
      </div>
      <Button onClick={() => m.mutate(v as unknown as Record<string, unknown>)} disabled={m.isPending}>
        {m.isPending ? "Saving…" : "Save Toggles"}
      </Button>
    </Panel>
  );
}

// ---------------- Attendance / Check-In ----------------
function AttendanceForm({ config }: { config: EventConfig }) {
  const [v, setV] = useState(config.attendance);
  useEffect(() => setV(config.attendance), [config.attendance]);
  const m = useSaveSection("attendance", config.id);
  return (
    <Panel title="Check-In & Certificate Eligibility Rules">
      <p className="mb-3 text-xs text-muted-foreground">
        Participants check in physically at the venue (QR scan or manual). A checked-in
        participant becomes eligible for the participation certificate when the rule
        below is satisfied.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum check-ins for certificate">
          <Input
            type="number"
            min={1}
            value={v.min_percent}
            onChange={(e) => setV({ ...v, min_percent: Number(e.target.value) || 1 })}
          />
        </Field>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        With one check-in per participant per event, the default of 1 means any
        successful check-in makes the participant certificate-eligible.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ToggleRow
          label="Attendance required for certificate"
          checked={v.enable_tracking}
          onChange={(b) => setV({ ...v, enable_tracking: b })}
        />
      </div>
      <Button onClick={() => m.mutate(v as unknown as Record<string, unknown>)} disabled={m.isPending}>
        {m.isPending ? "Saving…" : "Save Rules"}
      </Button>
    </Panel>
  );
}

// Certificate editing now lives in CertificateDesigner.

// ---------------- Referral ----------------
function ReferralForm({ config }: { config: EventConfig }) {
  const [v, setV] = useState(config.referral);
  useEffect(() => setV(config.referral), [config.referral]);
  const m = useSaveSection("referral", config.id);
  return (
    <Panel title="Referral Settings">
      <ToggleRow label="Enable Referrals" checked={v.enabled} onChange={(b) => setV({ ...v, enabled: b })} />
      <Field label="Share Message Template">
        <Textarea rows={8} value={v.share_template} onChange={(e) => setV({ ...v, share_template: e.target.value })} />
        <div className="text-xs text-muted-foreground">
          Placeholders: <code>{"{{Title}}"}</code> <code>{"{{Theme}}"}</code> <code>{"{{Date}}"}</code> <code>{"{{Time}}"}</code> <code>{"{{Link}}"}</code>
        </div>
      </Field>
      <Button onClick={() => m.mutate(v as unknown as Record<string, unknown>)} disabled={m.isPending}>
        {m.isPending ? "Saving…" : "Save"}
      </Button>
      <Button variant="outline" onClick={() => setV(deepClone(DEFAULT_CONFIG.referral))}>Reset to Default</Button>
    </Panel>
  );
}

// ---------------- WhatsApp ----------------
function WhatsappForm({ config }: { config: EventConfig }) {
  const [v, setV] = useState(config.whatsapp);
  useEffect(() => setV(config.whatsapp), [config.whatsapp]);
  const m = useSaveSection("whatsapp", config.id);
  return (
    <Panel title="WhatsApp Channel">
      <ToggleRow label="Enable WhatsApp CTA" checked={v.enabled} onChange={(b) => setV({ ...v, enabled: b })} />
      <Field label="Channel URL"><Input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://whatsapp.com/channel/..." /></Field>
      <Field label="Button Text"><Input value={v.button_text} onChange={(e) => setV({ ...v, button_text: e.target.value })} /></Field>
      <Button onClick={() => m.mutate(v as unknown as Record<string, unknown>)} disabled={m.isPending}>
        {m.isPending ? "Saving…" : "Save"}
      </Button>
    </Panel>
  );
}

// ---------------- Social ----------------
const SOCIAL_LABELS: Record<SocialPlatformKey, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  telegram: "Telegram",
  whatsapp_channel: "WhatsApp Channel",
  twitter: "Twitter (X)",
  website: "Website",
};

function SocialForm({ config }: { config: EventConfig }) {
  const [v, setV] = useState(config.social);
  useEffect(() => setV(config.social), [config.social]);
  const m = useSaveSection("social", config.id);
  return (
    <Panel title="Social Media Links">
      <div className="space-y-3">
        {(Object.keys(SOCIAL_LABELS) as SocialPlatformKey[]).map((k) => (
          <div key={k} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[160px_1fr_auto] sm:items-center">
            <div className="text-sm font-medium">{SOCIAL_LABELS[k]}</div>
            <Input
              value={v[k].url}
              placeholder="https://..."
              onChange={(e) => setV({ ...v, [k]: { ...v[k], url: e.target.value } })}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Enabled</span>
              <Switch checked={v[k].enabled} onCheckedChange={(b) => setV({ ...v, [k]: { ...v[k], enabled: b } })} />
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => m.mutate(v as unknown as Record<string, unknown>)} disabled={m.isPending}>
        {m.isPending ? "Saving…" : "Save"}
      </Button>
    </Panel>
  );
}
