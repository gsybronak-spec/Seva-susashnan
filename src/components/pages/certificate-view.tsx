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
      event_completed?: boolean;
      joined?: boolean;
      eligible: boolean;
      certificate_enabled: boolean;
      issue: { certificate_number: string; status: string; issued_at: string | null } | null;
      render_payload?: {
        participant_name: string;
        registration_number: string;
        certificate_number: string;
        issued_at: string | null;
        general: any;
        certificate: any;
        template: any;
      } | null;
    }
  | { ok: false; error: string };

export type CertificateViewProps = {
  eventSlug?: string;
};

function formatDate(dateISO: string | null): string {
  if (!dateISO) return "";
  const d = new Date(dateISO.length <= 10 ? dateISO + "T00:00:00" : dateISO);
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

const TEXT_ELEMENT_TYPES = new Set([
  "participant_name",
  "registration_number",
  "certificate_number",
  "event_title",
  "event_theme",
  "event_date",
  "issue_date",
  "organization_name",
  "custom_text",
]);

function valueForElement(el: any, data: CertificateRenderData): string {
  switch (el.type) {
    case "participant_name": return data.participant_name;
    case "registration_number": return data.registration_number;
    case "certificate_number": return data.certificate_number;
    case "event_title": return data.general.title;
    case "event_theme": return data.general.theme;
    case "event_date": return formatDate(data.general.event_date);
    case "issue_date": return formatDate(data.issued_at ?? new Date().toISOString());
    case "organization_name": return data.certificate.organization_name;
    case "custom_text": return el.text ?? "";
    default: return "";
  }
}

async function renderCertificateCanvas(data: CertificateRenderData): Promise<string> {
  const { template } = data;

  // 1. Wait for document fonts and explicit font loads
  if (typeof document !== "undefined" && "fonts" in document) {
    await document.fonts.ready;
    for (const el of template.elements) {
      if (el.enabled && el.font_family) {
        try {
          await document.fonts.load(`${el.font_weight || "400"} 24px "${el.font_family}"`);
        } catch {
          // ignore local or non-standard fonts
        }
      }
    }
    await document.fonts.ready;
  }

  // 2. Load background image and await decode
  let bgImg: HTMLImageElement | null = null;
  if (template.background_url) {
    bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      if (!bgImg) return resolve();
      bgImg.onload = () => resolve();
      bgImg.onerror = () => reject(new Error("Background image could not be loaded."));
      bgImg.src = template.background_url;
      if (bgImg.complete) resolve();
    });
    if ("decode" in bgImg) {
      await bgImg.decode().catch(() => {});
    }
  }

  // 3. Setup 2x canvas for crisp print-grade resolution (2400x1696)
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = template.canvas_width * scale;
  canvas.height = template.canvas_height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context.");

  // Fill base white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw background image
  if (bgImg && bgImg.naturalWidth > 0) {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
  }

  // Draw text elements strictly following template layout
  for (const el of template.elements) {
    if (!el.enabled || !TEXT_ELEMENT_TYPES.has(el.type)) continue;
    const value = valueForElement(el, data);
    if (!value) continue;

    const centerX = (el.x / 100) * canvas.width;
    const centerY = (el.y / 100) * canvas.height;
    const elWidth = (el.width / 100) * canvas.width;
    const fontSize = (el.font_size || 36) * scale;

    ctx.save();
    ctx.translate(centerX, centerY);
    if (el.rotation) {
      ctx.rotate((el.rotation * Math.PI) / 180);
    }
    ctx.globalAlpha = typeof el.opacity === "number" ? el.opacity : 1;
    ctx.fillStyle = el.color || "#0f172a";
    ctx.font = `${el.font_weight || "400"} ${fontSize}px ${el.font_family || "Noto Sans, sans-serif"}`;
    ctx.textBaseline = "middle";

    if (el.letter_spacing && "letterSpacing" in ctx) {
      (ctx as any).letterSpacing = `${el.letter_spacing * scale}px`;
    }

    let drawX = 0;
    if (el.align === "left") {
      ctx.textAlign = "left";
      drawX = -elWidth / 2;
    } else if (el.align === "right") {
      ctx.textAlign = "right";
      drawX = elWidth / 2;
    } else {
      ctx.textAlign = "center";
      drawX = 0;
    }

    const lines = value.split("\n");
    const lineHeightPx = fontSize * (el.line_height || 1.2);
    const startY = -((lines.length - 1) * lineHeightPx) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], drawX, startY + i * lineHeightPx);
    }

    ctx.restore();
  }

  return canvas.toDataURL("image/jpeg", 0.90);
}

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
  const cachedJpegRef = useRef<string | null>(null);

  const lookup = useServerFn(certificateStatus);
  const loadRender = useServerFn(getCertificateRenderData);
  const certRef = useRef<HTMLDivElement>(null);

  // Clear cached raster when certificate changes
  useEffect(() => {
    cachedJpegRef.current = null;
  }, [render?.certificate_number]);

  async function warmCertificateAssets(data: CertificateRenderData) {
    try {
      const jpeg = await renderCertificateCanvas(data);
      cachedJpegRef.current = jpeg;
    } catch {
      // Ignore background warming errors; on-demand generator will handle
    }
  }

  async function getCertificateJpeg(): Promise<string | null> {
    if (cachedJpegRef.current) return cachedJpegRef.current;
    if (!render) return null;
    try {
      const dataUrl = await renderCertificateCanvas(render);
      cachedJpegRef.current = dataUrl;
      return dataUrl;
    } catch (canvasErr) {
      console.warn("Direct canvas render failed, falling back to html-to-image:", canvasErr);
      if (!certRef.current) return null;
      const { toJpeg } = await import("html-to-image");
      const fallbackUrl = await toJpeg(certRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        quality: 0.9,
      });
      cachedJpegRef.current = fallbackUrl;
      return fallbackUrl;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mob = mobile.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(mob)) { toast.error("Enter a valid 10-digit mobile number."); return; }
    setLoading(true); setStatus(null); setRender(null); cachedJpegRef.current = null;
    try {
      const res = (await withTimeout(
        lookup({ data: { mobile: mob, district_slug: eventSlug } }) as Promise<StatusResult>,
        CERTIFICATE_LOOKUP_TIMEOUT_MS,
        "Certificate search took too long. Please try again.",
      )) as StatusResult;
      setStatus(res);
      if (res.ok && res.issue && (res.issue.status === "issued" || res.issue.status === "approved")) {
        // Fast-path: single-roundtrip render_payload returned directly from certificateStatus
        if (res.render_payload) {
          const r = res.render_payload;
          const renderData: CertificateRenderData = {
            participant_name: r.participant_name,
            registration_number: r.registration_number,
            certificate_number: r.certificate_number,
            issued_at: r.issued_at,
            general: r.general,
            certificate: r.certificate,
            template: r.template,
            verifyUrl: `${window.location.origin}/verify/${r.certificate_number}`,
          };
          setRender(renderData);
          void warmCertificateAssets(renderData);
        } else {
          // Secondary fallback roundtrip if render_payload is not provided
          setRendering(true);
          try {
            const r = await withTimeout(
              loadRender({ data: { certificate_number: res.issue.certificate_number } }),
              CERTIFICATE_RENDER_TIMEOUT_MS,
              "Certificate preview took too long. Please try again.",
            );
            if (r.ok) {
              const renderData: CertificateRenderData = {
                participant_name: r.participant_name,
                registration_number: r.registration_number,
                certificate_number: r.certificate_number,
                issued_at: r.issued_at,
                general: r.general,
                certificate: r.certificate,
                template: r.template,
                verifyUrl: `${window.location.origin}/verify/${r.certificate_number}`,
              };
              setRender(renderData);
              void warmCertificateAssets(renderData);
            } else {
              toast.error(r.error || "Certificate preview is not available.");
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Certificate preview failed.");
          } finally {
            setRendering(false);
          }
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

  async function downloadPdf() {
    if (!render) return;
    try {
      const dataUrl = await getCertificateJpeg();
      if (!dataUrl) return;
      const { default: JsPDF } = await import("jspdf");
      const w = render.template.canvas_width;
      const h = render.template.canvas_height;
      const pdf = new JsPDF({
        orientation: w >= h ? "landscape" : "portrait",
        unit: "px",
        format: [w, h],
      });
      pdf.addImage(dataUrl, "JPEG", 0, 0, w, h);
      pdf.save(`${render.certificate_number}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate PDF.");
    }
  }

  async function downloadJpg() {
    if (!render) return;
    try {
      const dataUrl = await getCertificateJpeg();
      if (!dataUrl) return;
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
                પ્રમાણપત્ર સેવા હાલમાં ઉપલબ્ધ નથી.
              </StatusMessage>
            )}

            {status.certificate_enabled && !status.eligible && (
              <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50/90 p-5 sm:p-6 text-center shadow-xs space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="text-lg font-bold text-amber-950">પ્રમાણપત્ર હાલમાં ઉપલબ્ધ નથી.</div>
                <div className="text-sm font-medium text-amber-900 leading-relaxed max-w-md mx-auto">
                  યોગ શિબિર પૂર્ણ થયા બાદ પ્રમાણપત્ર ડાઉનલોડ કરી શકાશે.
                </div>
              </div>
            )}

            {status.eligible && (status.issue?.status === "issued" || status.issue?.status === "approved") && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-center">
                  <div className="text-lg font-bold text-emerald-950">તમારું પ્રમાણપત્ર તૈયાર છે</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Certificate No. <span className="font-mono">{status.issue.certificate_number}</span></span>
                  </div>
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
