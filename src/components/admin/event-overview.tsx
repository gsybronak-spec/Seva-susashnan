import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminEventOverview } from "@/lib/organisation.functions";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award, Building2, CalendarDays, Layers, Radio, Users } from "lucide-react";

type OverviewRow = {
  id: string;
  slug: string;
  is_active: boolean;
  lifecycle_status: string;
  publish_status: "draft" | "published" | "archived";
  title: string;
  district: string | null;
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

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading events…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No events available.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onOpen(r.id)}
              className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-brand-primary hover:shadow-md"
            >
              <div className="mb-2 flex w-full items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs text-brand-primary">
                  <Building2 className="h-3.5 w-3.5" />
                  {r.district || r.slug}
                </div>
                <div className="flex items-center gap-1">
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

              <div className="text-base font-semibold text-foreground group-hover:text-brand-primary">
                {r.title || r.slug}
              </div>
              {r.event_date && (
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(r.event_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
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
          ))}
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
