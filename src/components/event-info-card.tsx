import { useEffect, useState } from "react";
import { CalendarDays, Clock, Sparkles, User } from "lucide-react";
import {
  formatTimeRange,
  formatEventDate,
  type EventConfig,
} from "@/lib/event-config";

function eventStart(cfg: EventConfig): Date | null {
  const { event_date, start_time } = cfg.general;
  if (!event_date) return null;
  const d = new Date(`${event_date}T${start_time ?? "00:00"}:00`);
  return isNaN(d.getTime()) ? null : d;
}

function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  const box =
    "flex flex-col items-center rounded-lg border border-border bg-card px-3 py-2 shadow-sm min-w-[64px]";
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
      {[
        ["Days", days],
        ["Hours", hours],
        ["Minutes", mins],
        ["Seconds", secs],
      ].map(([label, val]) => (
        <div key={label as string} className={box}>
          <div className="font-mono text-xl font-bold text-brand-primary tabular-nums">
            {String(val).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventInfoCard({ config }: { config: EventConfig }) {
  if (!config.features.show_details) return null;
  const { general, features } = config;
  const start = eventStart(config);
  const dateStr = formatEventDate(general.event_date);
  const timeStr = formatTimeRange(general.start_time, general.end_time);

  return (
    <section className="mx-auto max-w-6xl px-4 py-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="brand-bar h-1 w-full" />
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-2xl font-bold text-brand-primary sm:text-3xl">
              {general.title}
            </h2>
            {general.theme && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent">
                <Sparkles className="h-4 w-4" />
                {general.theme}
              </div>
            )}
            {general.description && (
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                {general.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {dateStr && (
                <div className="inline-flex items-center gap-1.5 text-foreground">
                  <CalendarDays className="h-4 w-4 text-brand-primary" />
                  {dateStr}
                </div>
              )}
              {timeStr && (
                <div className="inline-flex items-center gap-1.5 text-foreground">
                  <Clock className="h-4 w-4 text-brand-primary" />
                  {timeStr}
                  {general.duration_minutes ? ` · ${general.duration_minutes} min` : ""}
                </div>
              )}
              {general.speaker_name && (
                <div className="inline-flex items-center gap-1.5 text-foreground">
                  <User className="h-4 w-4 text-brand-primary" />
                  {general.speaker_name}
                  {general.speaker_designation ? `, ${general.speaker_designation}` : ""}
                </div>
              )}
            </div>
          </div>
          {features.countdown && start && start.getTime() > Date.now() && (
            <div className="md:border-l md:border-border md:pl-6">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Starts in
              </div>
              <Countdown target={start} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
