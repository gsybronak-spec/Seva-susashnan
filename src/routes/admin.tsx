import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  adminChangeOwnPassword,
  adminCheck,
  adminList,
  adminExportBatch,
  adminLogin,
  adminLogout,
  adminResetSuperAdminPassword,
  adminSetCertificatesEnabled,
  adminStats,
  adminToggleCertificate,
  getPublicSettings,
} from "@/lib/registration.functions";
import { adminListEvents } from "@/lib/event-admin.functions";
import { adminAttendanceSummary } from "@/lib/checkin.functions";

// Lazy-loaded heavy modules — only fetched when their tab is opened.
const EventSettings = lazy(() => import("@/components/admin/event-settings").then(m => ({ default: m.EventSettings })));
const EventsManager = lazy(() => import("@/components/admin/events-manager").then(m => ({ default: m.EventsManager })));
const CampaignsManager = lazy(() => import("@/components/admin/campaigns-manager").then(m => ({ default: m.CampaignsManager })));
const EventOperationsDashboard = lazy(() => import("@/components/admin/event-operations-dashboard").then(m => ({ default: m.EventOperationsDashboard })));
const CertificateManager = lazy(() => import("@/components/admin/certificate-manager").then(m => ({ default: m.CertificateManager })));
const UserManager = lazy(() => import("@/components/admin/user-manager").then(m => ({ default: m.UserManager })));
const PartnerManager = lazy(() => import("@/components/admin/partner-manager").then(m => ({ default: m.PartnerManager })));
const OrganisationsManager = lazy(() => import("@/components/admin/organisations-manager").then(m => ({ default: m.OrganisationsManager })));
const PartnerDashboard = lazy(() => import("@/components/admin/partner-dashboard").then(m => ({ default: m.PartnerDashboard })));
const EventOverview = lazy(() => import("@/components/admin/event-overview").then(m => ({ default: m.EventOverview })));
const AdminCharts = lazy(() => import("@/components/admin/admin-charts").then(m => ({ default: m.AdminCharts })));
const DistrictBreakdown = lazy(() => import("@/components/admin/district-breakdown").then(m => ({ default: m.DistrictBreakdown })));
const DistrictManager = lazy(() => import("@/components/admin/district-manager").then(m => ({ default: m.DistrictManager })));
const ViewerSummaryDashboard = lazy(() => import("@/components/admin/viewer-summary-dashboard").then(m => ({ default: m.ViewerSummaryDashboard })));


import {
  AlertCircle,
  ArrowLeft,
  Award,
  Download,
  KeyRound,
  LayoutGrid,
  LogOut,
  QrCode,
  RefreshCcw,
  Search,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import { clearEventQueries, invalidateEventQueries } from "@/lib/query-cache";

function TabFallback() {
  return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
}

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type CheckData = {
  authed: boolean;
  username: string | null;
  role: "super_admin" | "view_admin" | null;
  must_change_password: boolean;
  userId?: string | null;
  can_view_partners?: boolean;
};


function AdminPage() {
  const check = useServerFn(adminCheck);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => check(),
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!data?.authed) return <LoginCard onLoggedIn={() => refetch()} />;

  // Viewer Admin: strictly isolated to the read-only summary dashboard with zero participant data
  if (data.role === "view_admin") {
    return (
      <Suspense fallback={<TabFallback />}>
        <ViewerSummaryDashboard
          check={data as CheckData}
          onLogout={() => refetch()}
          onRefetchCheck={() => refetch()}
        />
      </Suspense>
    );
  }

  // Render dedicated child routes (such as /admin/checkin) directly for Super Admins
  if (pathname !== "/admin" && pathname !== "/admin/") {
    return <Outlet />;
  }

  return <Dashboard check={data as CheckData} onLogout={() => refetch()} onRefetchCheck={() => refetch()} />;
}

function LoginCard({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const login = useServerFn(adminLogin);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ data: { username, password: pw } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Signed in");
      onLoggedIn();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="brand-bar h-1 w-full" />
        <form onSubmit={submit} className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <img src="/logo-gsyb.png" alt="" className="h-11 w-11 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-brand-primary">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">{BRAND.name}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in with your admin credentials.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <PasswordInput
              id="pw"
              autoComplete="current-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="text-xs text-muted-foreground hover:text-brand-primary hover:underline"
            >
              Forgotten Super Admin password?
            </button>
          </div>
        </form>
      </div>

      <ResetSuperAdminDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onResetSuccess={(u) => {
          setUsername(u);
          setPw("");
        }}
      />
    </div>
  );
}

