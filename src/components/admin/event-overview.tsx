import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminEventOverview } from "@/lib/organisation.functions";
import { sortAdminEventsChronological } from "@/lib/event-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  Layers,
  Radio,
  Search,
  Users,
  X,
} from "lucide-react";
import { matchesAdminEventSearch } from "@/lib/admin-search";

type OverviewRow = {
  id: string;
  slug: string;
  is_active: boolean;
  lifecycle_status: string;
  publish_status: "draft" | "published" | "archived";
  title: string;
  district: string | null;
  district_name?: string | null;
  level?: string | null;
  venue?: string | null;
  event_date: string | null;
  registrations: number;
  today: number;
  joined_live: number;
  certificates_issued: number;
  partners: number;
  organisations: number;
};

const PUB_BADGE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  published: "bg-brand-success/10 text-brand-success",
  archived: "bg-destructive/10 text-destructive",
};


export function EventOverview({
  isSuper,
  onOpen,
}: {
  isSuper: boolean;
  onOpen: (eventId: string | "all") => void;
}) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "district" | "municipal">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useServerFn(adminEventOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-event-overview"],
    queryFn: () => load(),
    refetchInterval: 30_000,
  });
  const rows = (data?.ok ? (data.rows as OverviewRow[]) : []) ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.registrations += r.registrations || 0;
      acc.joined_live += r.joined_live || 0;
      acc.certificates_issued += r.certificates_issued || 0;
      acc.partners += r.partners || 0;
      return acc;
    },
    { registrations: 0, joined_live: 0, certificates_issued: 0, partners: 0 },
  );

  const filteredRows = useMemo(() => {
    const list = rows.filter((r) => {
      // Exclude vadodara-yog-shibir from admin overview
      if (r.slug === "vadodara-yog-shibir") return false;

      // Level filter
      if (levelFilter !== "all") {
        const isMun =
          r.level?.toLowerCase() === "municipal" ||
          (r.title ? r.title.includes("મહાનગરપાલિકા") : false);
        if (levelFilter === "municipal" && !isMun) return false;
        if (levelFilter === "district" && isMun) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (r.publish_status !== statusFilter) return false;
      }

      // Search matching
      if (search.trim()) {
        if (!matchesAdminEventSearch(r, search)) return false;
      }

      return true;
    });

    return sortAdminEventsChronological(list);
  }, [rows, search, levelFilter, statusFilter]);

  const hasActiveFilters = Boolean(
    search.trim() || levelFilter !== "all" || statusFilter !== "all",
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Event Overview</h2>
        <p className="text-sm text-muted-foreground">
          Open a event to manage its registrations, live dashboard, partners, and certificates.
        </p>
      </div>

      {isSuper && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-accent/40 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">All events combined</div>
              <div className="text-xs text-muted-foreground">
                {totals.registrations.toLocaleString("en-IN")} registrations · {totals.joined_live.toLocaleString("en-IN")} joined live · {totals.certificates_issued.toLocaleString("en-IN")} certificates · {totals.partners} partners
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => onOpen("all")}>
            Open combined view <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Prominent Search & Filter Bar */}
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

          {/* Filters & Actions */}
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

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading events…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No events available.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">કોઈ કાર્યક્રમ મળ્યો નથી</h3>
          <p className="text-xs text-muted-foreground">તમારી શોધ ફરી તપાસો.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setLevelFilter("all");
              setStatusFilter("all");
            }}
            className="mt-2 text-xs rounded-xl"
          >
            Clear Filters &amp; Search (બધા કાર્યક્રમો જુઓ)
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((r) => {
            const isMun =
              r.level?.toLowerCase() === "municipal" ||
              (r.title ? r.title.includes("મહાનગરપાલિકા") : false);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r.id)}
                className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"
              >
                <div className="mb-2 flex w-full items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs text-brand-primary font-medium">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{r.district || r.district_name || r.slug}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        isMun ? "bg-amber-500/10 text-amber-700" : "bg-blue-500/10 text-blue-700"
                      }`}
                    >
                      {isMun ? "Municipal" : "District"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PUB_BADGE[r.publish_status] ?? PUB_BADGE.draft}`}
                    >
                      {r.publish_status}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {r.lifecycle_status}
                    </span>
                  </div>
                </div>

                <div className="text-base font-semibold text-foreground group-hover:text-brand-primary line-clamp-2">
                  {r.title || r.slug}
                </div>
                {r.event_date && /^\d{4}-\d{2}-\d{2}$/.test(r.event_date) ? (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(r.event_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                ) : (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md">
                    <CalendarDays className="h-3 w-3" />
                    Yet to be Declared
                  </div>
                )}
                <div className="mt-4 grid w-full grid-cols-2 gap-2 text-xs">
                  <Stat label="Registrations" value={r.registrations} icon={<Users className="h-3 w-3" />} />
                  <Stat label="Today" value={r.today} />
                  <Stat label="Joined Live" value={r.joined_live} icon={<Radio className="h-3 w-3" />} />
                  <Stat label="Certificates" value={r.certificates_issued} icon={<Award className="h-3 w-3" />} />
                </div>
                <div className="mt-3 inline-flex items-center text-xs font-medium text-brand-primary">
                  Open workspace <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{(value ?? 0).toLocaleString("en-IN")}</div>
    </div>
  );
}
