// Client-safe types + defaults for the events table.

export type EventGeneral = {
  title: string;
  subtitle: string;
  theme: string;
  description: string;
  banner_url: string;
  registration_open_at: string | null;
  registration_close_at: string | null;
  event_date: string | null; // yyyy-mm-dd
  end_date: string | null;     // yyyy-mm-dd (optional; multi-day events)
  start_time: string | null;   // HH:mm
  end_time: string | null;     // HH:mm
  duration_minutes: number;
  speaker_name: string;
  speaker_designation: string;
  event_time?: string | null;
  contact_mobile?: string | null;
  contact_mobiles?: string[];
  registration_mode?: "internal" | "external";
  registration_enabled?: boolean;
  expected_participants?: number;
  level?: "State" | "Municipal" | "District" | string;
};

export type EventFeatures = {
  show_details: boolean;
  registration: boolean;
  live: boolean;
  attendance: boolean;
  certificate: boolean;
  referral: boolean;
  whatsapp: boolean;
  social: boolean;
  countdown: boolean;
  footer: boolean;
  embedded_live: boolean;
  backup_live: boolean;
};

export type EventLive = {
  primary_url: string;
  backup_url: string;
  primary_button_text: string;
  backup_button_text: string;
  enable_primary: boolean;
  enable_backup: boolean;
  enable_embedded: boolean;
  enable_open_youtube: boolean;
  show_like_button: boolean;
  show_chat_button: boolean;
  show_like_confirm: boolean;
};


export type EventAttendance = {
  min_percent: number;
  interval_seconds: number;
  start_buffer_minutes: number;
  end_buffer_minutes: number;
  enable_tracking: boolean;
  enable_report: boolean;
  enable_live_dashboard: boolean;
};

export type CertificateElementType =
  | "participant_name"
  | "registration_number"
  | "certificate_number"
  | "event_title"
  | "event_theme"
  | "event_date"
  | "issue_date"
  | "organization_name"
  | "qr_code"
  | "signature"
  | "custom_text";

export type CertificateElement = {
  key: string;
  type: CertificateElementType;
  label: string;
  enabled: boolean;
  x: number;            // % 0-100
  y: number;            // % 0-100
  width: number;        // % of canvas width
  text?: string;        // for custom_text or overrides
  font_family: string;
  font_size: number;    // px @ baseline 1200 canvas width
  font_weight: string;  // "400" | "600" | "700"
  color: string;
  align: "left" | "center" | "right";
  letter_spacing: number; // px
  line_height: number;    // multiplier
  rotation: number;       // deg
  opacity: number;        // 0-1
  image_url?: string;     // for qr_code / signature (data-url)
};

export type CertificateTemplate = {
  id: string;
  name: string;
  background_url: string;   // data-url or absolute URL
  canvas_width: number;
  canvas_height: number;
  elements: CertificateElement[];
};

export type CertificateNumberFormat = {
  prefix: string;
  year: string;         // "auto" = current year, or literal like "2026"
  sequence_padding: number;
  separator: string;
};

export type EventCertificate = {
  enabled: boolean;
  title: string;
  subtitle: string;
  background_url: string;
  signature_url: string;
  authorized_name: string;
  qr_url: string;
  prefix: string;
  organization_name: string;
  number_format: CertificateNumberFormat;
  approval_mode: "manual" | "automatic";
  attendance_required: boolean;
  verification_text: string;
  templates: CertificateTemplate[];
  active_template_id: string;
};

export type EventReferral = {
  enabled: boolean;
  share_template: string;
};

export type EventWhatsapp = {
  enabled: boolean;
  url: string;
  button_text: string;
};

export type SocialPlatformKey =
  | "facebook"
  | "instagram"
  | "youtube"
  | "telegram"
  | "whatsapp_channel"
  | "twitter"
  | "website";

export type EventSocial = Record<SocialPlatformKey, { enabled: boolean; url: string }>;

export type EventStatusValue = "upcoming" | "live" | "completed";
export type EventStatus = {
  value: EventStatusValue;
  banner_text: string;
  show_banner: boolean;
};

