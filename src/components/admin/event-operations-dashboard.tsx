import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  ExternalLink,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  Activity,
  Award,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminCreateScanner,
  adminEventOverview,
  adminExportEvent,
  adminManualCheckIn,
  adminSearchParticipants,
  adminSetScannerStatus,
} from "@/lib/event-engine.functions";

interface EventOperationsDashboardProps {
  eventId: string;
}

export function EventOperationsDashboard({ eventId }: EventOperationsDashboardProps) {
  const overviewFn = useServerFn(adminEventOverview);
  const exportFn = useServerFn(adminExportEvent);
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ["event-operations", eventId],
    queryFn: () => overviewFn({ data: { event_id: eventId } }),
    enabled: !!eventId,
    refetchInterval: 15000, // auto-refresh every 15s during live event
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["event-operations", eventId] });

  async function exportCsv() {
    toast.info("Preparing event export...");
    const result = await exportFn({ data: { event_id: eventId } });
    if (!result.ok) return toast.error(result.error);

    const headers = [
      "Participant ID",
      "Name",
      "Mobile",
      "District",
      "Taluka",
      "Category / Role",
      "Attended",
      "Check-in Method",
      "Check-in Time",
      "Registered At",
    ];

    const rows = result.rows.map((r: any) => {
      const f = r.custom_fields ?? {};
      return [
        r.registration_number,
        r.full_name,
        r.mobile,
        r.district || f.district || "",
        r.taluka || f.taluka || f.rural_taluka || "",
        r.designation || f.participant_type || "",
        r.attended ? "Yes" : "No",
        r.check_in_method || "",
        r.check_in_time || "",
        r.created_at || "",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `event-${eventId}-attendance.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Export downloaded.");
  }

  const stats = data?.ok ? data.stats : null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F3E3E] tracking-tight">
            Event Operations & Attendance
          </h2>
          <p className="text-xs sm:text-sm text-[#5C7065] mt-1">
            Real-time registration statistics, venue QR check-in, operator scanner credentials, and exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="border-[#E8E0D5] text-[#0F3E3E] h-10 gap-2">
            <a href={`/admin/checkin?event=${eventId}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" />
              <span>Open Scanner</span>
            </a>
          </Button>

          <Button
            onClick={exportCsv}
            disabled={isFetching}
            className="bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white h-10 gap-2 font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <MetricCard label="Registered" value={stats?.registered ?? 0} icon={Users} color="text-blue-600" />
        <MetricCard label="ID Passes Issued" value={stats?.id_cards ?? 0} icon={ShieldCheck} color="text-[#D97706]" />
        <MetricCard label="Checked In" value={stats?.checked_in ?? 0} icon={CheckCircle2} color="text-emerald-600" />
        <MetricCard label="Pending" value={stats?.pending ?? 0} icon={Activity} color="text-stone-500" />
        <MetricCard label="Attendance Rate" value={`${stats?.attendance_pct ?? 0}%`} icon={Award} color="text-purple-600" />
        <MetricCard label="QR Scans" value={stats?.qr ?? 0} icon={QrCode} color="text-teal-600" />
        <MetricCard label="Manual Check-ins" value={stats?.manual ?? 0} icon={UserCheck} color="text-indigo-600" />
        <MetricCard label="Duplicates Prevented" value={stats?.duplicate_attempts ?? 0} icon={AlertTriangle} color="text-amber-600" />
        <MetricCard label="Certificates Eligible" value={stats?.certificate_eligible ?? 0} icon={Award} color="text-emerald-700" />
        <MetricCard label="Cert Downloads" value={stats?.certificate_downloads ?? 0} icon={Download} color="text-stone-700" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="bg-white border border-[#E8E0D5] p-1 rounded-xl">
          <TabsTrigger value="attendance" className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#0F3E3E] data-[state=active]:text-white">
            Live Attendance
          </TabsTrigger>
          <TabsTrigger value="scanners" className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#0F3E3E] data-[state=active]:text-white">
            Scanner Management
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#0F3E3E] data-[state=active]:text-white">
            Category Breakdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <ManualCheckIn eventId={eventId} onDone={refresh} />
          <LatestCheckIns rows={data?.ok ? data.latest : []} />
        </TabsContent>

        <TabsContent value="scanners" className="space-y-4">
          <ScannerManagement eventId={eventId} scanners={data?.ok ? data.scanners : []} onDone={refresh} />
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <BreakdownSection stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white border border-[#E8E0D5] shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase text-[#64748B]">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-xl sm:text-2xl font-bold text-[#0F3E3E] mt-2">{value}</p>
    </div>
  );
}

function ManualCheckIn({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const searchFn = useServerFn(adminSearchParticipants);
  const checkIn = useServerFn(adminManualCheckIn);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    const res = await searchFn({ data: { event_id: eventId, query: query.trim() } });
    setBusy(false);
    if (res.ok) setRows(res.rows);
    else toast.error(res.error);
  }

  async function handleMark(id: string) {
    const res = await checkIn({ data: { event_id: eventId, registration_id: id } });
    if (!res.ok) return toast.error(res.error);
    toast[res.state === "duplicate" ? "warning" : "success"](
      res.state === "duplicate" ? "Attendance already recorded" : "Check-in marked successfully",
    );
    onDone();
  }

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-[#0F3E3E]">Manual Gate Check-In</h3>
        <p className="text-xs text-[#5C7065]">Quick search by participant name, mobile, or registration number.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, mobile or ID..."
          className="h-10 text-xs border-[#E8E0D5]"
          minLength={2}
          required
        />
        <Button type="submit" disabled={busy} className="h-10 bg-[#0F3E3E] text-white">
          <Search className="w-4 h-4" />
        </Button>
      </form>

      {rows.length > 0 && (
        <div className="divide-y divide-[#E8E0D5] border-t border-[#E8E0D5] pt-2 max-h-60 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-xs font-bold text-[#1C2623]">{r.full_name}</p>
                <p className="text-[11px] font-mono text-[#64748B]">
                  {r.registration_number} &bull; {r.mobile}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleMark(r.id)}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Check In</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LatestCheckIns({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-2xl bg-white border border-[#E8E0D5] shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[#E8E0D5] bg-[#FAF8F5]">
        <h3 className="text-sm font-bold text-[#0F3E3E]">Latest Venue Check-Ins</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E8E0D5] text-left text-[#64748B] bg-stone-50/50">
              <th className="p-3 font-semibold">Participant</th>
              <th className="p-3 font-semibold">Mobile</th>
              <th className="p-3 font-semibold">Method</th>
              <th className="p-3 font-semibold">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E0D5]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="p-3">
                  <p className="font-bold text-[#1C2623]">{r.full_name}</p>
                  <p className="font-mono text-[10px] text-[#64748B]">{r.registration_number}</p>
                </td>
                <td className="p-3 font-mono text-[#5C7065]">{r.mobile}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      r.check_in_method === "qr"
                        ? "bg-teal-100 text-teal-800"
                        : "bg-indigo-100 text-indigo-800"
                    }`}
                  >
                    {r.check_in_method}
                  </span>
                </td>
                <td className="p-3 text-[#5C7065]">
                  {r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString("en-IN") : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-stone-400">
                  No attendance records recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScannerManagement({
  eventId,
  scanners,
  onDone,
}: {
  eventId: string;
  scanners: any[];
  onDone: () => void;
}) {
  const create = useServerFn(adminCreateScanner);
  const update = useServerFn(adminSetScannerStatus);
  const [name, setName] = useState("");
  const [operator, setOperator] = useState("");
  const [issuedKey, setIssuedKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await create({
      data: { event_id: eventId, scanner_name: name.trim(), operator_name: operator.trim() },
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setIssuedKey(res.access_key);
    setName("");
    setOperator("");
    onDone();
  }

  async function handleStatus(scannerId: string, action: "activate" | "deactivate" | "revoke") {
    const res = await update({ data: { event_id: eventId, scanner_id: scannerId, action } });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Scanner ${action}d`);
      onDone();
    }
  }

  return (
    <div className="space-y-4">
      {/* Create Scanner Form */}
      <form
        onSubmit={handleAdd}
        className="p-5 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm grid gap-3 sm:grid-cols-3 items-end"
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-[#0F3E3E]">Scanner / Gate Name</Label>
          <Input
            placeholder="e.g. Gate 1 Main Entrance"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 text-xs border-[#E8E0D5]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-[#0F3E3E]">Operator Name</Label>
          <Input
            placeholder="e.g. Volunteer Ramesh"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="h-10 text-xs border-[#E8E0D5]"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="h-10 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-semibold text-xs gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Issue Scanner Access</span>
        </Button>
      </form>

      {/* Show Issued Key once */}
      {issuedKey && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
          <p className="text-xs font-bold">
            ⚠ Copy this scanner access key now. It will not be displayed again:
          </p>
          <code className="block p-3 rounded-lg bg-white border border-amber-200 font-mono text-xs select-all break-all text-[#0F3E3E]">
            {issuedKey}
          </code>
        </div>
      )}

      {/* Scanners List */}
      <div className="space-y-2">
        {scanners.map((s) => (
          <div
            key={s.id}
            className="p-4 rounded-xl bg-white border border-[#E8E0D5] shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div>
              <div className="flex items-center gap-2 font-bold text-[#0F3E3E]">
                <QrCode className="w-4 h-4 text-[#D97706]" />
                <span>{s.scanner_name}</span>
                <span className="font-mono text-[10px] text-stone-400">({s.scanner_code})</span>
              </div>
              <p className="text-[#5C7065] mt-0.5">
                Operator: {s.operator_name} &bull;{" "}
                <span className={s.revoked_at ? "text-rose-600 font-bold" : s.is_active ? "text-emerald-600 font-bold" : "text-stone-500"}>
                  {s.revoked_at ? "Revoked" : s.is_active ? "Active" : "Inactive"}
                </span>
              </p>
              <p className="text-[10px] text-stone-400 mt-1">
                Total Scans: {s.total_scans} &bull; Duplicates: {s.duplicate_attempts}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!s.revoked_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatus(s.id, s.is_active ? "deactivate" : "activate")}
                  className="h-8 text-xs border-[#E8E0D5]"
                >
                  {s.is_active ? "Deactivate" : "Activate"}
                </Button>
              )}
              {!s.revoked_at && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStatus(s.id, "revoke")}
                  className="h-8 text-xs"
                >
                  Revoke
                </Button>
              )}
            </div>
          </div>
        ))}
        {scanners.length === 0 && (
          <div className="p-8 text-center rounded-2xl bg-white border border-[#E8E0D5] text-stone-400 text-xs">
            No scanner operators created yet for this event.
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownSection({ stats }: { stats: any }) {
  const byType: Array<{ type: string; registered: number; attended: number }> = stats?.by_type ?? [];
  const byZone: Array<{ zone: string; registered: number; attended: number }> = stats?.by_zone ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-5 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase text-[#64748B]">By Participant Type / Role</h4>
        <div className="divide-y divide-[#E8E0D5]">
          {byType.map((item) => (
            <div key={item.type} className="py-2.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0F3E3E]">{item.type}</span>
              <div className="flex gap-4 text-[#5C7065]">
                <span>Registered: <strong className="text-[#0F3E3E]">{item.registered}</strong></span>
                <span>Attended: <strong className="text-emerald-700">{item.attended}</strong></span>
              </div>
            </div>
          ))}
          {byType.length === 0 && <p className="text-xs text-stone-400 py-3">No registrations.</p>}
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase text-[#64748B]">By Location / Zone</h4>
        <div className="divide-y divide-[#E8E0D5]">
          {byZone.map((item) => (
            <div key={item.zone} className="py-2.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0F3E3E]">{item.zone}</span>
              <div className="flex gap-4 text-[#5C7065]">
                <span>Registered: <strong className="text-[#0F3E3E]">{item.registered}</strong></span>
                <span>Attended: <strong className="text-emerald-700">{item.attended}</strong></span>
              </div>
            </div>
          ))}
          {byZone.length === 0 && <p className="text-xs text-stone-400 py-3">No registrations.</p>}
        </div>
      </div>
    </div>
  );
}
