import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
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
  adminListCertificates,
  adminApproveCertificate,
  adminRejectCertificate,
  adminRegenerateCertificate,
  adminBulkIssueCertificates,
  getCertificateRenderData,
} from "@/lib/certificate.functions";
import { CertificateRender, type CertificateRenderData } from "@/components/certificate-render";
import {
  Award,
  Check,
  X,
  RefreshCw,
  Download,
  Layers,
  Search,
} from "lucide-react";
import { invalidateEventQueries } from "@/lib/query-cache";

type Row = {
  id: string;
  registration_number: string;
  full_name: string;
  mobile: string;
  certificate_number: string;
  status: "pending" | "approved" | "issued" | "rejected";
  attendance_pct: number | null;
  issued_at: string | null;
  created_at: string;
};

export function CertificateManager({ eventId }: { eventId?: string }) {
  const list = useServerFn(adminListCertificates);
  const approveFn = useServerFn(adminApproveCertificate);
  const rejectFn = useServerFn(adminRejectCertificate);
  const regenFn = useServerFn(adminRegenerateCertificate);
  const bulkFn = useServerFn(adminBulkIssueCertificates);
  const loadRender = useServerFn(getCertificateRenderData);
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "issued" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // hidden render surface for PDF export
  const [renderData, setRenderData] = useState<CertificateRenderData | null>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-certificates", statusFilter, applied, eventId ?? "all"],
    queryFn: () => list({ data: { status: statusFilter, search: applied, event_id: eventId } }),
    refetchInterval: 15_000,
  });

  const rows: Row[] = useMemo(
    () => (data?.ok ? (data.rows as unknown as Row[]) : []),
    [data],
  );

  async function onApprove(id: string) {
    const r = await approveFn({ data: { id } });
    if (!r.ok) return toast.error(r.error);
    invalidateEventQueries(qc, eventId);
    toast.success("Approved");
  }
  async function onReject(id: string) {
    const reason = window.prompt("Reason for rejection?") ?? undefined;
    const r = await rejectFn({ data: { id, reason } });
    if (!r.ok) return toast.error(r.error);
    invalidateEventQueries(qc, eventId);
    toast.success("Rejected");
  }
  async function onRegenerate(id: string) {
    if (!confirm("Assign a new certificate number and mark as issued?")) return;
    const r = await regenFn({ data: { id } });
    if (!r.ok) return toast.error(r.error);
    invalidateEventQueries(qc, eventId);
    toast.success(`New number: ${r.certificate_number}`);
  }
  async function onBulk() {
    if (!confirm("Bulk issue certificates for all eligible participants?")) return;
    setBulkBusy(true);
    try {
      const r = await bulkFn({ data: { event_id: eventId } });
      if (!r.ok) return toast.error(r.error);
      invalidateEventQueries(qc, eventId);
    toast.success(`Issued ${r.issued} · Skipped ${r.skipped}`);
    } finally { setBulkBusy(false); }
  }

  async function downloadOne(row: Row) {
    setDownloadingId(row.id);
    try {
      const r = await loadRender({ data: { certificate_number: row.certificate_number } });
      if (!r.ok) { toast.error(r.error); return; }
      setRenderData({
        participant_name: r.participant_name,
        registration_number: r.registration_number,
        certificate_number: r.certificate_number,
        issued_at: r.issued_at,
        general: r.general,
        certificate: r.certificate,
        template: r.template,
        verifyUrl: `${window.location.origin}/verify/${r.certificate_number}`,
      });
      // wait a tick for render + QR
      await new Promise((res) => setTimeout(res, 800));
      if (!hiddenRef.current) return;
      // High-quality JPEG instead of lossless PNG: same pipeline as the public
      // certificate page — PNG-embedded PDFs balloon to ~10-17 MB for
      // photographic backgrounds; JPEG q0.9 keeps text sharp at ~5% of the size.
      const [{ toJpeg }, { default: JsPDF }] = await Promise.all([
        import("html-to-image"), import("jspdf"),
      ]);
      const dataUrl = await toJpeg(hiddenRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff", quality: 0.9 });
      const w = r.template.canvas_width, h = r.template.canvas_height;
      const pdf = new JsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "px", format: [w, h] });
      pdf.addImage(dataUrl, "JPEG", 0, 0, w, h);
      pdf.save(`${row.certificate_number}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
      setRenderData(null);
    }
  }

  async function downloadAllIssued() {
    const issued = rows.filter((r) => r.status === "issued" || r.status === "approved");
    if (!issued.length) return toast.error("No issued certificates.");
    if (!confirm(`Download ${issued.length} certificate PDF(s) sequentially?`)) return;
    for (const row of issued) {
      // eslint-disable-next-line no-await-in-loop
      await downloadOne(row);
    }
    toast.success("Bulk download complete.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand-primary">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Certificate Management</div>
            <div className="text-sm text-muted-foreground">
              Approve pending requests, regenerate, and bulk-issue for the active event.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBulk} disabled={bulkBusy}>
            <Layers className="mr-2 h-4 w-4" /> {bulkBusy ? "Issuing…" : "Bulk Generate"}
          </Button>
          <Button variant="outline" onClick={downloadAllIssued}>
            <Download className="mr-2 h-4 w-4" /> Bulk Download PDFs
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px]">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setApplied(search); }} className="flex flex-1 gap-2">
          <Input placeholder="Search name, mobile, reg. no. or cert. no." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit"><Search className="mr-2 h-4 w-4" /> Search</Button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Certificate No.</th>
              <th className="p-3">Participant</th>
              <th className="p-3">Reg. No.</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Status</th>
              <th className="p-3">Issued</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">
                {isFetching ? "Loading…" : "No certificates yet."}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-3 font-mono text-xs text-brand-primary">{r.certificate_number}</td>
                <td className="p-3">{r.full_name}</td>
                <td className="p-3 font-mono text-xs">{r.registration_number}</td>
                <td className="p-3">{r.mobile}</td>
                <td className="p-3 text-brand-success">✓</td>
                <td className="p-3">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                    r.status === "issued" || r.status === "approved" ? "bg-brand-success/15 text-brand-success"
                    : r.status === "rejected" ? "bg-destructive/15 text-destructive"
                    : "bg-brand-accent/15 text-brand-accent"
                  }`}>{r.status.toUpperCase()}</span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {r.issued_at ? new Date(r.issued_at).toLocaleString("en-IN") : "—"}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="default" onClick={() => onApprove(r.id)}>
                          <Check className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onReject(r.id)}>
                          <X className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onRegenerate(r.id)}>
                      <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
                    </Button>
                    {(r.status === "issued" || r.status === "approved") && (
                      <Button size="sm" variant="outline" onClick={() => downloadOne(r)} disabled={downloadingId === r.id}>
                        <Download className="mr-1 h-3 w-3" /> {downloadingId === r.id ? "…" : "PDF"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Off-screen render surface for PDF export */}
      <div style={{ position: "fixed", left: -99999, top: 0, opacity: 0, pointerEvents: "none" }}>
        {renderData && <CertificateRender ref={hiddenRef} data={renderData} />}
      </div>
    </div>
  );
}