export type EventDemoMode = {
  enabled: boolean;
  dummy_url: string;
  note: string;
};

// ---------- Event coverage (event-first architecture, Phase 1) ----------
export type EventCoverageType = "single" | "zone" | "state";

/**
 * Which districts participate in this event. Belongs to the event itself —
 * never to a global/default district.
 *
 * - single: exactly one district. The effective district is the event's own
 *   `district_id` column (backward compatible with every legacy event).
 * - zone:   an explicit set of allowed districts (district_ids).
 * - state:  State-wide — district_ids: null means "all active districts".
 */
export type EventCoverage = {
  type: EventCoverageType;
  district_ids: string[] | null;
};

/** Lightweight district row exposed to public surfaces (dropdown options). */
export type CoverageDistrict = {
  id: string;
  slug: string;
  name: string;
};

// ---------- Form builder ----------
export type FormFieldType =
  | "text"
  | "textarea"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "multiselect"
  | "number"
  | "date"
  | "time"
  | "email"
  | "phone"
  | "hidden";

export type FormFieldOption = { label: string; value: string };

export type FormFieldValidation = {
  min?: number | null;
  max?: number | null;
  pattern?: string;
  message?: string;
};

// Conditional visibility: field is shown only when ALL rules match.
export type VisibilityOperator = "equals" | "not_equals" | "includes";
export type VisibilityRule = {
  field: string;               // key of the field to check
  operator: VisibilityOperator;
  value: string;
};

export type FormField = {
  key: string;
  type: FormFieldType;
  label: string;
  placeholder: string;
  help: string;
  required: boolean;
  enabled: boolean;
  readonly: boolean;
  unique: boolean;
  hidden: boolean;
  default_value: string;
  order: number;
  options: FormFieldOption[];
  validation: FormFieldValidation;
  visible_if: VisibilityRule[];
  builtin: boolean;
};

export type FormTemplate = {
  id: string;
  name: string;
  fields: FormField[];
};

export type FormVersion = {
  at: string;         // ISO timestamp
  label: string;      // e.g. "Auto-save before publish"
  fields: FormField[];
};

export type EventForm = {
  fields: FormField[];              // currently published fields (live on /register)
  draft: FormField[] | null;        // unpublished draft
  templates: FormTemplate[];        // saved templates
  active_template_id: string;       // id of currently active template
  history: FormVersion[];           // previous published versions (most recent first)
};

export type EventConfig = {
  id: string;
  is_active: boolean;
  /** Owning district id (single-district events; null for zone/state). */
  district_id: string | null;
  /** Physical camp location (dedicated column; Module 18). */
  venue: string | null;
  general: EventGeneral;
  features: EventFeatures;
  live: EventLive;
  attendance: EventAttendance;
  certificate: EventCertificate;
  referral: EventReferral;
  whatsapp: EventWhatsapp;
  social: EventSocial;
  status: EventStatus;
  demo_mode: EventDemoMode;
  coverage: EventCoverage;
  form: EventForm;
  partner_form: EventPartnerForm;
};

// ---------- Partner Registration Form config ----------
export type PartnerFieldKey =
  | "partner_name"
  | "organizations"
  | "contact_person"
  | "mobile"
  | "email"
  | "district";

export type PartnerFieldConfig = {
  visible: boolean;
  required: boolean;
  enabled: boolean;
  label: string;
  placeholder: string;
};

export type EventPartnerForm = {
  fields: Record<PartnerFieldKey, PartnerFieldConfig>;
};

export const PARTNER_FIELD_KEYS: PartnerFieldKey[] = [
  "partner_name",
  "organizations",
  "contact_person",
  "mobile",
  "email",
  "district",
];

export const PARTNER_FIELD_ESSENTIAL: PartnerFieldKey[] = ["partner_name"];

