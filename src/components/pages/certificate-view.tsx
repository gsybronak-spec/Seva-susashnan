import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award, Download, Search, ShieldCheck, Clock, Image as ImageIcon } from "lucide-react";
import { certificateStatus, getCertificateRenderData } from "@/lib/certificate.functions";
import { CertificateRender, type CertificateRenderData } from "@/components/certificate-render";

const CERTIFICATE_LOOKUP_TIMEOUT_MS = 15_000;
const CERTIFICATE_RENDER_TIMEOUT_MS = 20_000;

type StatusResult =
  | { ok: true;
      participant_name: string;
      registration_number: string;
      event_title: string;
      joined: boolean;
      eligible: boolean;
      certificate_enabled: boolean;
      issue: { certificate_number: string; status: string; issued_at: string | null } | null;
    }
  | { ok: false; error: string };

export type CertificateViewProps = {
  eventSlug?: string;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function CertificatePreview({
  render,
  certRef,
}: {
  render: CertificateRenderData;
  certRef: React.RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    function updateScale() {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth - 16;
        const targetScale = Math.min(availableWidth / render.template.canvas_width, 0.55);
        setScale(Math.max(0.15, targetScale));
      }
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [render.template.canvas_width]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center overflow-hidden rounded-xl border border-border bg-slate-50 p-2 shadow-inner"
    >
      <div
        style={{
          width: `${render.template.canvas_width * scale}px`,
          height: `${render.template.canvas_height * scale}px`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: `${render.template.canvas_width}px`,
            height: `${render.template.canvas_height}px`,
          }}
        >
          <CertificateRender ref={certRef} data={render} />
        </div>
      </div>
    </div>
  );
}

export function CertificateView({ eventSlug }: CertificateViewProps) {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [render, setRender] = useState<CertificateRenderData | null>(null);
  const [rendering, setRendering] = useState(false);

  const lookup = useServerFn(certificateStatus);
  const loadRender = useServerFn(getCertificateRenderData);
  const certRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mob = mobile.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(mob)) { toast.error("Enter a valid 10-digit mobile number."); return; }
    setLoading(true); setStatus(null); setRender(null);
    try {
      const res = (await withTimeout(
        lookup({ data: { mobile: mob, district_slug: eventSlug } }) as Promise<StatusResult>,
        CERTIFICATE_LOOKUP_TIMEOUT_MS,
        "Certificate search took too long. Please try again.",
      )) as StatusResult;
      setStatus(res);
      if (res.ok && res.issue && (res.issue.status === "issued" || res.issue.status === "approved")) {
        setRendering(true);
        try {
          const r = await withTimeout(
            loadRender({ data: { certificate_number: res.issue.certificate_number } }),
            CERTIFICATE_RENDER_TIMEOUT_MS,
            "Certificate preview took too long. Please try again.",
          );
          if (r.ok) {
            setRender({
              participant_name: r.participant_name,
              registration_number: r.registration_number,
              certificate_number: r.certificate_number,
              issued_at: r.issued_at,
              general: r.general,
              certificate: r.certificate,
              template: r.template,
              verifyUrl: `${window.location.origin}/verify/${r.certificate_number}`,
            });
          } else {
            toast.error(r.error || "Certificate preview is not available.");
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Certificate preview failed.");
        } finally {
          setRendering(false);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Certificate search failed.";
      setStatus({ ok: false, error: message });
      toast.error(message);
    } finally {
      setRendering(false);
      setLoading(false);
    }
  }

  // High-quality JPEG instead of lossless PNG: a photographic background
  // rasterized at 2x canvas makes PNGs (and PNG-embedded PDFs) ~10-17 MB.
  // JPEG at q0.9 keeps text sharp while cutting the file by ~95%.
  async function generateJpeg(): Promise<string | null> {
    if (!certRef.current) return null;
    const { toJpeg } = await import("html-to-image");
    return toJpeg(certRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
      quality: 0.9,
    });
  }

  async function downloadPdf() {
    if (!render) return;
    try {
      const dataUrl = await generateJpeg();
      if (!dataUrl) return;
      const { default: JsPDF } = await import("jspdf");
      const w = render.template.canvas_width;
      const h = render.template.canvas_height;
      const pdf = new JsPDF({
        orientation: w >= h ? "landscape" : "portrait",
        unit: "px",
        format: [w, h],
      });
      // Embed the JPEG as-is (jsPDF does not recompress it), so the PDF is
      // roughly the size of the JPEG instead of a multi-megabyte PNG raster.
      pdf.addImage(dataUrl, "JPEG", 0, 0, w, h);
      pdf.save(`${render.certificate_number}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate PDF.");
    }
  }

  async function downloadJpg() {
    if (!render || !certRef.current) return;
    try {
      const { toJpeg } = await import("html-to-image");
      const dataUrl = await toJpeg(certRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        quality: 0.88,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${render.certificate_number}.jpg`;
      a.click();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate JPG.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-brand-primary">Download Certificate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your registered mobile number. No registration number needed.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="brand-bar h-1 w-full" />
        <form onSubmit={onSubmit} className="space-y-4 p-6 sm:p-8">
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Registered Mobile Number</Label>
            <Input
              id="mobile"
              inputMode="numeric"
              placeholder="10-digit mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              required
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" className="h-12 w-full" disabled={loading}>
            <Search className="mr-2 h-5 w-5" />
            {loading ? "Searching…" : "Find My Certificate"}
          </Button>
        </form>
      </div>

      {status && !status.ok && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          {status.error}
        </div>
      )}

      {status?.ok && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-brand-primary">
                <Award className="h-7 w-7" />
              </div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Participant</div>
              <div className="text-xl font-semibold text-foreground">{status.participant_name}</div>
              <div className="mt-1 font-mono text-sm text-brand-primary">{status.registration_number}</div>
              <div className="mt-1 text-sm text-muted-foreground">{status.event_title}</div>
            </div>

            {!status.certificate_enabled && (
              <StatusMessage kind="info" icon={<Clock className="h-4 w-4" />}>
                Certificate downloads will open after the event is completed.
              </StatusMessage>
            )}

            {status.certificate_enabled && !status.eligible && (
              <StatusMessage kind="warn" icon={<Award className="h-4 w-4" />}>
                Physical attendance check-in is required to receive this certificate. No verified attendance was recorded for this registration at the event venue.
              </StatusMessage>
            )}            {(status.issue?.status === "issued" || status.issue?.status === "approved") && (
              <div className="mt-6 space-y-4">
                <div className="rounded-md border border-brand-success/40 bg-brand-success/10 p-3 text-center text-sm">
                  <ShieldCheck className="mr-1 inline h-4 w-4 text-brand-success" />
                  Certificate No. <span className="font-mono">{status.issue.certificate_number}</span>
                </div>

                {rendering && <p className="text-center text-sm text-muted-foreground">Preparing certificate…</p>}

                {render && (
                  <>
                    <CertificatePreview render={render} certRef={certRef} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button onClick={downloadPdf} size="lg" className="h-12 w-full">
                        <Download className="mr-2 h-5 w-5" /> Download PDF
                      </Button>
                      <Button onClick={downloadJpg} size="lg" variant="outline" className="h-12 w-full">
                        <ImageIcon className="mr-2 h-5 w-5" /> Download JPG
                      </Button>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      Verify anytime at{" "}
                      <Link to="/verify/$cert" params={{ cert: render.certificate_number }} className="text-brand-primary underline">
                        /verify/{render.certificate_number}
                      </Link>
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusMessage({
  kind, icon, children,
}: { kind: "info" | "warn"; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = kind === "warn"
    ? "border-brand-accent/40 bg-brand-accent/10 text-foreground"
    : "border-border bg-muted/40 text-muted-foreground";
  return (
    <div className={`mt-6 rounded-md border ${cls} p-3 text-center text-sm`}>
      <span className="mr-1 inline-flex align-middle">{icon}</span>
      {children}
    </div>
  );
}
