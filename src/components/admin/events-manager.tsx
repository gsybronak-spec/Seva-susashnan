import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminArchiveEvent,
  adminCreateEvent,
  adminDeleteEvent,
  adminDuplicateEvent,
  adminListEvents,
  adminRestoreEvent,
  adminSetEventPublishStatus,
  adminSetEventStatus,
} from "@/lib/event-admin.functions";
import { adminListDistricts } from "@/lib/district.functions";
import {
  Archive,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { invalidateEventQueries } from "@/lib/query-cache";
import { formatTimeRange } from "@/lib/event-config";
import { matchesAdminEventSearch } from "@/lib/admin-search";


type EventRow = {
  id: string;
  slug: string | null;
  is_active: boolean;
  is_template?: boolean;
  template_category?: string | null;
  lifecycle_status: string;
  publish_status: "draft" | "published" | "archived";
  archived_at: string | null;
  campaign_id?: string | null;
  district: string | null;
  district_id?: string | null;
  coverage_type?: "single" | "zone" | "state";
  coverage_district_names?: string[];
  venue?: string | null;
  general: {
    title?: string;
    subtitle?: string;
    event_date?: string | null;
    end_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    event_time?: string | null;
    registration_open_at?: string | null;
    registration_close_at?: string | null;
    level?: string | null;
    venue?: string | null;
  } | null;
  registration_count?: number;
  created_at: string;
  updated_at: string;
};

type DistrictOption = { id: string; name: string; slug: string; is_active: boolean };

type CoverageType = "single" | "zone" | "state";

const COVERAGE_LABEL: Record<CoverageType, string> = {
  single: "Single District",
  zone: "Zone",
  state: "State-wide",
};

const COVERAGE_HINT: Record<CoverageType, string> = {
  single: "One district participates; the participant's district is fixed to it.",
  zone: "Multiple districts participate; participants pick from exactly these districts.",
  state: "All active districts participate; participants pick from the full district list.",
};

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function regStatus(w: EventRow): { label: string; cls: string } {
  const openAt = w.general?.registration_open_at
    ? new Date(w.general.registration_open_at).getTime()
    : null;
  const closeAt = w.general?.registration_close_at
    ? new Date(w.general.registration_close_at).getTime()
    : null;
  const now = Date.now();
  if (w.publish_status === "archived" || w.lifecycle_status === "archived" || w.lifecycle_status === "cancelled") {
    return { label: "Closed", cls: "bg-destructive/10 text-destructive" };
  }
  if (closeAt != null && Number.isFinite(closeAt) && now > closeAt) {
    return { label: "Closed", cls: "bg-destructive/10 text-destructive" };
  }
  if (openAt != null && Number.isFinite(openAt) && now < openAt) {
    return { label: "Scheduled", cls: "bg-amber-500/10 text-amber-600" };
  }
  return { label: "Open", cls: "bg-brand-success/10 text-brand-success" };
}

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

const PUBLISH_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const PUBLISH_BADGE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  published: "bg-brand-success/10 text-brand-success",
  archived: "bg-destructive/10 text-destructive",
};