export const DEFAULT_PARTNER_FORM: EventPartnerForm = {
  fields: {
    partner_name:   { visible: true,  required: true,  enabled: true, label: "Partner Name",   placeholder: "Official partner name" },
    organizations:  { visible: true,  required: false, enabled: true, label: "Organisations",  placeholder: "Select one or more organisations" },
    contact_person: { visible: true,  required: false, enabled: true, label: "Contact Person", placeholder: "Full name" },
    mobile:         { visible: true,  required: false, enabled: true, label: "Mobile",          placeholder: "10-digit mobile" },
    email:          { visible: true,  required: false, enabled: true, label: "Email",           placeholder: "name@example.com" },
    district:       { visible: true,  required: false, enabled: true, label: "District",       placeholder: "District" },
  },
};

export function mergePartnerForm(raw: Partial<EventPartnerForm> | null | undefined): EventPartnerForm {
  const savedFields = (raw?.fields ?? {}) as Partial<Record<PartnerFieldKey, Partial<PartnerFieldConfig>>>;
  const out = {} as Record<PartnerFieldKey, PartnerFieldConfig>;
  for (const k of PARTNER_FIELD_KEYS) {
    const def = DEFAULT_PARTNER_FORM.fields[k];
    const s = savedFields[k] ?? {};
    const isEssential = PARTNER_FIELD_ESSENTIAL.includes(k);
    out[k] = {
      visible: isEssential ? true : (s.visible === undefined ? def.visible : !!s.visible),
      required: isEssential ? true : !!s.required,
      enabled: isEssential ? true : s.enabled !== false,
      label: (s.label && String(s.label).trim()) || def.label,
      placeholder: typeof s.placeholder === "string" ? s.placeholder : def.placeholder,
    };
  }
  return { fields: out };
}

export const CERTIFICATE_ELEMENT_LABELS: Record<CertificateElementType, string> = {
  participant_name: "Participant Name",
  registration_number: "Registration Number",
  certificate_number: "Certificate Number",
  event_title: "Event Title",
  event_theme: "Event Theme",
  event_date: "Event Date",
  issue_date: "Issue Date",
  organization_name: "Organization Name",
  qr_code: "QR Code",
  signature: "Signature",
  custom_text: "Custom Text",
};

export const BUILTIN_FIELD_KEYS = [
  "full_name",
  "mobile",
  "email",
  "gender",
  "date_of_birth",
  "district",
  "taluka",
  "organization",
  "designation",
  "ref",
] as const;

export type BuiltinFieldKey = typeof BUILTIN_FIELD_KEYS[number];

// Structurally essential built-ins (full_name, mobile, district).
// These fields are required for participant identification and geographic mapping.
// They must remain enabled, visible, and required.
export const ESSENTIAL_FIELD_KEYS = ["full_name", "mobile", "district"] as const;
export type EssentialFieldKey = typeof ESSENTIAL_FIELD_KEYS[number];

function makeField(partial: Partial<FormField> & Pick<FormField, "key" | "type" | "label" | "order">): FormField {
  return {
    placeholder: "",
    help: "",
    required: false,
    enabled: true,
    readonly: false,
    unique: false,
    hidden: false,
    default_value: "",
    options: [],
    validation: {},
    visible_if: [],
    builtin: false,
    ...partial,
  };
}

