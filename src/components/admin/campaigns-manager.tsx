import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Megaphone, Plus, Pencil, Copy, Archive, Trash2, ExternalLink, Upload,
  CalendarDays, Users, UserCheck, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  adminListCampaigns, adminCreateCampaign, adminUpdateCampaign,
  adminDuplicateCampaign, adminArchiveCampaign, adminDeleteCampaign,
  adminUploadCampaignImage, type Campaign,
} from "@/lib/campaign.functions";
import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

type FormState = {
  id?: string;
  name: string;
  slug: string;
  slogan: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  organizer: string;
  contact_info: string;
  logo_url: string;
  banner_url: string;
  seo_title: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  publish_status: "draft" | "published" | "archived";
  registration_status: "open" | "closed";
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  slogan: "",
  description: "",
  start_date: "",
  end_date: "",
  venue: "",
  organizer: "Gujarat State Yog Board",
  contact_info: "",
  logo_url: "",
  banner_url: "",
  seo_title: "",
  primaryColor: "#9F3138",
  secondaryColor: "#C04A44",
  accentColor: "#F2A81D",
  backgroundColor: "#FFF7F2",
  textColor: "#2B1B1B",
  buttonColor: "#9F3138",
  publish_status: "draft",
  registration_status: "closed",
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const COLOR_FIELDS: Array<{ key: keyof FormState; label: string }> = [
  { key: "primaryColor", label: "Primary Color" },
  { key: "secondaryColor", label: "Secondary Color" },
  { key: "accentColor", label: "Accent Color" },
  { key: "backgroundColor", label: "Background Color" },
  { key: "textColor", label: "Text Color" },
  { key: "buttonColor", label: "Button Color" },
];

/** Direct image upload → `campaign-media` storage bucket (primary path).
 * URL entry remains as a secondary option for externally-hosted assets. */
function ImageUploadField({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const uploadFn = useServerFn(adminUploadCampaignImage);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const res = await uploadFn({
        data: {
          fileName: file.name,
          contentType: file.type || "image/png",
          dataBase64: btoa(binary),
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(res.url);
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="h-9 w-9 rounded border border-border bg-white object-contain p-0.5" />
        ) : null}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-brand-primary hover:bg-muted">
          <Upload className="h-4 w-4" />
          {busy ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className="flex-1"
          maxLength={500}
        />
      </div>
    </div>
  );
}

/** Campaign-scoped theme preview. Shows how the campaign hero, buttons and
 * sections will look. The GSYB header strip shown here is a static reminder —
 * global branding is NEVER affected by campaign colors. */
function ThemePreview({ f }: { f: FormState }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 bg-card px-3 py-2">
        <img src={BRAND.logoPath} alt="" className="h-7 w-7 object-contain" />
        <div className="leading-tight">
          <div className="text-[11px] font-bold text-brand-primary">{BRAND.nameDisplay}</div>
          <div className="text-[9px] text-muted-foreground">{BRAND.departmentLine}</div>
        </div>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
          Global — never changes
        </span>
      </div>
      <div
        className="px-4 py-6 text-center"
        style={{ background: f.backgroundColor, color: f.textColor }}
      >
        <div
          className="text-lg font-bold"
          style={{ color: f.primaryColor }}
        >
          {f.name || "Campaign Name"}
        </div>
        {f.slogan && (
          <div className="mt-1 text-xs italic" style={{ color: f.textColor }}>
            “{f.slogan}”
          </div>
        )}
        <div className="mt-3 flex justify-center gap-2">
          <span
            className="rounded-md px-4 py-1.5 text-xs font-semibold text-white"
            style={{ background: f.buttonColor }}
          >
            Register Now
          </span>
          <span
            className="rounded-md border px-4 py-1.5 text-xs font-semibold"
            style={{ borderColor: f.secondaryColor, color: f.secondaryColor }}
          >
            View Events
          </span>
        </div>
        <div
          className="mx-auto mt-4 h-1.5 w-24 rounded-full"
          style={{ background: f.accentColor }}
        />
      </div>
    </div>
  );
}

function CampaignForm({ initial, onDone }: { initial: FormState; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(initial);
  const createFn = useServerFn(adminCreateCampaign);
  const updateFn = useServerFn(adminUpdateCampaign);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: f.name,
        slug: f.slug,
        slogan: f.slogan || undefined,
        description: f.description || undefined,
        start_date: f.start_date || undefined,
        end_date: f.end_date || undefined,
        venue: f.venue || undefined,
        organizer: f.organizer || undefined,
        contact_info: f.contact_info || undefined,
        logo_url: f.logo_url || undefined,
        banner_url: f.banner_url || undefined,
        seo_title: f.seo_title || undefined,
        theme: {
          primaryColor: f.primaryColor,
          secondaryColor: f.secondaryColor,
          accentColor: f.accentColor,
          backgroundColor: f.backgroundColor,
          textColor: f.textColor,
          buttonColor: f.buttonColor,
        },
        publish_status: f.publish_status,
        registration_status: f.registration_status,
      };
      if (f.id) {
        return updateFn({ data: { id: f.id, ...payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: (res) => {
      if (res && !res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(f.id ? "Campaign updated" : "Campaign created");
      void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      onDone();
    },
    onError: () => toast.error("Save failed. Please try again."),
  });

  const set = (k: keyof FormState, v: string) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-semibold text-brand-primary">Basic Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Campaign Name *</Label>
            <Input value={f.name} onChange={(e) => { set("name", e.target.value); if (!f.id && !f.slug) set("slug", slugify(e.target.value)); }} placeholder="e.g. Seva Sushasan Abhiyan" maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label>Campaign Slug * (URL)</Label>
            <Input value={f.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="seva-sushasan-abhiyan" maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label>Slogan / Tagline</Label>
            <Input value={f.slogan} onChange={(e) => set("slogan", e.target.value)} placeholder="Transform Your Life Through Yoga" maxLength={240} />
          </div>
          <div className="space-y-1.5">
            <Label>Organizer / Department</Label>
            <Input value={f.organizer} onChange={(e) => set("organizer", e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <Input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Venue (if applicable)</Label>
            <Input value={f.venue} onChange={(e) => set("venue", e.target.value)} maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Information</Label>
            <Input value={f.contact_info} onChange={(e) => set("contact_info", e.target.value)} placeholder="Phone / email shown on the campaign page" maxLength={400} />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Publication Status</Label>
            <Select value={f.publish_status} onValueChange={(v) => set("publish_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Registration Status</Label>
            <Select value={f.registration_status} onValueChange={(v) => set("registration_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Registration Open</SelectItem>
                <SelectItem value="closed">Registration Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>SEO Page Title</Label>
            <Input value={f.seo_title} onChange={(e) => set("seo_title", e.target.value)} maxLength={160} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 font-semibold text-brand-primary">Branding (applies to this campaign only)</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Campaign colors never affect the global Gujarat State Yog Board branding or other campaigns.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageUploadField label="Campaign Logo" value={f.logo_url} onChange={(url) => set("logo_url", url)} />
          <ImageUploadField label="Banner / Hero Image" value={f.banner_url} onChange={(url) => set("banner_url", url)} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={f[key] as string}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-card p-1"
                  aria-label={label}
                />
                <Input value={f[key] as string} onChange={(e) => set(key, e.target.value)} className="font-mono text-sm" maxLength={7} />
              </div>
            </div>
          ))}
        </div>
        <ThemePreview f={f} />
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !f.name || !f.slug}>
          {save.isPending ? "Saving…" : f.id ? "Save Changes" : "Create Campaign"}
        </Button>
      </div>
    </div>
  );
}

export function CampaignsManager({
  onOpenEvents,
  onOpenParticipants,
  onOpenCheckin,
  onOpenCertificates,
}: {
  /** Drill into this campaign's events (Events tab, filtered). */
  onOpenEvents?: (campaignId: string) => void;
  /** Drill into this campaign's participants (Dashboard tab, filtered). */
  onOpenParticipants?: (campaignId: string) => void;
  /** Open the check-in console scoped to the campaign's events. */
  onOpenCheckin?: (campaignId: string) => void;
  /** Drill into this campaign's certificates. */
  onOpenCertificates?: (campaignId: string) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCampaigns);
  const dupFn = useServerFn(adminDuplicateCampaign);
  const archiveFn = useServerFn(adminArchiveCampaign);
  const deleteFn = useServerFn(adminDeleteCampaign);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listFn(),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);

  const campaigns = (data?.ok ? data.campaigns : []) as unknown as Campaign[];

  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      toast.success("Campaign duplicated as a draft");
      void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      toast.success("Campaign archived");
      void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      toast.success("Campaign deleted");
      void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });

  function openCreate() {
    setEditing({ ...EMPTY_FORM });
    setFormOpen(true);
  }
  function openEdit(c: Campaign) {
    setEditing({
      id: c.id,
      name: c.name,
      slug: c.slug,
      slogan: c.slogan ?? "",
      description: c.description ?? "",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      venue: c.venue ?? "",
      organizer: c.organizer ?? "",
      contact_info: c.contact_info ?? "",
      logo_url: c.logo_url ?? "",
      banner_url: c.banner_url ?? "",
      seo_title: c.seo_title ?? "",
      primaryColor: c.theme?.primaryColor ?? "#9F3138",
      secondaryColor: c.theme?.secondaryColor ?? "#C04A44",
      accentColor: c.theme?.accentColor ?? "#F2A81D",
      backgroundColor: c.theme?.backgroundColor ?? "#FFF7F2",
      textColor: c.theme?.textColor ?? "#2B1B1B",
      buttonColor: c.theme?.buttonColor ?? "#9F3138",
      publish_status: c.publish_status,
      registration_status: c.registration_status,
    });
    setFormOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-primary">
            <Megaphone className="h-5 w-5" />
            Campaigns
          </h2>
          <p className="text-xs text-muted-foreground">
            Campaigns are the parent-level entity under the Gujarat State Yog Board — each groups its own
            events, registration form, participants, attendance, certificates and reports.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No campaigns yet. Create the first one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registration</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{c.name}</div>
                    {c.slogan && <div className="text-xs text-muted-foreground">{c.slogan}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.publish_status === "published"
                          ? "rounded-full bg-brand-success/10 px-2 py-0.5 text-xs font-medium text-brand-success"
                          : c.publish_status === "draft"
                            ? "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            : "rounded-full bg-brand-accent/10 px-2 py-0.5 text-xs font-medium text-brand-accent"
                      }
                    >
                      {c.publish_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.registration_status === "open" ? (
                      <span className="font-medium text-brand-success">Open</span>
                    ) : (
                      <span className="text-muted-foreground">Closed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)} title="Edit campaign">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {c.publish_status !== "archived" && (
                        <Link to="/campaigns/$slug" params={{ slug: c.slug }} target="_blank">
                          <Button size="sm" variant="ghost" title="View public campaign page">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {onOpenEvents && (
                        <Button size="sm" variant="ghost" title="Events under this campaign" onClick={() => onOpenEvents(c.id)}>
                          <CalendarDays className="h-4 w-4" />
                        </Button>
                      )}
                      {onOpenParticipants && (
                        <Button size="sm" variant="ghost" title="Participants (registrations)" onClick={() => onOpenParticipants(c.id)}>
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                      {onOpenCheckin && (
                        <Button size="sm" variant="ghost" title="Check-In / Attendance" onClick={() => onOpenCheckin(c.id)}>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {onOpenCertificates && (
                        <Button size="sm" variant="ghost" title="Certificates" onClick={() => onOpenCertificates(c.id)}>
                          <Award className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost" title="Duplicate campaign"
                        onClick={() => dup.mutate(c.id)} disabled={dup.isPending}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {c.publish_status !== "archived" && (
                        <Button
                          size="sm" variant="ghost" title="Archive campaign"
                          onClick={() => { if (confirm(`Archive "${c.name}"?`)) archive.mutate(c.id); }}
                          disabled={archive.isPending}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost" title="Delete (only when empty)"
                        onClick={() => {
                          if (confirm(`Delete "${c.name}"? Only campaigns with no events or registrations can be deleted.`))
                            del.mutate(c.id);
                        }}
                        disabled={del.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <CampaignForm initial={editing} onDone={() => setFormOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
