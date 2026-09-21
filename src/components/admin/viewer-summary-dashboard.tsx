import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  LayoutGrid,
  List,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  adminChangeOwnPassword,
  adminLogout,
  viewerDashboardStats,
  type ViewerDashboardStatsResult,
} from "@/lib/registration.functions";

interface CheckData {
  authed: boolean;
  username: string | null;
  role: "super_admin" | "view_admin" | null;
  must_change_password: boolean;
  userId?: string | null;
}

interface ViewerSummaryDashboardProps {
  check: CheckData;
  onLogout: () => void;
  onRefetchCheck: () => void;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

export function ViewerSummaryDashboard({
  check,
  onLogout,
  onRefetchCheck,
}: ViewerSummaryDashboardProps) {
  const getStats = useServerFn(viewerDashboardStats);
  const logout = useServerFn(adminLogout);
  const changePassword = useServerFn(adminChangeOwnPassword);
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Password change dialog state
  const [pwdOpen, setPwdOpen] = useState(check.must_change_password);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // Fetch summary stats every 30 seconds
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["viewer-dashboard-stats"],
    queryFn: () => getStats({ data: {} }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const summary = data?.ok ? data.summary : null;
  const allRows = data?.ok ? data.rows : [];

  // Filter rows by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return allRows;
    const term = searchTerm.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        r.district_name.toLowerCase().includes(term) ||
        r.event_name.toLowerCase().includes(term) ||
        r.slug.toLowerCase().includes(term),
    );
  }, [allRows, searchTerm]);

  // Handle password change
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      return toast.error("New passwords do not match.");
    }
    if (newPwd.length < 8) {
      return toast.error("New password must be at least 8 characters.");
    }
    setPwdLoading(true);
    try {
      const res = await changePassword({
        data: { current_password: currentPwd, new_password: newPwd },
      });
      if (!res.ok) {
        toast.error(res.error || "Failed to update password.");
        return;
      }
      toast.success("Password updated successfully.");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdOpen(false);
      onRefetchCheck();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPwdLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2623]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E8E0D5] px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo-gsyb.png"
              alt="Gujarat State Yog Board"
              className="w-10 h-10 object-contain drop-shadow-xs"
            />
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-[#0F3E3E] leading-tight">
                ગુજરાત રાજ્ય યોગ બોર્ડ
              </h1>
              <p className="text-xs text-[#5C7065] font-medium">
                રજીસ્ટ્રેશન અને હાજરી સારાંશ ડેશબોર્ડ (Registration & Check-in Summary)
              </p>
            </div>
          </div>

          {/* Action buttons (Clean: no role badges or "Viewer Admin" labels) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5C7065] hidden sm:inline-block mr-1">
              Signed in as <strong className="text-[#0F3E3E]">{check.username}</strong>
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 gap-1.5 text-xs font-semibold border-[#D9D0C5] text-[#0F3E3E] hover:bg-stone-100"
              title="રિફ્રેશ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPwdOpen(true)}
              className="h-9 gap-1.5 text-xs font-semibold border-[#D9D0C5] text-[#0F3E3E] hover:bg-stone-100"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Change Password</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                onLogout();
              }}
              className="h-9 gap-1.5 text-xs font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Registrations */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5C7065]">
                Total Registrations
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0F3E3E] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0F3E3E] tracking-tight">
                {isLoading ? "—" : formatNumber(summary?.total_registrations ?? 0)}
              </span>
              <p className="text-[10px] text-[#78887F] mt-0.5">કુલ નોંધાયેલ સહભાગીઓ</p>
            </div>
          </div>

          {/* Card 2: Total Check-ins */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5C7065]">
                Total Check-Ins
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-teal-800 tracking-tight">
                {isLoading ? "—" : formatNumber(summary?.total_checkins ?? 0)}
              </span>
              <p className="text-[10px] text-[#78887F] mt-0.5">સ્થળ પર હાજર થયેલ</p>
            </div>
          </div>

          {/* Card 3: Check-in Percentage */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5C7065]">
                Check-In Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-800 tracking-tight">
                {isLoading ? "—" : `${summary?.overall_percentage ?? 0}%`}
              </span>
              <p className="text-[10px] text-[#78887F] mt-0.5">કુલ હાજરી ટકાવારી</p>
            </div>
          </div>

          {/* Card 4: Active Events */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5C7065]">
                Active Events
              </span>
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
                <span className="text-xs font-bold">36</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight">
                {isLoading ? "—" : summary?.total_events ?? 0}
              </span>
              <p className="text-[10px] text-[#78887F] mt-0.5">કુલ યોગ શિબિર કાર્યક્રમો</p>
            </div>
          </div>
        </div>

        {/* Filter & View Switcher Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-[#E8E0D5] shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              type="text"
              placeholder="જિલ્લો અથવા શિબિર શોધો (Search district / event)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-xs border-[#D9D0C5] rounded-xl focus:border-[#0F3E3E]"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
            <span className="text-[#5C7065] text-xs font-medium">
              Showing <strong>{filteredRows.length}</strong> of {allRows.length} events
            </span>

            <div className="flex items-center bg-[#FAF8F5] p-0.5 rounded-xl border border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "table"
                    ? "bg-white text-[#0F3E3E] shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                title="ટેબલ વ્યુ"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "cards"
                    ? "bg-white text-[#0F3E3E] shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                title="કાર્ડ વ્યુ"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0F3E3E]" />
            <p className="text-xs font-semibold text-stone-600 mt-2">માહિતી લોડ થઈ રહી છે...</p>
          </div>
        )}

        {/* View Mode 1: Table View */}
        {!isLoading && viewMode === "table" && (
          <div className="bg-white rounded-2xl border border-[#E8E0D5] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5] text-[#5C7065] font-bold">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">District (જિલ્લો)</th>
                    <th className="py-3 px-4">Event Name (શિબિરનું નામ)</th>
                    <th className="py-3 px-4 text-right">Registrations (રજીસ્ટ્રેશન)</th>
                    <th className="py-3 px-4 text-right">Check-Ins (હાજરી)</th>
                    <th className="py-3 px-4 text-right">Check-In %</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EAE1]">
                  {filteredRows.map((row, index) => (
                    <tr key={row.event_id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 text-center text-stone-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0F3E3E]">
                        {row.district_name || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900 leading-snug">
                          {row.event_name}
                        </div>
                        <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                          /{row.slug}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#0F3E3E] font-mono text-sm">
                        {formatNumber(row.registration_count)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-teal-800 font-mono text-sm">
                        {formatNumber(row.checkin_count)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            row.checkin_percentage > 50
                              ? "bg-emerald-100 text-emerald-800"
                              : row.checkin_percentage > 0
                              ? "bg-teal-100 text-teal-800"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {row.checkin_percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            row.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {row.is_active ? "સક્રિય" : "બંધ"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                        કોઈ માહિતી મળેલ નથી (No matching events found).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Mode 2: Responsive Cards (Mobile optimized) */}
        {!isLoading && viewMode === "cards" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredRows.map((row) => (
              <div
                key={row.event_id}
                className="bg-white rounded-2xl border border-[#E8E0D5] p-4 shadow-xs hover:border-[#0F3E3E]/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[#0F3E3E] text-[10px] font-bold tracking-wide uppercase">
                      {row.district_name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.is_active ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {row.is_active ? "● સક્રિય" : "બંધ"}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[#0F3E3E] mt-2 line-clamp-2">
                    {row.event_name}
                  </h3>
                  <p className="text-[10px] font-mono text-stone-400 mt-0.5 truncate">
                    /{row.slug}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0EAE1] grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-[#78887F] uppercase font-semibold">રજીસ્ટ્રેશન</span>
                    <p className="text-sm font-extrabold text-[#0F3E3E] font-mono mt-0.5">
                      {formatNumber(row.registration_count)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#78887F] uppercase font-semibold">હાજરી</span>
                    <p className="text-sm font-extrabold text-teal-800 font-mono mt-0.5">
                      {formatNumber(row.checkin_count)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#78887F] uppercase font-semibold">ટકાવારી</span>
                    <p className="text-sm font-extrabold text-amber-700 font-mono mt-0.5">
                      {row.checkin_percentage}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Change Password Dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              {check.must_change_password
                ? "For security, you must change your initial password before proceeding."
                : "Enter your current password and a new secure password (at least 8 characters)."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Current Password</Label>
              <PasswordInput
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">New Password</Label>
              <PasswordInput
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirm New Password</Label>
              <PasswordInput
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <DialogFooter className="pt-2">
              {!check.must_change_password && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPwdOpen(false)}
                  disabled={pwdLoading}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={pwdLoading} className="bg-[#0F3E3E] text-white">
                {pwdLoading ? "Saving..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