export const DEFAULT_FORM_FIELDS: FormField[] = [
  makeField({ key: "full_name", type: "text", label: "Full Name", placeholder: "Your full name", required: true, order: 1, builtin: true }),
  makeField({ key: "mobile", type: "phone", label: "Mobile Number", placeholder: "10-digit mobile", required: true, order: 2, builtin: true }),
  makeField({ key: "email", type: "email", label: "Email (optional)", placeholder: "name@example.com", required: false, order: 3, builtin: true }),
  makeField({ key: "gender", type: "radio", label: "Gender", required: false, order: 4, builtin: true, options: [
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
  ] }),
  makeField({ key: "date_of_birth", type: "date", label: "Date of Birth", required: false, order: 5, builtin: true, help: "Age will be calculated automatically." }),
  makeField({ key: "district", type: "text", label: "District", placeholder: "", required: true, order: 6, builtin: true, readonly: true, default_value: "", help: "District is automatically selected based on the event." }),
  makeField({ key: "taluka", type: "text", label: "Taluka / City", placeholder: "Your taluka or city", required: false, order: 7, builtin: true }),
  makeField({ key: "organization", type: "text", label: "Organization / Centre", placeholder: "Your organization or centre name", required: false, order: 8, builtin: true }),
  makeField({ key: "designation", type: "dropdown", label: "Designation", placeholder: "Select designation", required: true, order: 9, builtin: true, options: [
    { label: "Yog Coach", value: "Yog Coach" },
    { label: "Yog Trainer", value: "Yog Trainer" },
    { label: "Yog Sadhak", value: "Yog Sadhak" },
  ] }),
  makeField({ key: "ref", type: "text", label: "Referral Code (optional)", placeholder: "Enter a referral code from this event", required: false, order: 10, builtin: true }),

];

const DEFAULT_TEMPLATE_ID = "tpl_default";

export const DEFAULT_TEMPLATES: FormTemplate[] = [
  { id: DEFAULT_TEMPLATE_ID, name: "Event Registration (Default)", fields: DEFAULT_FORM_FIELDS },
];

// Legacy default: a event without explicit coverage is a single-district
// event whose district comes from its own district_id column. This keeps
// every existing production event behaving exactly as before.
export const DEFAULT_COVERAGE: EventCoverage = {
  type: "single",
  district_ids: null,
};

export const DEFAULT_CONFIG: EventConfig = {
  id: "",
  is_active: true,
  district_id: null,
  venue: null,
  general: {
    title: "Yog ane Dhyan Shibir",
    subtitle: "Seva Sushasan Abhiyan (Campaign)",
    theme: "Transform Your Life Through Yoga",
    description: "",
    banner_url: "",
    registration_open_at: null,
    registration_close_at: null,
    event_date: null,
    end_date: null,
    start_time: null,
    end_time: null,
    duration_minutes: 60,
    speaker_name: "",
    speaker_designation: "",
  },
  features: {
    show_details: true,
    registration: true,
    live: false,
    attendance: false,
    certificate: false,
    referral: true,
    whatsapp: false,
    social: false,
    countdown: true,
    footer: true,
    embedded_live: true,
    backup_live: false,
  },
  live: {
    primary_url: "",
    backup_url: "",
    primary_button_text: "Join Live Event",
    backup_button_text: "Join Backup Stream",
    enable_primary: true,
    enable_backup: false,
    enable_embedded: true,
    enable_open_youtube: true,
    show_like_button: true,
    show_chat_button: true,
    show_like_confirm: true,

  },
  attendance: {
    min_percent: 70,
    interval_seconds: 30,
    start_buffer_minutes: 5,
    end_buffer_minutes: 5,
    enable_tracking: false,
    enable_report: false,
    enable_live_dashboard: false,
  },
  certificate: {
    enabled: false,
    title: "Certificate of Participation",
    subtitle: "Yog ane Dhyan Shibir",
    background_url: "",
    signature_url: "",
    authorized_name: "",
    qr_url: "",
    prefix: "SYB",
    organization_name: "Gujarat State Yog Board",
    number_format: { prefix: "SYB", year: "auto", sequence_padding: 6, separator: "-" },
    approval_mode: "manual",
    attendance_required: false,
    verification_text: "This certificate is verified by the Gujarat State Yog Board.",
    templates: [defaultCertificateTemplate()],
    active_template_id: "cert_default",
  },
  referral: {
    enabled: true,
    share_template:
      "🧘 Join the Yog ane Dhyan Shibir\nUnder Seva Sushasan Abhiyan — Gujarat State Yog Board\n\n📅 Date: {{Date}}\n🕝 Time: {{Time}}\n🌿 {{Theme}}\n\nRegister Here:\n{{Link}}",
  },
  whatsapp: {
    enabled: false,
    url: "",
    button_text: "Join Our WhatsApp Channel",
  },
  social: {
    facebook: { enabled: false, url: "" },
    instagram: { enabled: false, url: "" },
    youtube: { enabled: false, url: "" },
    telegram: { enabled: false, url: "" },
    whatsapp_channel: { enabled: false, url: "" },
    twitter: { enabled: false, url: "" },
    website: { enabled: false, url: "" },
  },
  status: { value: "upcoming", banner_text: "", show_banner: true },
  demo_mode: {
    enabled: false,
    dummy_url: "",
    note: "",
  },
  coverage: DEFAULT_COVERAGE,
  form: {
    fields: DEFAULT_FORM_FIELDS,
    draft: null,
    templates: DEFAULT_TEMPLATES,
    active_template_id: DEFAULT_TEMPLATE_ID,
    history: [],
  },
  partner_form: DEFAULT_PARTNER_FORM,
};