function ResetSuperAdminDialog({
  open,
  onOpenChange,
  onResetSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResetSuccess: (username: string) => void;
}) {
  const resetFn = useServerFn(adminResetSuperAdminPassword);
  const [resetUser, setResetUser] = useState("superadmin");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error("New passwords do not match.");
    }
    if (newPassword.length < 8) {
      return toast.error("New password must be at least 8 characters.");
    }
    if (recoveryKey.length < 16) {
      return toast.error("Please enter a valid server recovery key (at least 16 characters).");
    }

    setLoading(true);
    try {
      const res = await resetFn({
        data: {
          username: resetUser,
          recovery_key: recoveryKey,
          new_password: newPassword,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message || "Password reset successfully. You may now sign in.");
      onOpenChange(false);
      onResetSuccess(resetUser);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Super Admin Password</DialogTitle>
          <DialogDescription>
            Enter your server recovery key (from your hosting environment settings) to securely set a new Super Admin password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="reset-username">Super Admin Username</Label>
            <Input
              id="reset-username"
              value={resetUser}
              onChange={(e) => setResetUser(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recovery-key">Server Recovery Key</Label>
            <PasswordInput
              id="recovery-key"
              placeholder="Enter server recovery key"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              This secret is configured in your backend hosting environment and proves server ownership.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New Password</Label>
            <PasswordInput
              id="new-pw"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Confirm New Password</Label>
            <PasswordInput
              id="confirm-pw"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
  forced,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forced: boolean;
  onSuccess: () => void;
}) {
  const change = useServerFn(adminChangeOwnPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return toast.error("Passwords do not match");
    if (next.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      const res = await change({ data: { current_password: current, new_password: next } });
      if (!res.ok) return toast.error(res.error);
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
      onSuccess();
      onOpenChange(false);
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (forced ? null : onOpenChange(v))}>
      <DialogContent onInteractOutside={(e) => forced && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          {forced && (
            <DialogDescription>
              For security, please set a new password before continuing.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Current Password</Label>
            <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div>
            <Label>New Password</Label>
            <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          <DialogFooter>
            {!forced && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Update Password"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


type Row = {
  id: string;
  registration_number: string;
  full_name: string;
  mobile: string;
  gender: string | null;
  date_of_birth: string | null;
  age: number | null;
  age_group: string | null;
  village: string;
  taluka: string | null;
  district: string;
  designation: string;
  referral_code: string;
  referred_by: string | null;
  partner_id: string | null;
  partner_name: string | null;
  certificate_available: boolean;
  created_at: string;
  referral_count: number;
  // Reporting-only: option values resolved against this event's own form.
  taluka_label?: string;
  district_label?: string;
  // Physical check-in reporting (populated by adminExportBatch).
  email?: string | null;
  organization?: string | null;
  registration_status?: string;
  attendance_status?: string;
  check_in_time?: string | null;
  check_in_method?: string | null;
  custom_fields?: Record<string, unknown> | null;
};




function Dashboard({
  check,
  onLogout,
  onRefetchCheck,
}: {
  check: CheckData;
  onLogout: () => void;
  onRefetchCheck: () => void;
}) {
  const isSuper = check.role === "super_admin";
  const readOnly = !isSuper;
  const [pwdOpen, setPwdOpen] = useState(check.must_change_password);
  useEffect(() => {
    if (check.must_change_password) setPwdOpen(true);
  }, [check.must_change_password]);

  const list = useServerFn(adminList);
  const exportBatchFn = useServerFn(adminExportBatch);
  const logout = useServerFn(adminLogout);
  const toggle = useServerFn(adminToggleCertificate);
  const stats = useServerFn(adminStats);
  const settings = useServerFn(getPublicSettings);
  const setCerts = useServerFn(adminSetCertificatesEnabled);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [selectedEventId, setSelectedEventIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const v = window.localStorage.getItem("admin.selectedEventId") || "";
    return v === "all" ? "" : v;
  });
  const setSelectedEventId = (v: string) => {
    if (v !== selectedEventId) {
      // Switching events must wipe the previous event's cached data so no
      // panel can render stale cross-event state while refetching.
      clearEventQueries(qc);
    }
    setSelectedEventIdState(v);
    if (typeof window !== "undefined") window.localStorage.setItem("admin.selectedEventId", v);
  };
  const eventIdArg = selectedEventId || undefined;

  // Overview vs Workspace mode. Admin lands on the Event Overview page and
  // opens a specific event's workspace by clicking a card.
  const [view, setView] = useState<"overview" | "workspace">("overview");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Controlled workspace tab + initial Event Settings subtab, so "Edit /
  // Form Builder / Certificate" actions from the Events list land on the
  // right panel.
  const [workspaceTab, setWorkspaceTab] = useState("dashboard");
  // Campaign context: when the admin drills into a campaign from Admin →
  // Campaigns, downstream tabs (Events/Participants/Check-In/Certificates)
  // scope themselves to that campaign's data.
  const [campaignFilterId, setCampaignFilterId] = useState<string>("");
  const [settingsTab, setSettingsTab] = useState<
    "status" | "coverage" | "form" | "partner_form" | "general" | "features" | "attendance" | "certificate" | "referral" | "whatsapp" | "social"
  >("status");
  function openEventFor(id: string, action: "settings" | "form" | "certificates") {
    setSelectedEventId(id);
    if (action === "certificates") {
      setWorkspaceTab("certificates");
    } else {
      setWorkspaceTab("event");
      setSettingsTab(action === "form" ? "form" : "status");
    }
    setView("workspace");
  }
  function openWorkspace(id: string) {
    if (!id) {
      setPickerOpen(true);
      setView("workspace");
      return;
    }
    setSelectedEventId(id);
    setView("workspace");
  }


  const eventsFn = useServerFn(adminListEvents);
  const { data: eventsData } = useQuery({
    queryKey: ["admin-events-select"],
    queryFn: () => eventsFn(),
  });
  const eventOptions = useMemo(() => {
    const rows = (eventsData?.ok ? eventsData.rows : []) as unknown as Array<{
      id: string;
      slug: string;
      general: { title?: string } | null;
      district: string | null;
      district_id?: string | null;
      coverage_type?: "single" | "zone" | "state";
      coverage_district_names?: string[];
      is_active: boolean;
    }>;
    return rows.map((r) => {
      const cov = r.coverage_type ?? "single";
      const covLabel =
        cov === "state"
          ? "State-wide"
          : cov === "zone"
            ? (r.coverage_district_names ?? []).join(", ") || "Zone"
            : (r.coverage_district_names?.[0] ?? r.district ?? "Single");
      return {
        id: r.id,
        label: `${r.general?.title || r.slug} · ${covLabel}${r.is_active ? " • active" : ""}`,
      };
    });
  }, [eventsData]);
  const selectedEventLabel = useMemo(
    () => eventOptions.find((w) => w.id === selectedEventId)?.label ?? "",
    [eventOptions, selectedEventId],
  );
  const selectedEventSlug = useMemo(() => {
    const rows = (eventsData?.ok ? eventsData.rows : []) as any[];
    const match = rows.find((r) => r.id === selectedEventId);
    return match?.slug || "";
  }, [eventsData, selectedEventId]);

  // Auto-open the mandatory picker whenever the workspace is active but no event has been chosen.
  useEffect(() => {
    if (view === "workspace" && !selectedEventId) setPickerOpen(true);
  }, [view, selectedEventId]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-list", applied, eventIdArg ?? "all"],
    queryFn: () => list({ data: { search: applied, event_id: eventIdArg } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["admin-stats", eventIdArg ?? "all"],
    queryFn: () => stats({ data: { event_id: eventIdArg } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  // Physical check-in summary (present / pending) for the dashboard.
  const attendanceSummaryFn = useServerFn(adminAttendanceSummary);
  const { data: attData } = useQuery({
    queryKey: ["admin-attendance-summary", eventIdArg ?? "all"],
    queryFn: () => attendanceSummaryFn({ data: { event_id: eventIdArg } }),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  const att = attData?.ok ? attData : null;

  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => settings(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const rows: Row[] = useMemo(
    () => (data?.ok ? (data.rows as unknown as Row[]) : []),
    [data],
  );


  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (genderFilter !== "all") {
          const g = r.gender ?? "Unspecified";
          if (g !== genderFilter) return false;
        }
        if (ageGroupFilter !== "all") {
          const ag = r.age_group ?? "Unspecified";
          if (ag !== ageGroupFilter) return false;
        }
        if (attendanceFilter !== "all") {
          const st = r.attendance_status ?? "Pending";
          if (attendanceFilter === "checked_in" && st === "Pending") return false;
          if (attendanceFilter === "pending" && st !== "Pending") return false;
        }
        if (districtFilter !== "all") {
          const d = r.district_label || r.district || "Unspecified";
          if (d !== districtFilter) return false;
        }
        return true;
      }),
    [rows, genderFilter, ageGroupFilter, attendanceFilter, districtFilter],
  );

  useEffect(() => {
    if (data && !data.ok) toast.error(data.error);
  }, [data]);

  // Export fetches ALL matching registrations from the server in batches —
  // never the (capped) list currently loaded in the admin table.
  async function fetchAllForExport(): Promise<Row[]> {
    const BATCH = 2000;
    const all: Row[] = [];
    const seen = new Set<string>();
    for (let offset = 0; ; offset += BATCH) {
      const res = await exportBatchFn({
        data: {
          search: applied,
          event_id: eventIdArg,
          offset,
          limit: BATCH,
        },
      });
      if (!res.ok) throw new Error(res.error ?? "Export failed");
      const batch = res.rows as unknown as Row[];
      for (const r of batch) {
        const key = String((r as unknown as { id?: string }).id ?? r.registration_number);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(r);
      }
      if (batch.length < BATCH) break;
      if (offset > 500_000) break; // hard safety stop
    }
    return all.filter((r) => {
      if (genderFilter !== "all" && (r.gender ?? "Unspecified") !== genderFilter) return false;
      if (ageGroupFilter !== "all" && (r.age_group ?? "Unspecified") !== ageGroupFilter) return false;
      return true;
    });
  }

  async function exportCSV() {
    if (isExporting) return;
    setIsExporting(true);
    let source: Row[] = [];
    try {
      source = await fetchAllForExport();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
      setIsExporting(false);
      return;
    }
    setIsExporting(false);
    if (!source.length) {
      toast.error("No registrations to export.");
      return;
    }

    const headers = [
      "Participant ID",
      "Name",
      "Mobile",
      "Email",
      "Gender",
      "Date of Birth",
      "Age",
      "Age Group",
      "Village",
      "Taluka",
      "Zone",
      "District",
      "Organization / Centre",
      "Designation",
      "Coach Name",
      "Coordinator Name",
      "Referred By",
      "Registration Status",
      "Attendance Status",
      "Check-In Time",
      "Check-In Method",
      "Certificate Available",
      "Registration Date",
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [headers.join(",")];
    for (const r of source) {
      const cf = (r.custom_fields ?? {}) as Record<string, unknown>;
      lines.push(
        [
          r.registration_number,
          r.full_name,
          r.mobile,
          r.email ?? "",
          r.gender ?? "",
          r.date_of_birth ?? "",
          r.age ?? "",
          r.age_group ?? "",
          r.village,
          r.taluka_label || r.taluka || "",
          cf.zone ?? "",
          r.district_label || r.district || "",
          cf.participant_type || r.designation || "",
          (cf.participant_type === "Yog Trainer" || r.designation === "Yog Trainer") ? (cf.coach_name ?? "") : "",
          cf.coordinator_name ?? "",
          r.referred_by ?? "",
          r.registration_status ?? "Registered",
          r.attendance_status ?? "Pending",
          r.check_in_time
            ? new Date(r.check_in_time).toLocaleString("en-IN")
            : "",
          r.check_in_method ?? "",
          r.certificate_available ? "Yes" : "No",
          new Date(r.created_at).toLocaleString("en-IN"),
        ]
          .map(escape)
          .join(","),
      );
    }

    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slugPart = (selectedEventLabel || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
    a.download = `syb-${slugPart}-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${source.length.toLocaleString("en-IN")} registrations`);
  }


  async function onToggle(r: Row) {
    const res = await toggle({
      data: {
        registration_number: r.registration_number,
        available: !r.certificate_available,
        // Scope to the selected event when one is chosen — never let a
        // registration-number collision touch another event's record.
        event_id: eventIdArg,
      },
    });
    if (res.ok) {
      toast.success("Updated");
      invalidateEventQueries(qc);
    } else {
      toast.error(res.error);
    }
  }

  async function onToggleCertsGlobal(next: boolean) {
    const res = await setCerts({ data: { enabled: next } });
    if (res.ok) {
      toast.success(
        next
          ? "Certificate downloads are now LIVE"
          : "Certificate downloads hidden",
      );
      refetchSettings();
      invalidateEventQueries(qc);
    } else {
      toast.error(res.error);
    }
  }

  const s = statsData?.ok ? statsData : null;
  const certsEnabled = !!settingsData?.certificates_enabled;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ChangePasswordDialog
        open={pwdOpen}
        onOpenChange={setPwdOpen}
        forced={check.must_change_password}
        onSuccess={onRefetchCheck}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="kicker">Board Operations</p>
          <h1 className="display-2">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{check.username}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "workspace" && (
            <Button variant="outline" onClick={() => setView("overview")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Overview
            </Button>
          )}
          {view === "overview" && (
            <Button variant="outline" onClick={() => setView("workspace")}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Open Workspace
            </Button>
          )}
          {selectedEventSlug ? (
            <Button
              asChild
              className="bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-semibold shadow-xs"
            >
              <a
                href={`/${selectedEventSlug}/scan`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <QrCode className="mr-2 h-4 w-4 text-[#F59E0B]" />
                ઓપરેટર સ્કેનર કન્સોલ
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setWorkspaceTab("checkin")}
              className="border-[#0F3E3E] text-[#0F3E3E] hover:bg-[#0F3E3E] hover:text-white font-semibold shadow-xs"
            >
              <QrCode className="mr-2 h-4 w-4 text-[#F59E0B]" />
              હાજરી અને સ્કેનર્સ
            </Button>
          )}
          <Button variant="outline" onClick={() => setPwdOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Change Password
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              refetch();
              refetchStats();
            }}
            disabled={isFetching}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {isSuper && (
            <Button onClick={exportCSV} disabled={!rows.length || isExporting}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await logout();
              onLogout();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {view === "overview" && (
        <Suspense fallback={<TabFallback />}>
          <EventOverview isSuper={isSuper} onOpen={openWorkspace} />
        </Suspense>
      )}

      {view === "workspace" && (
      <>
      <EventPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        eventOptions={eventOptions}
        currentId={selectedEventId}
        onSelect={(id) => {
          setSelectedEventId(id);
          setPickerOpen(false);
        }}
        forced={!selectedEventId}
      />

      {/* Persistent context banner — every workspace action targets this event */}
      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-sm ${
          selectedEventId
            ? "border-brand-success/40 bg-brand-success/5"
            : "border-destructive/50 bg-destructive/5"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-3 w-3 rounded-full ${
              selectedEventId ? "bg-brand-success" : "bg-destructive"
            }`}
            aria-hidden
          />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Currently Editing
            </div>
            <div className="text-base font-bold text-brand-primary">
              {selectedEventId
                ? (selectedEventLabel || "Selected event")
                : "No event selected — please choose an event first"}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          {selectedEventId ? "Change Event" : "Select Event"}
        </Button>
      </div>


      <Tabs value={workspaceTab} onValueChange={setWorkspaceTab}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="dashboard">Dashboard & Participants</TabsTrigger>
          {isSuper && <TabsTrigger value="campaigns">Campaigns</TabsTrigger>}
          {isSuper && <TabsTrigger value="events">Events</TabsTrigger>}
          <TabsTrigger value="checkin">Check-In & Operators</TabsTrigger>
          {isSuper && <TabsTrigger value="certificates">Certificates</TabsTrigger>}
          {isSuper && <TabsTrigger value="event">Event Settings</TabsTrigger>}
          {(isSuper || check.can_view_partners) && (
            <TabsTrigger value="partner-dashboard">Partner Dashboard</TabsTrigger>
          )}
          {isSuper && <TabsTrigger value="partners">Partner Management</TabsTrigger>}
          {isSuper && <TabsTrigger value="organisations">Organisations</TabsTrigger>}
          {isSuper && <TabsTrigger value="users">Admin Users</TabsTrigger>}
          {isSuper && <TabsTrigger value="districts">Districts</TabsTrigger>}

        </TabsList>          {isSuper && (
            <TabsContent value="campaigns" className="mt-4">
              <Suspense fallback={<TabFallback />}>
                <CampaignsManager
                  onOpenEvents={(campaignId) => {
                    setCampaignFilterId(campaignId);
                    setWorkspaceTab("events");
                  }}
                  onOpenParticipants={(campaignId) => {
                    setCampaignFilterId(campaignId);
                    setWorkspaceTab("dashboard");
                  }}
                  onOpenCheckin={(campaignId) => {
                    setCampaignFilterId(campaignId);
                    setWorkspaceTab("checkin");
                  }}
                  onOpenCertificates={(campaignId) => {
                    setCampaignFilterId(campaignId);
                    setWorkspaceTab("certificates");
                  }}
                />
              </Suspense>
            </TabsContent>
          )}
          {isSuper && (
            <TabsContent value="events" className="mt-4">
              <Suspense fallback={<TabFallback />}>
                <EventsManager onManageEvent={openEventFor} campaignFilterId={campaignFilterId} />
              </Suspense>
            </TabsContent>
          )}
        <TabsContent value="checkin" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <EventOperationsDashboard eventId={selectedEventId || "2caae4eb-03b7-47be-98fa-a4a145867bd2"} />
          </Suspense>
        </TabsContent>
        {(isSuper || check.can_view_partners) && (
          <TabsContent value="partner-dashboard" className="mt-4">
            <Suspense fallback={<TabFallback />}>
              <PartnerDashboard key={selectedEventId} eventId={eventIdArg} />
            </Suspense>
          </TabsContent>
        )}
        {isSuper && (
          <TabsContent value="partners" className="mt-4">
            {selectedEventId ? (
              <Suspense fallback={<TabFallback />}>
                <PartnerManager key={selectedEventId} readOnly={false} eventId={eventIdArg} />
              </Suspense>
            ) : (
              <NoEventNotice onPick={() => setPickerOpen(true)} />
            )}
          </TabsContent>
        )}
        {isSuper && (
          <TabsContent value="organisations" className="mt-4">
            {selectedEventId ? (
              <Suspense fallback={<TabFallback />}>
                <OrganisationsManager key={selectedEventId} eventId={eventIdArg} readOnly={false} />
              </Suspense>
            ) : (
              <NoEventNotice onPick={() => setPickerOpen(true)} />
            )}
          </TabsContent>
        )}
        {isSuper && (
          <TabsContent value="certificates" className="mt-4">
            {selectedEventId ? (
              <Suspense fallback={<TabFallback />}>
                <CertificateManager key={selectedEventId} eventId={eventIdArg} />
              </Suspense>
            ) : (
              <NoEventNotice onPick={() => setPickerOpen(true)} />
            )}
          </TabsContent>
        )}
        {isSuper && (
          <TabsContent value="users" className="mt-4">
            <Suspense fallback={<TabFallback />}>
              <UserManager currentUserId={check.userId ?? null} />
            </Suspense>
          </TabsContent>
        )}
        {isSuper && (
          <TabsContent value="districts" className="mt-4">
            <Suspense fallback={<TabFallback />}>
              <DistrictManager />
            </Suspense>
          </TabsContent>
        )}


        <TabsContent value="dashboard" className="mt-4">


      {/* Certificate control */}
      {isSuper && (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand-primary">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">
              Certificate Downloads
            </div>
            <div className="text-sm text-muted-foreground">
              {certsEnabled
                ? "Live — participants can download certificates from the site."
                : "Hidden — enable this after the event is completed."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {certsEnabled ? "Enabled" : "Disabled"}
          </span>
          <Switch
            checked={certsEnabled}
            onCheckedChange={onToggleCertsGlobal}
            disabled={readOnly}
          />
        </div>
      </div>
      )}


      {/* Core event stats: registration + attendance (PDF Modules 4 & 12) */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Total Registrations" value={s?.total ?? 0} accent="blue" />
        <StatCard label="Checked-In (Present)" value={att?.checked_in ?? 0} accent="green" />
        <StatCard label="Pending Attendance" value={Math.max(0, (s?.total ?? 0) - (att?.checked_in ?? 0))} accent="brand-accent" />
        <StatCard label="Today" value={s?.today ?? 0} accent="green" />
        <StatCard label="Partner Regs" value={s?.partnerRegistrations ?? 0} accent="blue" />
        <StatCard label="Certificate Eligible" value={att?.checked_in ?? 0} accent="brand-accent" />
      </div>


      {/* Gender & Age */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        <StatCard label="Male" value={s?.byGender?.["Male"] ?? 0} accent="blue" />
        <StatCard label="Female" value={s?.byGender?.["Female"] ?? 0} accent="brand-accent" />
        <StatCard label="Other Gender" value={s?.byGender?.["Other"] ?? 0} accent="green" />
        <StatCard label="Below 18" value={s?.byAgeGroup?.["Below 18"] ?? 0} accent="brand-accent" />
        <StatCard label="18–35" value={s?.byAgeGroup?.["18-35"] ?? 0} accent="blue" />
        <StatCard label="36–50" value={s?.byAgeGroup?.["36-50"] ?? 0} accent="green" />
        <StatCard label="Above 50" value={s?.byAgeGroup?.["Above 50"] ?? 0} accent="brand-accent" />
      </div>

      {/* District-wise counts — server-side aggregate, current event only */}
      {selectedEventId && (
        <Suspense fallback={<div className="mb-6 h-48 rounded-xl border border-border bg-muted/20" />}>
          <DistrictBreakdown key={selectedEventId} eventId={selectedEventId} />
        </Suspense>
      )}


      {/* Charts (lazy-loaded recharts bundle) */}
      <Suspense fallback={<div className="mb-6 h-64 rounded-xl border border-border bg-muted/20" />}>
        <AdminCharts byGender={s?.byGender} byAgeGroup={s?.byAgeGroup} />
      </Suspense>


      {/* Leaderboard */}
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 p-4">
          <Trophy className="h-5 w-5 text-brand-accent" />
          <h2 className="font-semibold text-brand-primary">Referral Leaderboard · Top 10</h2>
        </div>
        {s?.leaderboard?.length ? (
          <ol className="divide-y divide-border">
            {s.leaderboard.map((l, i) => (
              <li
                key={l.registration_number}
                className="flex items-center gap-4 p-3 text-sm"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                    i === 0
                      ? "bg-brand-accent text-white"
                      : i === 1
                        ? "bg-brand-primary text-white"
                        : i === 2
                          ? "bg-brand-success text-white"
                          : "bg-muted text-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{l.full_name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {l.registration_number}
                  </div>
                </div>
                <div className="flex items-center gap-1 font-semibold text-brand-primary">
                  <Users className="h-4 w-4" />
                  {l.count}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No referrals yet.
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search);
        }}
        className="mb-4 flex flex-wrap gap-2"
      >
        <Input
          className="min-w-[220px] flex-1"
          placeholder="Search by name, mobile or registration number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Gender" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
            <SelectItem value="Unspecified">Unspecified</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Age Group" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Age Groups</SelectItem>
            <SelectItem value="Below 18">Below 18</SelectItem>
            <SelectItem value="18-35">18–35</SelectItem>
            <SelectItem value="36-50">36–50</SelectItem>
            <SelectItem value="Above 50">Above 50</SelectItem>
            <SelectItem value="Unspecified">Unspecified</SelectItem>
          </SelectContent>
        </Select>
        <Select value={attendanceFilter} onValueChange={setAttendanceFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Attendance" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Attendance</SelectItem>
            <SelectItem value="checked_in">Checked-In</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={districtFilter} onValueChange={setDistrictFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="District" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Districts</SelectItem>
            {Array.from(new Set(rows.map((r) => r.district_label || r.district || "Unspecified")))
              .sort()
              .map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button type="submit">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </form>

      <div className="mb-2 text-xs text-muted-foreground flex justify-between items-center">
        <span>Showing {filteredRows.length} of {rows.length}</span>
        {data?.truncated && (
          <span className="text-brand-accent font-medium flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Showing the first 10,000 matching registrations. Refine your filters to view additional records.
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[1280px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Reg. No.</th>
              <th className="p-3">Name</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Gender</th>
              <th className="p-3">DOB</th>
              <th className="p-3">Age</th>
              <th className="p-3">Age Group</th>
              <th className="p-3">Taluka / Zone</th>
              <th className="p-3">Role / Type</th>
              <th className="p-3">Attendance</th>
              <th className="p-3">Partner</th>
              <th className="p-3">Ref By</th>
              <th className="p-3">Referrals</th>
              <th className="p-3">Certificate</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={15} className="p-6 text-center text-muted-foreground">
                  {isFetching ? "Loading…" : "No registrations match."}
                </td>
              </tr>
            )}

            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-3 font-mono font-medium text-brand-primary">{r.registration_number}</td>
                <td className="p-3 font-medium text-foreground">{r.full_name}</td>
                <td className="p-3">{r.mobile}</td>
                <td className="p-3">{r.gender ?? "—"}</td>
                <td className="p-3 text-xs">{r.date_of_birth ?? "—"}</td>
                <td className="p-3">{r.age ?? "—"}</td>
                <td className="p-3 text-xs">{r.age_group ?? "—"}</td>
                <td className="p-3">
                  <div className="font-medium text-foreground">{r.taluka || "—"}</div>
                  {Boolean(r.custom_fields?.zone) && (
                    <div className="text-xs text-muted-foreground">
                      Zone: {String(r.custom_fields?.zone)}
                    </div>
                  )}
                  {r.village && (
                    <div className="text-[11px] text-muted-foreground/80">{r.village}</div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-medium text-foreground">
                    {(typeof r.custom_fields?.participant_type === "string" && r.custom_fields.participant_type) ||
                      r.designation ||
                      "—"}
                  </div>
                  {((r.custom_fields?.participant_type === "Yog Trainer" || r.designation === "Yog Trainer") &&
                    typeof r.custom_fields?.coach_name === "string" &&
                    r.custom_fields.coach_name) ? (
                    <div className="text-xs text-muted-foreground">
                      Coach: {String(r.custom_fields.coach_name)}
                    </div>
                  ) : null}
                  {typeof r.custom_fields?.coordinator_name === "string" &&
                    r.custom_fields.coordinator_name && (
                      <div className="text-xs text-muted-foreground">
                        Coord: {String(r.custom_fields.coordinator_name)}
                      </div>
                    )}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.attendance_status === "Checked-In" || r.attendance_status === "checked_in"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        r.attendance_status === "Checked-In" || r.attendance_status === "checked_in"
                          ? "bg-emerald-600"
                          : "bg-amber-600"
                      }`}
                    />
                    {r.attendance_status === "Checked-In" || r.attendance_status === "checked_in"
                      ? "Checked-In"
                      : "Pending"}
                  </span>
                  {r.check_in_time && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(r.check_in_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </td>
                <td className="p-3 text-xs">{r.partner_name ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{r.referred_by ?? "—"}</td>

                <td className="p-3">{r.referral_count}</td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant={r.certificate_available ? "default" : "outline"}
                    onClick={() => onToggle(r)}
                    disabled={readOnly}
                  >
                    {r.certificate_available ? "Available" : "Mark Available"}
                  </Button>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>
        </TabsContent>
        {isSuper && (
          <TabsContent value="event" className="mt-4">
            {selectedEventId ? (
              <Suspense fallback={<TabFallback />}>
                <EventSettings key={`${selectedEventId}:${settingsTab}`} eventId={selectedEventId} initialTab={settingsTab} />
              </Suspense>
            ) : (
              <NoEventNotice onPick={() => setPickerOpen(true)} />
            )}
          </TabsContent>
        )}
      </Tabs>
      </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "blue" | "green" | "brand-accent";
}) {
  const color =
    accent === "blue"
      ? "text-brand-primary"
      : accent === "green"
        ? "text-brand-success"
        : "text-brand-accent";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function NoEventNotice({ onPick }: { onPick: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
      <p className="mb-4 text-sm text-muted-foreground">
        Please select a event first. Every save/update here targets the currently selected event.
      </p>
      <Button onClick={onPick}>Select Event</Button>
    </div>
  );
}

function EventPickerDialog({
  open,
  onOpenChange,
  eventOptions,
  currentId,
  onSelect,
  forced,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventOptions: Array<{ id: string; label: string }>;
  currentId: string;
  onSelect: (id: string) => void;
  forced: boolean;
}) {
  const [choice, setChoice] = useState<string>(currentId);
  useEffect(() => setChoice(currentId), [currentId, open]);
  return (
    <Dialog open={open} onOpenChange={(v) => (forced && !v ? null : onOpenChange(v))}>
      <DialogContent onInteractOutside={(e) => forced && e.preventDefault()} onEscapeKeyDown={(e) => forced && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Select Event</DialogTitle>
          <DialogDescription>
            Choose the event you want to manage. Every action in the workspace — settings, live link, certificates, partners, broadcasts, notices — will apply only to this event.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1 overflow-auto py-2">
          {eventOptions.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No events available. Create one under the Events tab first.</div>
          )}
          {eventOptions.map((w) => (
            <label
              key={w.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                choice === w.id ? "border-brand-primary bg-brand-primary/5" : "border-border hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="event-pick"
                className="h-4 w-4"
                checked={choice === w.id}
                onChange={() => setChoice(w.id)}
              />
              <span className="font-medium">{w.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          {!forced && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          <Button disabled={!choice} onClick={() => choice && onSelect(choice)}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
