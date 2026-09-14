import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateEventQueries } from "@/lib/query-cache";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminGetEventConfig,
  adminUpdateEventSection,
} from "@/lib/event.functions";
import {
  defaultCertificateTemplate,
  mergeConfig,
  normalizeCertificateElement,
  type CertificateElement,
  type CertificateElementType,
  type CertificateTemplate,
  type EventCertificate,
  type EventConfig,
} from "@/lib/event-config";
import { Upload, Save } from "lucide-react";

const FONT_FAMILIES = [
  "Georgia, serif",
  "Times New Roman, serif",
  "Garamond, serif",
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "Verdana, sans-serif",
  "Tahoma, sans-serif",
  "Courier New, monospace",
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function getEl(tpl: CertificateTemplate, type: CertificateElementType, defaults?: Partial<CertificateElement>): CertificateElement {
  const found = tpl.elements.find((e) => e.type === type);
  if (found) return found;
  return normalizeCertificateElement({
    key: `el_${type}`,
    type,
    ...defaults,
  } as Partial<CertificateElement> & { key: string; type: CertificateElementType });
}

function upsertEl(tpl: CertificateTemplate, el: CertificateElement): CertificateTemplate {
  const others = tpl.elements.filter((e) => e.type !== el.type);
  return { ...tpl, elements: [...others, el] };
}

function removeEl(tpl: CertificateTemplate, type: CertificateElementType): CertificateTemplate {
  return { ...tpl, elements: tpl.elements.filter((e) => e.type !== type) };
}

export function CertificateSimple({ eventId }: { eventId: string }) {
  const load = useServerFn(adminGetEventConfig);
  const save = useServerFn(adminUpdateEventSection);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    // Strictly event-scoped: never fall back to the "active" event, which
    // would let one event's config be cached under a shared key.
    queryKey: ["admin-event-config", eventId],
    queryFn: () => load({ data: { event_id: eventId } }),
    enabled: !!eventId,
  });

  const [cert, setCert] = useState<EventCertificate | null>(null);
  const [id, setId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.ok || !data.config) return;
    const raw = data.config as unknown as Partial<EventConfig> & { id: string };
    const cfg = mergeConfig(raw);
    setId(raw.id);
    setCert(cfg.certificate);
  }, [data]);

  if (isLoading || !cert) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const template =
    cert.templates.find((t) => t.id === cert.active_template_id) ??
    cert.templates[0] ??
    defaultCertificateTemplate();

  const nameEl = getEl(template, "participant_name", {
    x: 50, y: 45, width: 70, font_size: 56, font_weight: "700",
    color: "#0b3b8f", align: "center",
  });
  const regEl = template.elements.find((e) => e.type === "registration_number");

  function updateTemplate(next: CertificateTemplate) {
    if (!cert) return;
    const templates = cert.templates.map((t) => (t.id === next.id ? next : t));
    setCert({ ...cert, templates });
  }

  async function onSave() {
    if (!cert) return;
    setSaving(true);
    try {
      const res = await save({ data: { id, section: "certificate", value: cert as unknown as Record<string, unknown> } });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Certificate saved");
        invalidateEventQueries(qc, id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function onUploadBackground(f: File) {
    const url = await readFileAsDataUrl(f);
    updateTemplate({ ...template, background_url: url });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-brand-primary">Certificate</h3>
            <p className="text-sm text-muted-foreground">
              Upload a ready-made certificate image and position the participant name.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm">Enable</Label>
            <Switch
              checked={cert.enabled}
              onCheckedChange={(b) => setCert({ ...cert, enabled: b })}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <Panel title="Certificate Background">
            <div className="space-y-2">
              <Label>Upload Background (PNG/JPG)</Label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                <span>Choose an image…</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadBackground(f);
                  }}
                />
              </label>
              {template.background_url && (
                <Button variant="outline" size="sm" onClick={() => updateTemplate({ ...template, background_url: "" })}>
                  Remove Background
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Canvas Width (px)</Label>
                <Input type="number" value={template.canvas_width}
                  onChange={(e) => updateTemplate({ ...template, canvas_width: Number(e.target.value) || 1200 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Canvas Height (px)</Label>
                <Input type="number" value={template.canvas_height}
                  onChange={(e) => updateTemplate({ ...template, canvas_height: Number(e.target.value) || 848 })}
                />
              </div>
            </div>
          </Panel>

          <ElementControls
            title="Participant Name (required)"
            el={nameEl}
            canRemove={false}
            onChange={(next) => updateTemplate(upsertEl({ ...template, elements: template.elements.filter((e) => e.type !== "participant_name") }, next))}
          />

          <ElementControls
            title="Registration Number (optional)"
            el={
              regEl ?? normalizeCertificateElement({
                key: "el_reg", type: "registration_number",
                x: 50, y: 58, width: 40, font_size: 22, font_weight: "500",
                color: "#334155", align: "center", enabled: false,
              } as Partial<CertificateElement> & { key: string; type: CertificateElementType })
            }
            canRemove={!!regEl}
            onChange={(next) => updateTemplate(upsertEl(template, next))}
            onRemove={() => updateTemplate(removeEl(template, "registration_number"))}
          />

          <Button onClick={onSave} disabled={saving} className="w-full">
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save Certificate Settings"}
          </Button>
        </div>

        {/* Preview */}
        <div>
          <div className="mb-2 text-sm font-medium text-muted-foreground">Live Preview</div>
          <div className="overflow-auto rounded-xl border border-border bg-white p-3 shadow-sm">
            <Preview template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ElementControls({
  title, el, canRemove, onChange, onRemove,
}: {
  title: string;
  el: CertificateElement;
  canRemove: boolean;
  onChange: (el: CertificateElement) => void;
  onRemove?: () => void;
}) {
  return (
    <Panel title={title}>
      <div className="flex items-center justify-between">
        <Label className="text-sm">Enable on certificate</Label>
        <Switch checked={el.enabled} onCheckedChange={(b) => onChange({ ...el, enabled: b })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Position X (%)</Label>
          <Input type="number" min={0} max={100} value={el.x}
            onChange={(e) => onChange({ ...el, x: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Position Y (%)</Label>
          <Input type="number" min={0} max={100} value={el.y}
            onChange={(e) => onChange({ ...el, y: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Font Family</Label>
        <Select value={el.font_family} onValueChange={(v) => onChange({ ...el, font_family: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f.split(",")[0]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Font Size (px)</Label>
          <Input type="number" min={8} max={200} value={el.font_size}
            onChange={(e) => onChange({ ...el, font_size: Number(e.target.value) || 24 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Font Color</Label>
          <Input type="color" value={el.color}
            onChange={(e) => onChange({ ...el, color: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-md border border-border p-2">
          <Label className="text-sm">Bold</Label>
          <Switch
            checked={el.font_weight === "700"}
            onCheckedChange={(b) => onChange({ ...el, font_weight: b ? "700" : "400" })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alignment</Label>
          <Select value={el.align} onValueChange={(v) => onChange({ ...el, align: v as "left" | "center" | "right" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Text Box Width (% of canvas)</Label>
        <Input type="number" min={10} max={100} value={el.width}
          onChange={(e) => onChange({ ...el, width: Number(e.target.value) || 60 })}
        />
      </div>
      {canRemove && onRemove && (
        <Button variant="outline" size="sm" onClick={onRemove}>Remove from certificate</Button>
      )}
    </Panel>
  );
}

function Preview({ template }: { template: CertificateTemplate }) {
  // Scale to fit ~700px wide preview
  const targetWidth = 700;
  const scale = Math.min(1, targetWidth / template.canvas_width);
  const sample: Record<string, string> = {
    participant_name: "Ramesh Kumar Patel",
    registration_number: "SYBJND000123",
  };
  return (
    <div style={{ width: template.canvas_width * scale, height: template.canvas_height * scale, position: "relative" }}>
      <div style={{
        transform: `scale(${scale})`, transformOrigin: "top left",
        width: template.canvas_width, height: template.canvas_height,
        position: "relative", background: "#fff", overflow: "hidden",
      }}>
        {template.background_url && (
          <img src={template.background_url} alt="" crossOrigin="anonymous"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {template.elements.filter((e) => e.enabled && (e.type === "participant_name" || e.type === "registration_number")).map((el) => {
          const widthPx = (el.width / 100) * template.canvas_width;
          return (
            <div key={el.key} style={{
              position: "absolute",
              left: `${el.x}%`, top: `${el.y}%`,
              width: widthPx,
              transform: "translate(-50%, -50%)",
              textAlign: el.align,
              fontFamily: el.font_family,
              fontWeight: el.font_weight,
              fontSize: el.font_size,
              color: el.color,
            }}>
              {sample[el.type] ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
