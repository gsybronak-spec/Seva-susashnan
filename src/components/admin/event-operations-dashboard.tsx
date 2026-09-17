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
  Copy,
  Key,
  Lock,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminCreateScannerOperator,
  adminEventOverview,
  adminExportEvent,
  adminManualCheckIn,
  adminSearchParticipants,
  adminUpdateScannerOperator,
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
            Real-time venue check-in monitoring, dedicated operator console links, and operator management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(() => {
            const eventSlug = (data?.ok && (data as any).event?.slug) || "";
            const scannerPath = eventSlug ? `/${eventSlug}/scan` : `/admin/checkin?event=${eventId}`;
            return (
              <>
                <Button
                  asChild
                  className="bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white h-10 gap-2 font-semibold shadow-xs"
                >
                  <a href={scannerPath} target="_blank" rel="noopener noreferrer">
                    <QrCode className="w-4 h-4 text-[#F59E0B]" />
                    <span>Open Operator Scanner</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                </Button>

                {eventSlug && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const fullUrl = `${window.location.origin}/${eventSlug}/scan`;
                      navigator.clipboard.writeText(fullUrl);
                      toast.success("ઓપરેટર સ્કેનર લિંક કોપી થઈ ગઈ!");
                    }}
                    className="h-10 gap-1.5 text-xs font-semibold border-[#E8E0D5]"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#0F3E3E]" />
                    <span>Copy Scanner Link</span>
                  </Button>
                )}
              </>
            );
          })()}

          <Button
            onClick={exportCsv}
            disabled={isFetching}
            variant="outline"
            className="h-10 gap-1.5 font-semibold text-xs border-[#E8E0D5]"
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
          <ScannerManagement
            eventId={eventId}
            eventSlug={(data?.ok && (data as any).event?.slug) || ""}
            scanners={data?.ok ? data.scanners : []}
            onDone={refresh}
          />
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
  eventSlug,
  scanners,
  onDone,
}: {
  eventId: string;
  eventSlug: string;
  scanners: any[];
  onDone: () => void;
}) {
  const createOperator = useServerFn(adminCreateScannerOperator);
  const updateOperator = useServerFn(adminUpdateScannerOperator);

  const [name, setName] = useState("");
  const [operator, setOperator] = useState("");
  const [mobile, setMobile] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Success dialog state for newly issued credentials
  const [newCreds, setNewCreds] = useState<{
    scannerCode: string;
    operatorName: string;
    mobile?: string;
    password?: string;
    loginUrl: string;
  } | null>(null);

  // Reset password state
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !operator.trim() || !password) return;
    setBusy(true);

    const loginUrl = `${window.location.origin}/${eventSlug || eventId}/scan`;

    const res = await createOperator({
      data: {
        event_id: eventId,
        scanner_name: name.trim(),
        operator_name: operator.trim(),
        mobile: mobile.trim() || undefined,
        username: username.trim() || undefined,
        password: password.trim(),
      },
    });

    setBusy(false);
    if (!res.ok) {
      return toast.error(res.error);
    }

    setNewCreds({
      scannerCode: res.scanner_code,
      operatorName: operator.trim(),
      mobile: mobile.trim() || undefined,
      password: password.trim(),
      loginUrl,
    });

    setName("");
    setOperator("");
    setMobile("");
    setUsername("");
    setPassword("");
    toast.success("સ્કેનર ઓપરેટર સફળતાપૂર્વક બનાવવામાં આવ્યા!");
    onDone();
  }

  async function handleStatus(scannerId: string, action: "activate" | "deactivate" | "revoke") {
    const res = await updateOperator({
      data: { event_id: eventId, scanner_id: scannerId, action },
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`ઓપરેટર સ્થિતિ અપડેટ થઈ: ${action}`);
      onDone();
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingId || !newPwd.trim()) return;
    setPwdBusy(true);
    const res = await updateOperator({
      data: { event_id: eventId, scanner_id: resettingId, password: newPwd.trim() },
    });
    setPwdBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("ઓપરેટર પાસવર્ડ બદલાઈ ગયો!");
      setResettingId(null);
      setNewPwd("");
      onDone();
    }
  }

  return (
    <div className="space-y-5">
      {/* Create Scanner Form */}
      <form
        onSubmit={handleAdd}
        className="p-5 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#0F3E3E]">
              નવા સ્કેનર ઓપરેટર ઉમેરો (Issue Operator Account)
            </h3>
            <p className="text-[11px] text-[#5C7065] mt-0.5">
              સ્થળ પર હાજરી પૂરવા માટે અધિકૃત સ્વયંસેવકો માટે સુરક્ષિત ઓપરેટર એકાઉન્ટ બનાવો.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#0F3E3E]">ગેટ / સ્કેનર નામ *</Label>
            <Input
              placeholder="e.g. મુખ્ય પ્રવેશદ્વાર Gate 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-xs border-[#E8E0D5]"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#0F3E3E]">ઓપરેટરનું નામ *</Label>
            <Input
              placeholder="e.g. રમેશભાઈ પટેલ"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="h-10 text-xs border-[#E8E0D5]"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#0F3E3E]">મોબાઈલ નંબર (૧૦ અંક)</Label>
            <Input
              type="tel"
              placeholder="e.g. 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-10 text-xs border-[#E8E0D5]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-[#0F3E3E]">ઓપરેટર પાસવર્ડ *</Label>
            <Input
              type="text"
              placeholder="e.g. Yog@2026"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 text-xs border-[#E8E0D5]"
              required
              minLength={4}
            />
          </div>

          <div>
            <Button
              type="submit"
              disabled={busy || !name.trim() || !operator.trim() || !password}
              className="w-full h-10 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-semibold text-xs gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>ઓપરેટર બનાવો</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Show Newly Issued Credentials Card */}
      {newCreds && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                સ્કેનર ઓપરેટર એકાઉન્ટ તૈયાર છે! (Copy Credentials)
              </h4>
            </div>
            <button
              onClick={() => setNewCreds(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs"
            >
              ✕ બંધ કરો
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-emerald-200 text-xs font-mono">
            <div>
              <span className="text-[#64748B] text-[10px] block">ઓપરેટર યુઝરનેમ:</span>
              <strong className="text-[#0F3E3E] text-sm">{newCreds.scannerCode}</strong>
            </div>
            <div>
              <span className="text-[#64748B] text-[10px] block">પાસવર્ડ:</span>
              <strong className="text-emerald-800 text-sm">{newCreds.password}</strong>
            </div>
            <div>
              <span className="text-[#64748B] text-[10px] block">સ્કેનર લોગિન લિંક:</span>
              <span className="text-stone-700 truncate block text-[11px]">{newCreds.loginUrl}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const text = `ગુજરાત રાજ્ય યોગ બોર્ડ સ્કેનર કન્સોલ\nઓપરેટર: ${newCreds.operatorName}\nયુઝરનેમ: ${newCreds.scannerCode}\nપાસવર્ડ: ${newCreds.password}\nસ્કેનર લિંક: ${newCreds.loginUrl}`;
                navigator.clipboard.writeText(text);
                toast.success("તમામ વિગતો ક્લિપબોર્ડમાં કોપી થઈ ગઈ!");
              }}
              className="h-8 bg-emerald-700 hover:bg-emerald-600 text-white text-xs gap-1.5 font-semibold"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy All Details to Share</span>
            </Button>
          </div>
        </div>
      )}

      {/* Reset Password Modal / Inline Box */}
      {resettingId && (
        <form
          onSubmit={handleResetPassword}
          className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-end gap-3 text-xs"
        >
          <div className="space-y-1">
            <Label className="text-xs font-bold text-amber-900">નવો પાસવર્ડ દાખલ કરો</Label>
            <Input
              type="text"
              placeholder="નવો ગુપ્ત પાસવર્ડ..."
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="h-9 text-xs border-amber-300 bg-white"
              required
              minLength={4}
            />
          </div>
          <Button
            type="submit"
            disabled={pwdBusy || !newPwd.trim()}
            className="h-9 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold"
          >
            {pwdBusy ? "અપડેટ થાય છે..." : "પાસવર્ડ સાચવો"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setResettingId(null)}
            className="h-9 text-xs"
          >
            રદ કરો
          </Button>
        </form>
      )}

      {/* Scanners List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase text-[#5C7065]">
            નોંધાયેલ સ્કેનર ઓપરેટરો ({scanners.length})
          </h4>
        </div>

        {scanners.map((s) => (
          <div
            key={s.id}
            className="p-4 rounded-2xl bg-white border border-[#E8E0D5] shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs"
          >
            <div className="space-y-1 min-w-[200px]">
              <div className="flex items-center gap-2 font-bold text-[#0F3E3E]">
                <QrCode className="w-4 h-4 text-[#D97706]" />
                <span className="text-sm">{s.scanner_name}</span>
                <span className="font-mono text-[11px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-semibold">
                  {s.scanner_code}
                </span>
              </div>
              <p className="text-[#5C7065]">
                ઓપરેટર: <strong className="text-stone-800">{s.operator_name}</strong>
                {s.mobile && (
                  <span className="font-mono ml-2 text-stone-600 font-medium">({s.mobile})</span>
                )}
                <span className="mx-2">&bull;</span>
                <span
                  className={
                    s.revoked_at
                      ? "text-rose-600 font-bold"
                      : s.is_active
                      ? "text-emerald-600 font-bold"
                      : "text-stone-500 font-bold"
                  }
                >
                  {s.revoked_at ? "● રદ કરેલ (Revoked)" : s.is_active ? "● સક્રિય (Active)" : "○ નિષ્ક્રિય (Inactive)"}
                </span>
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] text-stone-500 pt-1 font-mono">
                <span>કુલ સ્કેન: <strong className="text-stone-800">{s.total_scans ?? 0}</strong></span>
                <span>સફળ હાજરી: <strong className="text-emerald-700">{s.successful_scans ?? 0}</strong></span>
                <span>ડુપ્લીકેટ: <strong className="text-amber-700">{s.duplicate_attempts ?? 0}</strong></span>
                <span>અમાન્ય: <strong className="text-rose-600">{s.invalid_scans ?? 0}</strong></span>
                {s.last_login_at && (
                  <span>છેલ્લું લોગિન: {new Date(s.last_login_at).toLocaleTimeString("en-IN")}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setResettingId(s.id);
                  setNewPwd("");
                }}
                className="h-8 text-xs border-[#E8E0D5]"
              >
                <Key className="w-3.5 h-3.5 mr-1" />
                <span>પાસવર્ડ બદલો</span>
              </Button>

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
                  onClick={() => {
                    if (confirm(`શું તમે ખરેખર ${s.operator_name} નો સ્કેનર અધિકાર રદ કરવા માંગો છો?`)) {
                      handleStatus(s.id, "revoke");
                    }
                  }}
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
            આ શિબિર માટે હજુ કોઈ સ્કેનર ઓપરેટર બનાવવામાં આવ્યા નથી. ઉપરથી નવો ઓપરેટર ઉમેરો.
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