export type EventSection = keyof Omit<EventConfig, "id" | "is_active">;

// Normalize a possibly-partial field object into a full FormField (fills defaults).
export function normalizeField(f: Partial<FormField> & { key: string }, fallbackOrder = 999): FormField {
  return {
    key: f.key,
    type: (f.type ?? "text") as FormFieldType,
    label: f.label ?? f.key,
    placeholder: f.placeholder ?? "",
    help: f.help ?? "",
    required: !!f.required,
    enabled: f.enabled !== false,
    readonly: !!f.readonly,
    unique: !!f.unique,
    hidden: !!f.hidden,
    default_value: f.default_value ?? "",
    order: typeof f.order === "number" ? f.order : fallbackOrder,
    options: Array.isArray(f.options) ? f.options : [],
    validation: f.validation ?? {},
    visible_if: Array.isArray(f.visible_if) ? f.visible_if : [],
    builtin: !!f.builtin,
  };
}

/**
 * Structural deep copy. Every configuration value handed to a caller must be a
 * private copy: module-level defaults (DEFAULT_CONFIG, DEFAULT_FORM_FIELDS,
 * DEFAULT_TEMPLATES, DEFAULT_PARTNER_FORM) are singletons shared by every
 * event in the process/tab, so returning them by reference lets an in-place
 * edit on event A mutate what event B renders.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Normalize the stored `coverage` JSONB into a valid EventCoverage.
 * Missing/invalid coverage always falls back to "single" so legacy events
 * keep their existing district_id-based behavior.
 *
 * `fallbackDistrictId` is accepted at call sites for clarity (the owning
 * district of a single-district event); it is intentionally NOT folded into
 * the returned object — single events resolve their district via the
 * events.district_id column, never via coverage.district_ids.
 */
export function mergeCoverage(
  raw: unknown,
  _fallbackDistrictId?: string | null,
): EventCoverage {
  void _fallbackDistrictId;
  // Stored JSONB is untyped — normalize defensively.
  const r = (raw ?? {}) as { type?: unknown; district_ids?: unknown };
  const type: EventCoverageType =
    r.type === "zone" || r.type === "state" ? r.type : "single";
  if (type === "single") return { type: "single", district_ids: null };
  const ids = Array.isArray(r.district_ids)
    ? Array.from(
        new Set(
          (r.district_ids as Array<unknown>).filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          ),
        ),
      )
    : null;
  return { type, district_ids: type === "zone" ? ids : null };
}