export function EventsManager({
  onManageEvent,
  campaignFilterId,
}: {
  onManageEvent?: (id: string, action: "settings" | "form" | "certificates") => void;
  /** When set (drill-down from Admin → Campaigns), show only this campaign's events. */
  campaignFilterId?: string;
}) {
  const list = useServerFn(adminListEvents);
  const create = useServerFn(adminCreateEvent);
  const archive = useServerFn(adminArchiveEvent);
  const remove = useServerFn(adminDeleteEvent);
  const duplicate = useServerFn(adminDuplicateEvent);
  const restore = useServerFn(adminRestoreEvent);
  const setStatus = useServerFn(adminSetEventStatus);
  const setPublish = useServerFn(adminSetEventPublishStatus);


  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => list(),
  });

  const loadFailed = isError || (data !== undefined && !data.ok);
  const allRows = (data?.ok ? (data.rows as unknown as EventRow[]) : []) ?? [];
  const [view, setView] = useState<"events" | "templates">("events");
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "district" | "municipal">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows = allRows.filter(
    (w) =>
      (view === "templates" ? !!w.is_template : !w.is_template) &&
      (!campaignFilterId || w.campaign_id === campaignFilterId),
  );

  const filteredRows = useMemo(() => {
    return rows.filter((w) => {
      // Level filter
      if (levelFilter !== "all") {
        const isMun =
          w.general?.level?.toLowerCase() === "municipal" ||
          (w.general?.title ? w.general.title.includes("મહાનગરપાલિકા") : false);
        if (levelFilter === "municipal" && !isMun) return false;
        if (levelFilter === "district" && isMun) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (w.publish_status !== statusFilter) return false;
      }

      // Search matching
      if (search.trim()) {
        const item = {
          title: w.general?.title,
          district: w.district,
          slug: w.slug,
          level: w.general?.level,
          coverage_type: w.coverage_type,
          coverage_district_names: w.coverage_district_names,
        };
        if (!matchesAdminEventSearch(item, search)) return false;
      }

      return true;
    });
  }, [rows, search, levelFilter, statusFilter]);

  const hasActiveFilters = Boolean(
    search.trim() || levelFilter !== "all" || statusFilter !== "all",
  );

  const [open, setOpen] = useState(false);
  // ---- Stepped creation wizard ----
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverageType, setCoverageType] = useState<CoverageType>("single");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [type, setType] = useState<
    "district" | "state" | "national" | "event" | "training" | "workshop" | "certification"
  >("district");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [regOpen, setRegOpen] = useState("");
  const [regClose, setRegClose] = useState("");
  const [venue, setVenue] = useState("");
  const [templateFrom, setTemplateFrom] = useState<string>("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [templateCategory, setTemplateCategory] = useState("");
  const [creating, setCreating] = useState(false);
  // Hard double-submit guard: two rapid clicks on Create must produce exactly
  // ONE create mutation (state updates are async, so a ref is authoritative).
  const creatingRef = useRef(false);
  // One in-flight row action at a time — prevents double-click duplicates on
  // publish/archive/delete/duplicate/restore/status.
  const [busyRow, setBusyRow] = useState<{ id: string; kind: string } | null>(null);
  // Publish / Archive are staged here and only applied after explicit
  // confirmation — a Select change never mutates on its own.
  const [publishConfirm, setPublishConfirm] = useState<{
    id: string;
    current: string;
    next: string;
  } | null>(null);
  // Result of a completed create — step 5 shows the registration link.
  const [created, setCreated] = useState<{
    id: string;
    slug: string;
    title: string;
    coverageType: CoverageType;
    names: string[];
  } | null>(null);

  const listDistricts = useServerFn(adminListDistricts);
  const { data: districtsData } = useQuery({
    queryKey: ["admin-districts"],
    queryFn: () => listDistricts(),
  });
  const districtOptions = (districtsData?.ok ? (districtsData.rows as DistrictOption[]) : []) ?? [];
  // "State / Entire Region" always means ALL active districts — subsets are
  // Zone events. Everything below that compares selections against this set.
  const activeDistrictOptions = districtOptions.filter((d) => d.is_active);

  function refresh() {
    invalidateEventQueries(qc);
    refetch();
  }

  function resetWizard() {
    setStep(1);
    setTitle(""); setSubtitle(""); setDescription("");
    setCoverageType("single"); setSelectedDistricts([]);
    setType("district");
    setEventDate(""); setEndDate(""); setEventTime(""); setEndTime("");
    setRegOpen(""); setRegClose("");
    setTemplateFrom(""); setIsTemplate(false); setTemplateCategory("");
    setCreated(null);
  }

  const selectedNames = selectedDistricts
    .map((id) => districtOptions.find((d) => d.id === id)?.name)
    .filter((v): v is string => !!v);

  function canNext(): string | null {
    if (step === 1 && title.trim().length < 2) return "Enter a event name.";
    if (step === 3) {
      if (coverageType === "single") {
        if (selectedDistricts.length !== 1) {
          return "A Single District event must have exactly one district selected.";
        }
      } else if (coverageType === "zone") {
        if (selectedDistricts.length === 0) {
          return "Select at least one district for this zone event.";
        }
      } else {
        // state — must cover ALL active districts, never a subset.
        const activeIds = new Set(activeDistrictOptions.map((d) => d.id));
        const activeSelected = selectedDistricts.filter((id) => activeIds.has(id));
        if (activeDistrictOptions.length === 0) {
          return "No active districts available yet. Add districts under the Districts tab first.";
        }
        if (activeSelected.length !== activeDistrictOptions.length) {
          return "A State-wide event must cover ALL active districts. To include only a subset, choose Zone instead.";
        }
      }
    }
    return null;
  }

  async function onCreate() {
    // HARD GUARD: the create mutation may ONLY run from the final review
    // step. District/coverage/date/time changes, Enter keys, autofill, wizard
    // navigation, opening/closing the dialog, and useEffect can never reach
    // this — the button only exists on step 4 and this guard is the backstop.
    if (step !== 4) {
      toast.error("Please complete all steps before creating the event.");
      return;
    }
    const blocked = canNext();
    if (blocked) return toast.error(blocked);
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      // Coverage payload: zone → explicit ids, state → null (all active
      // districts), single → the chosen district drives both the coverage
      // JSONB and the district_id column.
      const coverage =
        coverageType === "zone"
          ? { type: "zone" as const, district_ids: selectedDistricts }
          : coverageType === "state"
            ? { type: "state" as const, district_ids: null }
            : { type: "single" as const, district_ids: null };
      const singleDistrictId = coverageType === "single" ? selectedDistricts[0] : undefined;
      const singleDistrictName = singleDistrictId
        ? districtOptions.find((d) => d.id === singleDistrictId)?.name
        : undefined;
      const res = await create({
        data: {
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          district_id: singleDistrictId,
          district: singleDistrictName,
          district_name: singleDistrictName,
          description: description.trim() || undefined,
          coverage,
          type,
          event_date: eventDate || undefined,
          end_date: endDate || undefined,
          start_time: eventTime || undefined,
          end_time: endTime || undefined,
          registration_open_at: regOpen ? new Date(regOpen).toISOString() : undefined,
          registration_close_at: regClose ? new Date(regClose).toISOString() : undefined,
          venue: venue.trim() || undefined,
          template_from: templateFrom || undefined,
          is_template: isTemplate || undefined,
          template_category: isTemplate && templateCategory.trim() ? templateCategory.trim() : undefined,
          activate: false,
        },
      });
      if (!res.ok) {
        // No false success — keep the user's data and show the real error.
        toast.error(res.error);
        return;
      }
      toast.success("Event created");
      setCreated({
        id: res.id ?? "",
        slug: res.slug ?? "",
        title: title.trim(),
        coverageType,
        names:
          coverageType === "state"
            ? ["All Districts"]
            : selectedNames.length
              ? selectedNames
              : [],
      });
      setStep(5);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create event.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }


  // Publishing (and archiving) MUST be an explicit user action: the Select
  // only stages the request; the confirm dialog applies it.
  function onPublishChange(id: string, value: string) {
    const next = value as "draft" | "published" | "archived";
    const row = allRows.find((w) => w.id === id);
    const current = row?.publish_status ?? "draft";
    if (next === current) return;
    if (next === "published" || next === "archived") {
      setPublishConfirm({ id, current, next });
      return;
    }
    // Moving to draft is non-destructive — apply directly.
    void applyPublish(id, "draft");
  }

  async function applyPublish(id: string, value: "draft" | "published" | "archived") {
    if (busyRow) return;
    setBusyRow({ id, kind: "publish" });
    try {
      const res = await setPublish({ data: { id, publish_status: value } });
      if (!res.ok) return toast.error(res.error);
      toast.success(
        value === "published"
          ? "Event published — visible on the public landing page"
          : value === "archived"
            ? "Event archived — hidden from public"
            : "Moved to draft — hidden from public",
      );
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusyRow(null);
    }
  }


  async function onArchive(id: string) {
    if (busyRow) return;
    if (!confirm("Archive this event? It will no longer appear publicly.")) return;
    setBusyRow({ id, kind: "archive" });
    try {
      const res = await archive({ data: { id } });
      if (!res.ok) return toast.error(res.error);
      toast.success("Event archived");
      refresh();
    } finally {
      setBusyRow(null);
    }
  }

  async function onDelete(id: string) {
    if (busyRow) return;
    if (!confirm("Permanently delete this event? This cannot be undone.")) return;
    setBusyRow({ id, kind: "delete" });
    try {
      const res = await remove({ data: { id } });
      if (!res.ok) return toast.error(res.error);
      toast.success("Event deleted");
      refresh();
    } finally {
      setBusyRow(null);
    }
  }

  async function onDuplicate(id: string) {
    if (busyRow) return;
    setBusyRow({ id, kind: "duplicate" });
    try {
      const res = await duplicate({ data: { id } });
      if (!res.ok) return toast.error(res.error);
      toast.success("Duplicated");
      refresh();
    } finally {
      setBusyRow(null);
    }
  }

  async function onSaveAsTemplate(id: string) {
    if (busyRow) return;
    const category = prompt("Template category (optional):", "") ?? "";
    setBusyRow({ id, kind: "duplicate" });
    try {
      const res = await duplicate({
        data: { id, as_template: true, template_category: category || undefined },
      });
      if (!res.ok) return toast.error(res.error);
      toast.success("Saved as template");
      refresh();
    } finally {
      setBusyRow(null);
    }
  }

  async function onRestore(id: string) {
    if (busyRow) return;
    setBusyRow({ id, kind: "restore" });
    try {
      const res = await restore({ data: { id } });
      if (!res.ok) return toast.error(res.error);
      toast.success("Restored to draft");
      refresh();
    } finally {
      setBusyRow(null);
    }
  }

  async function onStatusChange(id: string, value: string) {
    if (busyRow) return;
    const row = allRows.find((w) => w.id === id);
    if (row?.lifecycle_status === value) return;
    setBusyRow({ id, kind: "status" });
    try {
      const res = await setStatus({
        data: {
          id,
          lifecycle_status: value as "upcoming" | "live" | "completed" | "cancelled" | "archived",
        },
      });
      if (!res.ok) return toast.error(res.error);
      refresh();
    } finally {
      setBusyRow(null);
    }
  }

  // Unsaved-changes guard (L1): warn before leaving/reloading the page while
  // the create wizard holds meaningful unsaved input. Only active while the
  // dialog is open and a step before the completed screen — no nagging when
  // there is nothing to lose.
  useEffect(() => {
    if (!open || step === 5) return;
    const hasInput =
      title.trim().length > 0 ||
      selectedDistricts.length > 0 ||
      !!eventDate ||
      !!endDate ||
      !!eventTime ||
      !!endTime ||
      !!regOpen ||
      !!regClose ||
      description.trim().length > 0;
    if (!hasInput) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, step, title, selectedDistricts, eventDate, endDate, eventTime, endTime, regOpen, regClose, description]);

  // State events automatically select every active district whenever the
  // district step is reached with nothing selected. A partial State selection
  // is still rejected by canNext() on Next/Save — this only guarantees the
  // "State = ALL" starting point.
  useEffect(() => {
    if (step === 3 && coverageType === "state" && selectedDistricts.length === 0) {
      setSelectedDistricts(activeDistrictOptions.map((d) => d.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, coverageType]);

  async function copyLink(slug: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/${slug}/register`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Registration link copied");
    } catch {
      toast.error("Copy failed. Please copy manually.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-primary">
            {view === "templates" ? "Template Library" : "Events"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {view === "templates"
              ? "Reusable blueprints. Duplicate a template to create a new event with all config, notices, certificate templates and broadcasts pre-filled."
              : <>Set publication to <b>Published</b> to make a event appear on the public landing page. <b>Draft</b> and <b>Archived</b> events stay fully accessible here.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView("events")}
              className={`rounded-md px-3 py-1.5 font-medium ${view === "events" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              Events ({allRows.filter((w) => !w.is_template).length})
            </button>
            <button
              type="button"
              onClick={() => setView("templates")}
              className={`rounded-md px-3 py-1.5 font-medium ${view === "templates" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              Templates ({allRows.filter((w) => !!w.is_template).length})
            </button>
          </div>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetWizard();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {step === 5 ? "Event Created" : `New Event — Step ${Math.min(step, 4)} of 4`}
              </DialogTitle>
            </DialogHeader>

            {step === 5 && created ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-brand-success/30 bg-brand-success/5 p-4">
                  <div className="text-sm font-semibold text-brand-success">✓ Event created</div>
                  <p className="mt-1 text-sm text-foreground">{created.title}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {COVERAGE_LABEL[created.coverageType]} ·{" "}
                    {created.names.length ? created.names.join(", ") : "—"} · Status: Draft
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Registration Link (unique to this event)</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/${created.slug}/register`}
                      className="font-mono text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => copyLink(created.slug)}>
                        <Copy className="mr-1.5 h-4 w-4" /> Copy Link
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/${created.slug}/register`} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-4 w-4" /> Open
                        </a>
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This link resolves only to this event — its form, districts, settings and
                    certificate configuration. The event is a <b>Draft</b>: publish it from the
                    Events list to make it visible on the homepage.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Configure the registration form, certificate, live link and more from{" "}
                  <b>Event Settings</b> (select this event in the workspace, then open Event Settings).
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => {
                      setOpen(false);
                      resetWizard();
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              /* No <form> here on purpose: a form would let Enter/autofill
                 implicitly submit and create a event from any step. Steps
                 are plain divs; only the explicit Create button (step 4)
                 invokes onCreate. */
              <div className="space-y-4">
                {/* STEP 1 — name */}
                {step === 1 && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="w-title">Event Name *</Label>
                      <Input
                        id="w-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Mehsana Zone Online Yog Event"
                        required
                        minLength={2}
                        maxLength={200}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="w-sub">Subtitle</Label>
                      <Input
                        id="w-sub"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="e.g. Seva Sushasan Abhiyan"
                        maxLength={300}
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2 — coverage type */}
                {step === 2 && (
                  <div className="space-y-2">
                    <Label>What type of event is this?</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(["single", "zone", "state"] as CoverageType[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCoverageType(c);
                            // State = ALL active districts automatically; a
                            // subset must be created as a Zone event.
                            setSelectedDistricts(
                              c === "state" ? activeDistrictOptions.map((d) => d.id) : [],
                            );
                          }}
                          className={`rounded-lg border p-3 text-left text-sm font-medium transition ${
                            coverageType === c
                              ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                              : "border-border bg-background text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block h-3 w-3 rounded-full border-2 ${
                                coverageType === c ? "border-brand-primary bg-brand-primary" : "border-border"
                              }`}
                            />
                            {COVERAGE_LABEL[c]}
                          </div>
                          <div className="mt-1.5 text-[11px] font-normal text-muted-foreground">
                            {COVERAGE_HINT[c]}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 3 — districts */}
                {step === 3 && (
                  <div className="space-y-3">
                    {coverageType === "single" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="w-cov-single">Select District *</Label>
                        <Select
                          value={selectedDistricts[0] ?? ""}
                          onValueChange={(v) => setSelectedDistricts(v ? [v] : [])}
                        >
                          <SelectTrigger id="w-cov-single">
                            <SelectValue placeholder="Select one district" />
                          </SelectTrigger>
                          <SelectContent>
                            {districtOptions.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                                {d.is_active ? "" : " (inactive)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label>
                            {coverageType === "zone"
                              ? "Select Districts * (select all that apply)"
                              : "All Districts"}
                          </Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setSelectedDistricts(districtOptions.map((d) => d.id))
                              }
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedDistricts([])}
                            >
                              Clear All
                            </Button>
                          </div>
                        </div>
                        {coverageType === "state" && (
                          <p className="text-xs text-muted-foreground">
                            A State-wide event automatically covers{" "}
                            <b>ALL {activeDistrictOptions.length} active districts</b>. Saving
                            with only a subset is not allowed — use <b>Zone</b> if only some
                            districts should participate.
                          </p>
                        )}
                        <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border bg-background p-2">
                          {districtOptions.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              No districts yet. Add them under the Districts tab first.
                            </span>
                          )}
                          {districtOptions.map((d) => {
                            const on = selectedDistricts.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() =>
                                  setSelectedDistricts((prev) =>
                                    on ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                                  )
                                }
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
                        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Selected Districts: {selectedDistricts.length}
                            {coverageType === "state" ? ` of ${activeDistrictOptions.length} active` : ""}
                          </span>
                          {selectedDistricts.length > 0 && (
                            <div className="mt-1">
                              {coverageType === "state" &&
                              selectedDistricts.length === activeDistrictOptions.length
                                ? `All Districts districts (${activeDistrictOptions.length} active)`
                                : selectedNames.join(", ")}
                            </div>
                          )}
                          {coverageType === "state" &&
                            selectedDistricts.length > 0 &&
                            selectedDistricts.length < activeDistrictOptions.length && (
                              <div className="mt-1 font-medium text-amber-600">
                                A State-wide event cannot save with a subset — use Zone for
                                partial coverage.
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 4 — dates, times & advanced */}
                {step === 4 && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Event Schedule</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="w-date">Start Date</Label>
                          <Input id="w-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="w-end-date">End Date (optional)</Label>
                          <Input id="w-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="w-time">Start Time</Label>
                          <Input id="w-time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="w-end-time">End Time</Label>
                          <Input id="w-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="w-reg-open">Registration Opens</Label>
                          <Input id="w-reg-open" type="datetime-local" value={regOpen} onChange={(e) => setRegOpen(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="w-reg-close">Registration Closes</Label>
                          <Input id="w-reg-close" type="datetime-local" value={regClose} onChange={(e) => setRegClose(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="w-desc">Description</Label>
                      <Input id="w-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="Short public description of this event" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="w-type">Event Type</Label>
                        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                          <SelectTrigger id="w-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="district">District</SelectItem>
                            <SelectItem value="state">State</SelectItem>
                            <SelectItem value="national">National</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                            <SelectItem value="training">Training</SelectItem>
                            <SelectItem value="workshop">Workshop</SelectItem>
                            <SelectItem value="certification">Certification</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="w-venue">Venue (शिबिर स्थळ)</Label>
                        <Input id="w-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Pragati Maidan, Junagadh" maxLength={300} />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="w-tmpl">Clone from template (optional)</Label>
                        <Select value={templateFrom || "__default"} onValueChange={(v) => setTemplateFrom(v === "__default" ? "" : v)}>
                          <SelectTrigger id="w-tmpl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default">Blank (no template)</SelectItem>
                            {rows.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.general?.title ?? w.slug ?? w.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Cloning is explicit: the new event gets its own copies — never shared
                          configuration — and your coverage/district choices above always win.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} className="h-4 w-4" />
                        Save as reusable template
                      </label>
                      {isTemplate && (
                        <div className="space-y-1.5">
                          <Label htmlFor="w-tcat">Template Category</Label>
                          <Input id="w-tcat" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} placeholder="e.g. District, State event, Training" maxLength={80} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <DialogFooter className="flex items-center justify-between gap-2 sm:justify-end">
                  <div className="flex gap-2">
                    {step > 1 && (
                      <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                        <ChevronLeft className="mr-1 h-4 w-4" /> Back
                      </Button>
                    )}
                    {step < 4 ? (
                      <Button
                        type="button"
                        onClick={() => {
                          const blocked = canNext();
                          if (blocked) return toast.error(blocked);
                          setStep((s) => s + 1);
                        }}
                      >
                        Next <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => void onCreate()}
                        disabled={creating}
                      >
                        {creating ? "Creating..." : "Create Event"}
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">
            Unable to load events. Please refresh.
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
      <>
      {/* Prominent Search and Filter Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search Input with Search Icon & Clear (X) Button */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="જિલ્લો અથવા કાર્યક્રમ શોધો... / Search district or event..."
              className="h-11 pl-10 pr-10 text-sm bg-background border-border rounded-xl focus-visible:ring-brand-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-36 sm:w-40">
              <Select
                value={levelFilter}
                onValueChange={(v) => setLevelFilter(v as typeof levelFilter)}
              >
                <SelectTrigger className="h-11 rounded-xl text-xs">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels / બધા સ્તર</SelectItem>
                  <SelectItem value="district">District / જિલ્લા</SelectItem>
                  <SelectItem value="municipal">Municipal / મનપા</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-36 sm:w-40">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 rounded-xl text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status / બધી સ્થિતિ</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setLevelFilter("all");
                  setStatusFilter("all");
                }}
                className="h-11 px-3 text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Result Indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div>
            {hasActiveFilters ? (
              <span>
                {rows.length} કાર્યક્રમોમાંથી{" "}
                <strong className="text-brand-primary font-bold">{filteredRows.length}</strong> પરિણામ
              </span>
            ) : (
              <span>
                કુલ <strong className="text-foreground font-bold">{rows.length}</strong> કાર્યક્રમો
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Real-time filter active
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Event</th>
              <th className="p-3">Type</th>
              <th className="p-3">Districts</th>
              <th className="p-3">Dates</th>
              <th className="p-3">Time</th>
              <th className="p-3">Regs</th>
              <th className="p-3">Reg. Status</th>
              <th className="p-3">Stage</th>
              <th className="p-3">Publication</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                  {isLoading ? (
                    "Loading…"
                  ) : hasActiveFilters ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">કોઈ કાર્યક્રમ મળ્યો નથી</p>
                      <p className="text-xs">તમારી શોધ ફરી તપાસો.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearch("");
                          setLevelFilter("all");
                          setStatusFilter("all");
                        }}
                        className="mt-2 text-xs"
                      >
                        Clear Filters &amp; Search
                      </Button>
                    </div>
                  ) : view === "templates" ? (
                    "No templates yet."
                  ) : (
                    "No events yet. Create your first one."
                  )}
                </td>
              </tr>
            )}
            {filteredRows.map((w) => {
              const rs = regStatus(w);
              return (
              <tr key={w.id} className="border-t border-border align-top">
                <td className="p-3">
                  <div className="font-medium text-foreground">
                    {w.general?.title ?? "(untitled)"}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">/{w.slug}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {w.general?.subtitle && <span>{w.general.subtitle}</span>}
                    {w.is_template && (
                      <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-primary">
                        TEMPLATE{w.template_category ? ` · ${w.template_category}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Created {formatDateShort(w.created_at)}
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-xs font-semibold uppercase text-brand-primary">
                    {w.coverage_type === "state" ? "State" : w.coverage_type === "zone" ? "Zone" : "District"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="max-w-[260px] text-xs text-muted-foreground">
                    {w.coverage_type === "state"
                      ? "All Districts"
                      : (w.coverage_district_names ?? []).join(", ") || (w.district ?? "—")}
                  </div>
                </td>
                <td className="p-3 text-xs">
                  {w.general?.event_date ? formatDateShort(w.general.event_date) : "Yet to be Declared"}
                  {w.general?.end_date ? ` – ${formatDateShort(w.general.end_date)}` : ""}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {w.general?.event_time ||
                     formatTimeRange(w.general?.start_time, w.general?.end_time) ||
                     "Yet to be Declared"}
                  </span>
                </td>
                <td className="p-3 font-semibold text-brand-primary">{w.registration_count ?? 0}</td>
                <td className="p-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${rs.cls}`}>
                    {rs.label}
                  </span>
                </td>
                <td className="p-3">
                  <Select value={w.lifecycle_status} onValueChange={(v) => onStatusChange(w.id, v)} disabled={busyRow?.id === w.id}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PUBLISH_BADGE[w.publish_status] ?? PUBLISH_BADGE.draft}`}>
                      {w.publish_status}
                    </span>
                    <Select value={w.publish_status} onValueChange={(v) => onPublishChange(w.id, v)} disabled={busyRow?.id === w.id}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PUBLISH_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {w.slug && (
                      <Button size="icon" variant="ghost" title="Open public registration page" asChild>
                        <a href={`/${w.slug}/register`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {w.slug && (
                      <Button size="icon" variant="ghost" title="Copy registration link" onClick={() => w.slug && copyLink(w.slug)} disabled={busyRow?.id === w.id}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                    {onManageEvent && !w.is_template && (
                      <>
                        <Button size="icon" variant="ghost" title="Event Settings" onClick={() => onManageEvent(w.id, "settings")} disabled={busyRow?.id === w.id}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Form Builder" onClick={() => onManageEvent(w.id, "form")} disabled={busyRow?.id === w.id}>
                          <ListChecks className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Certificates" onClick={() => onManageEvent(w.id, "certificates")} disabled={busyRow?.id === w.id}>
                          <Award className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" title="Duplicate" onClick={() => onDuplicate(w.id)} disabled={busyRow?.id === w.id}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!w.is_template && (
                      <Button size="icon" variant="ghost" title="Save as template" onClick={() => onSaveAsTemplate(w.id)} disabled={busyRow?.id === w.id}>
                        <Save className="h-4 w-4" />
                      </Button>
                    )}
                    {w.publish_status === "archived" ? (
                      <Button size="icon" variant="ghost" title="Restore" onClick={() => onRestore(w.id)} disabled={busyRow?.id === w.id}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" title="Archive" onClick={() => onArchive(w.id)} disabled={busyRow?.id === w.id}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Delete" onClick={() => onDelete(w.id)} disabled={busyRow?.id === w.id}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      {publishConfirm && (
        <Dialog
          open={!!publishConfirm}
          onOpenChange={(v) => !v && setPublishConfirm(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {publishConfirm.next === "published"
                  ? "Publish Event?"
                  : "Archive Event?"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {publishConfirm.next === "published"
                ? "This event will become visible on the public landing page and its registration link will go live immediately."
                : "This event will be hidden from the public landing page and marked archived."}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const p = publishConfirm;
                  setPublishConfirm(null);
                  void applyPublish(p.id, p.next as "draft" | "published" | "archived");
                }}
              >
                {publishConfirm.next === "published" ? "Publish" : "Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
