import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  partnerList,
  partnerStats,
  partnerRegistrations,
} from "@/lib/partner.functions";
import { Download, FileText, Search } from "lucide-react";
import jsPDF from "jspdf";

type PartnerLite = { id: string; slug: string; partner_name: string; status: string };
type Reg = {
  id: string;
  registration_number: string;
  full_name: string;
  mobile: string;
  gender: string | null;
  date_of_birth: string | null;
  age: number | null;
  age_group: string | null;
  district: string | null;
  taluka: string | null;
  partner_name: string | null;
  created_at: string;
};

export function PartnerDashboard({ eventId }: { eventId?: string }) {
  const list = useServerFn(partnerList);
  const stats = useServerFn(partnerStats);
  const regs = useServerFn(partnerRegistrations);

  const { data: listData } = useQuery({
    queryKey: ["partner-list-lite", eventId ?? "all"],
    queryFn: () => list({ data: { event_id: eventId } }),
    refetchInterval: 15_000,
  });
  const partners: PartnerLite[] = listData?.ok
    ? (listData.rows as PartnerLite[])
    : [];

  const [selected, setSelected] = useState<string>("");
  // Switching events must drop the previously selected partner, otherwise a
  // partner id from another event stays selected and its panel keeps showing.
  useEffect(() => {
    setSelected("");
  }, [eventId]);
  useEffect(() => {
    if (!selected && partners.length > 0) setSelected(partners[0].id);
  }, [partners, selected]);

  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState("all");

  const { data: sData } = useQuery({
    queryKey: ["partner-stats", eventId ?? "all", selected],
    queryFn: () => stats({ data: { id: selected } }),
    enabled: !!selected,
    refetchInterval: 10_000,
  });
  const s = sData?.ok ? sData : null;

  const { data: rData, isFetching } = useQuery({
    queryKey: ["partner-regs", eventId ?? "all", selected, applied],
    queryFn: () => regs({ data: { id: selected, search: applied } }),
    enabled: !!selected,
    refetchInterval: 15_000,
  });
  const rows: Reg[] = rData?.ok ? (rData.rows as Reg[]) : [];

  useEffect(() => {
    if (rData && !rData.ok) toast.error(rData.error);
  }, [rData]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (genderFilter !== "all" && (r.gender ?? "Unspecified") !== genderFilter) return false;
        if (ageGroupFilter !== "all" && (r.age_group ?? "Unspecified") !== ageGroupFilter) return false;
        return true;
      }),
    [rows, genderFilter, ageGroupFilter],
  );

  const partnerName = partners.find((p) => p.id === selected)?.partner_name ?? "Partner";

  function exportCSV() {
    const source = filteredRows;
    if (!source.length) return;
    const headers = [
      "Registration Number", "Name", "Mobile", "Partner", "District", "Taluka",
      "Gender", "Age", "Registration Date",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const r of source) {
      lines.push([
        r.registration_number, r.full_name, r.mobile, r.partner_name ?? "",
        r.district ?? "", r.taluka ?? "", r.gender ?? "", r.age ?? "",
        new Date(r.created_at).toLocaleString("en-IN"),
      ].map(esc).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partner-${partnerName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const source = filteredRows;
    if (!source.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Partner Registrations — ${partnerName}`, 14, 14);
    doc.setFontSize(9);
    const headers = ["Reg No", "Name", "Mobile", "District", "Taluka", "Gender", "Age", "Date"];
    let y = 24;
    doc.text(headers.join(" | "), 14, y);
    y += 6;
    for (const r of source) {
      if (y > 195) {
        doc.addPage();
        y = 14;
      }
      const row = [
        r.registration_number, r.full_name.slice(0, 24), r.mobile,
        (r.district ?? "").slice(0, 12), (r.taluka ?? "").slice(0, 12),
        r.gender ?? "", r.age ?? "",
        new Date(r.created_at).toLocaleDateString("en-IN"),
      ].join(" | ");
      doc.text(row, 14, y);
      y += 5;
    }
    doc.save(`partner-${partnerName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-primary">Partner Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Registrations from a specific partner link.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select partner…" />
            </SelectTrigger>
            <SelectContent>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.partner_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} disabled={!filteredRows.length}>
            <Download className="mr-2 h-4 w-4" />CSV / Excel
          </Button>
          <Button variant="outline" onClick={exportPDF} disabled={!filteredRows.length}>
            <FileText className="mr-2 h-4 w-4" />PDF
          </Button>
        </div>
      </div>

      {!selected && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Add a partner to view their dashboard.
        </div>
      )}

      {selected && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <Stat label="Total" value={s?.total ?? 0} />
            <Stat label="Today" value={s?.today ?? 0} />
            <Stat label="Male" value={s?.byGender?.Male ?? 0} />
            <Stat label="Female" value={s?.byGender?.Female ?? 0} />
            <Stat label="Below 18" value={s?.byAgeGroup?.["Below 18"] ?? 0} />
            <Stat label="18–35" value={s?.byAgeGroup?.["18-35"] ?? 0} />
            <Stat label="36+" value={(s?.byAgeGroup?.["36-50"] ?? 0) + (s?.byAgeGroup?.["Above 50"] ?? 0)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 font-semibold text-brand-primary">Gender</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={["Male", "Female", "Other", "Unspecified"]
                        .map((k) => ({ name: k, value: s?.byGender?.[k] ?? 0 }))
                        .filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      label
                    >
                      {["#1e40af", "#f97316", "#16a34a", "#94a3b8"].map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 font-semibold text-brand-primary">Age Group</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={["Below 18", "18-35", "36-50", "Above 50"].map((k) => ({
                    name: k, value: s?.byAgeGroup?.[k] ?? 0,
                  }))}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1e40af" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); setApplied(search); }}
            className="flex flex-wrap gap-2"
          >
            <Input
              className="min-w-[220px] flex-1"
              placeholder="Search name, mobile, reg no."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
                <SelectItem value="Unspecified">Unspecified</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ages</SelectItem>
                <SelectItem value="Below 18">Below 18</SelectItem>
                <SelectItem value="18-35">18–35</SelectItem>
                <SelectItem value="36-50">36–50</SelectItem>
                <SelectItem value="Above 50">Above 50</SelectItem>
                <SelectItem value="Unspecified">Unspecified</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit"><Search className="mr-2 h-4 w-4" />Search</Button>
          </form>

          <div className="text-xs text-muted-foreground">
            Showing {filteredRows.length} of {rows.length}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Reg. No.</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Age</th>
                  <th className="p-3">District / Taluka</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                    {isFetching ? "Loading…" : "No registrations."}
                  </td></tr>
                )}
                {filteredRows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-3 font-mono text-brand-primary">{r.registration_number}</td>
                    <td className="p-3">{r.full_name}</td>
                    <td className="p-3">{r.mobile}</td>
                    <td className="p-3">{r.gender ?? "—"}</td>
                    <td className="p-3">{r.age ?? "—"}</td>
                    <td className="p-3">
                      {r.district ?? "—"}
                      {r.taluka && <div className="text-xs text-muted-foreground">{r.taluka}</div>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-brand-primary">{value}</div>
    </div>
  );
}