export function mergeConfig(row: Partial<EventConfig> | null | undefined): EventConfig {
  if (!row) return deepClone(DEFAULT_CONFIG);
  const formRow = (row.form ?? {}) as Partial<EventForm>;
  const mergedFields =
    Array.isArray(formRow.fields) && formRow.fields.length > 0
      ? mergeFormFields(formRow.fields as Partial<FormField>[])
      : deepClone(DEFAULT_FORM_FIELDS);
  const templates =
    Array.isArray(formRow.templates) && formRow.templates.length > 0
      ? formRow.templates.map((t) => ({
          id: t.id ?? `tpl_${Math.random().toString(36).slice(2, 8)}`,
          name: t.name ?? "Untitled",
          fields: mergeFormFields((t.fields ?? []) as Partial<FormField>[]),
        }))
      : deepClone(DEFAULT_TEMPLATES);
  return {
    ...DEFAULT_CONFIG,
    ...row,
    general: { ...DEFAULT_CONFIG.general, ...(row.general ?? {}) },
    features: { ...DEFAULT_CONFIG.features, ...(row.features ?? {}) },
    live: { ...DEFAULT_CONFIG.live, ...(row.live ?? {}) },
    attendance: { ...DEFAULT_CONFIG.attendance, ...(row.attendance ?? {}) },
    certificate: mergeCertificate(row.certificate),
    referral: { ...DEFAULT_CONFIG.referral, ...(row.referral ?? {}) },
    whatsapp: { ...DEFAULT_CONFIG.whatsapp, ...(row.whatsapp ?? {}) },
    social: { ...DEFAULT_CONFIG.social, ...(row.social ?? {}) } as EventSocial,
    status: { ...DEFAULT_CONFIG.status, ...(row.status ?? {}) },
    demo_mode: { ...DEFAULT_CONFIG.demo_mode, ...(row.demo_mode ?? {}) },
    // Coverage lives inside the existing `general` JSONB column (present in
    // every production DB) — NOT a dedicated column that may not exist yet.
    // Legacy rows without general.coverage fall back to single-district.
    coverage: mergeCoverage(
      ((row.general as { coverage?: unknown } | null)?.coverage ??
        (row as { coverage?: unknown }).coverage),
      (row.district_id as string | null) ?? null,
    ),
    form: {
      fields: mergedFields,
      draft: Array.isArray(formRow.draft)
        ? mergeFormFields(formRow.draft as Partial<FormField>[])
        : null,
      templates,
      active_template_id: formRow.active_template_id ?? templates[0]?.id ?? DEFAULT_TEMPLATE_ID,
      history: Array.isArray(formRow.history)
        ? formRow.history.slice(0, 20).map((h) => ({
            at: h.at ?? new Date().toISOString(),
            label: h.label ?? "",
            fields: mergeFormFields((h.fields ?? []) as Partial<FormField>[]),
          }))
        : [],
    },
    partner_form: mergePartnerForm(row.partner_form as Partial<EventPartnerForm> | undefined),
  };
}

function mergeFormFields(saved: Partial<FormField>[]): FormField[] {
  const byKey = new Map<string, FormField>();
  for (const f of saved) {
    if (!f?.key) continue;
    byKey.set(f.key, normalizeField(f as Partial<FormField> & { key: string }, byKey.size + 1));
  }

  const isCustomEventConfig = byKey.size > 0;
  const essentialSet = new Set<string>(ESSENTIAL_FIELD_KEYS);

  for (const def of DEFAULT_FORM_FIELDS) {
    if (!byKey.has(def.key)) {
      // For events that have explicitly configured their own fields, only backfill essential identification fields
      if (!isCustomEventConfig || essentialSet.has(def.key)) {
        byKey.set(def.key, deepClone(def));
      }
    } else {
      const cur = byKey.get(def.key)!;
      const isEss = essentialSet.has(def.key);
      byKey.set(def.key, {
        ...cur,
        builtin: true,
        enabled: isEss ? true : cur.enabled,
        hidden: isEss ? false : cur.hidden,
        required: isEss ? true : cur.required,
        options: cur.options?.length ? cur.options : deepClone(def.options),
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.order - b.order);
}

export function formatShareMessage(
  template: string,
  data: { title: string; theme: string; date: string; time: string; link: string },
) {
  return template
    .replace(/\{\{\s*Title\s*\}\}/gi, data.title)
    .replace(/\{\{\s*Theme\s*\}\}/gi, data.theme)
    .replace(/\{\{\s*Date\s*\}\}/gi, data.date)
    .replace(/\{\{\s*Time\s*\}\}/gi, data.time)
    .replace(/\{\{\s*Link\s*\}\}/gi, data.link);
}

export function formatEventDate(dateISO: string | null): string {
  if (!dateISO) return "";
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? "";
}

// ---------- Certificate designer ----------



function makeElement(
  key: string,
  type: CertificateElementType,
  partial: Partial<CertificateElement> = {},
): CertificateElement {
  return {
    key,
    type,
    label: CERTIFICATE_ELEMENT_LABELS[type],
    enabled: true,
    x: 50,
    y: 50,
    width: type === "qr_code" || type === "signature" ? 12 : 60,
    font_family: "Georgia, serif",
    font_size: 36,
    font_weight: "600",
    color: "#0f172a",
    align: "center",
    letter_spacing: 0,
    line_height: 1.2,
    rotation: 0,
    opacity: 1,
    ...partial,
  };
}

export function defaultCertificateTemplate(
  id = "cert_default",
  name = "Event Certificate",
): CertificateTemplate {
  // Strictly template-driven: no elements are auto-added. The admin
  // explicitly adds only the placeholders the uploaded template contains.
  return {
    id,
    name,
    background_url: "",
    canvas_width: 1200,
    canvas_height: 848,
    elements: [],
  };
}

export function normalizeCertificateElement(
  raw: Partial<CertificateElement> & { key: string; type: CertificateElementType },
): CertificateElement {
  const base = makeElement(raw.key, raw.type);
  return { ...base, ...raw, label: raw.label ?? base.label };
}

// Legacy element keys that were previously auto-injected by the old
// default template. These are stripped on load so that certificates
// only ever render what the admin has explicitly placed on top of
// the uploaded background.
const LEGACY_AUTO_ELEMENT_KEYS = new Set([
  "el_name", "el_reg", "el_cert", "el_title", "el_wdate", "el_idate", "el_qr", "el_sig",
]);

export function normalizeCertificateTemplate(raw: Partial<CertificateTemplate>): CertificateTemplate {
  const id = raw.id ?? `cert_${Math.random().toString(36).slice(2, 8)}`;
  const els = Array.isArray(raw.elements) ? raw.elements : [];
  return {
    id,
    name: raw.name ?? "Untitled Template",
    background_url: raw.background_url ?? "",
    canvas_width: raw.canvas_width ?? 1200,
    canvas_height: raw.canvas_height ?? 848,
    elements: (els as Array<Partial<CertificateElement>>)
      .filter((e) => !!e?.key && !!e?.type)
      // Never carry image-type overlays (QR/signature) or the legacy
      // auto-injected defaults — the uploaded template is the only source of truth.
      .filter((e) => e.type !== "qr_code" && e.type !== "signature")
      .filter((e) => !LEGACY_AUTO_ELEMENT_KEYS.has(String(e.key)))
      .map((e) => normalizeCertificateElement(e as Partial<CertificateElement> & { key: string; type: CertificateElementType })),
  };
}

function mergeCertificate(raw: Partial<EventCertificate> | undefined | null): EventCertificate {
  const r = (raw ?? {}) as Partial<EventCertificate>;
  const templates =
    Array.isArray(r.templates) && r.templates.length > 0
      ? r.templates.map(normalizeCertificateTemplate)
      : [defaultCertificateTemplate()];
  return {
    ...deepClone(DEFAULT_CONFIG.certificate),
    ...r,
    number_format: {
      ...deepClone(DEFAULT_CONFIG.certificate.number_format),
      ...((r.number_format ?? {}) as Partial<CertificateNumberFormat>),
    },
    templates,
    active_template_id: r.active_template_id ?? templates[0]?.id ?? "cert_default",
  };
}

// Format a certificate number from the admin-configured template + a sequence value.
export function formatCertificateNumber(
  fmt: CertificateNumberFormat,
  sequence: number,
): string {
  const year = fmt.year === "auto" || !fmt.year ? String(new Date().getFullYear()) : fmt.year;
  const padded = String(sequence).padStart(Math.max(1, fmt.sequence_padding || 6), "0");
  const sep = fmt.separator ?? "-";
  return [fmt.prefix || "CERT", year, padded].filter(Boolean).join(sep);
}
