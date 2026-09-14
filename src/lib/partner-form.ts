// Client-safe types + defaults for the dynamic Partner Registration Form Builder.
// The form definition lives inside `events.partner_form` as JSONB so
// adding new fields never requires a database migration. Every field's values
// end up either on a typed column of `partners` (system fields) or inside the
// `partners.custom_fields` JSONB payload.

import {
  DEFAULT_PARTNER_FORM,
  deepClone,
  PARTNER_FIELD_KEYS,
  type PartnerFieldConfig,
  type PartnerFieldKey,
  type EventPartnerForm as LegacyEventPartnerForm,
} from "@/lib/event-config";

export type PartnerFieldType =
  | "text"
  | "textarea"
  | "number"
  | "mobile"
  | "email"
  | "url"
  | "date"
  | "dropdown"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "yesno"
  | "hidden"
  | "organisation"
  // Phase 1: listed in the palette but disabled at runtime.
  | "file"
  | "image"
  | "address"
  | "district";

export const PARTNER_FIELD_TYPES_ENABLED: PartnerFieldType[] = [
  "text",
  "textarea",
  "number",
  "mobile",
  "email",
  "url",
  "date",
  "dropdown",
  "multiselect",
  "checkbox",
  "radio",
  "yesno",
  "hidden",
  "organisation",
];

export const PARTNER_FIELD_TYPES_DISABLED: PartnerFieldType[] = [
  "file",
  "image",
  "address",
  "district",
];

export type PartnerFieldOption = {
  id: string;
  label: string;
  value: string;
  enabled: boolean;
};

export type PartnerFieldValidation = {
  minLength?: number | null;
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  pattern?: string;
  errorMessage?: string;
};

export type PartnerField = {
  id: string;
  key: string;               // internal name; storage key
  type: PartnerFieldType;
  label: string;
  placeholder: string;
  help: string;
  defaultValue: string;
  required: boolean;
  visible: boolean;
  enabled: boolean;
  readOnly: boolean;
  system?: boolean;               // one of the 7 legacy fields
  systemKey?: PartnerFieldKey;    // maps this field to a typed column
  multi?: boolean;                // for organisation / multiselect toggle
  options: PartnerFieldOption[];
  validation: PartnerFieldValidation;
};

export type PartnerFormDefinition = {
  version: 2;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string | null;
  fields: PartnerField[];
};

// Extended runtime shape held in `events.partner_form`:
// - `fields` (record) stays for backward compatibility with existing readers.
// - `definition` carries the full dynamic form; when missing, we synthesize
//   one from the legacy record so nothing breaks for live events.
export type EventPartnerFormV2 = LegacyEventPartnerForm & {
  definition: PartnerFormDefinition | null;
};

export const SYSTEM_FIELD_TYPE: Record<PartnerFieldKey, PartnerFieldType> = {
  partner_name: "text",
  organizations: "organisation",
  contact_person: "text",
  mobile: "mobile",
  email: "email",
  district: "text",
};

function rid(prefix = "f"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function synthField(k: PartnerFieldKey, cfg: PartnerFieldConfig, order: number): PartnerField {
  const type = SYSTEM_FIELD_TYPE[k];
  return {
    id: `sys_${k}`,
    key: k,
    type,
    label: cfg.label,
    placeholder: cfg.placeholder,
    help: "",
    defaultValue: "",
    required: cfg.required,
    visible: cfg.visible,
    enabled: cfg.enabled,
    readOnly: false,
    system: true,
    systemKey: k,
    multi: type === "organisation" ? true : undefined,
    options: [],
    validation: {},
  };
}

export function synthesizeDefinitionFromLegacy(
  legacy: LegacyEventPartnerForm,
): PartnerFormDefinition {
  const fields = PARTNER_FIELD_KEYS.map((k, i) => synthField(k, legacy.fields[k], i));
  return {
    version: 2,
    status: "published", // legacy is effectively always-live
    published_at: null,
    updated_at: null,
    fields,
  };
}

export function normalizePartnerField(raw: Partial<PartnerField> & { key: string }): PartnerField {
  const type = (raw.type ?? "text") as PartnerFieldType;
  const options: PartnerFieldOption[] = Array.isArray(raw.options)
    ? (raw.options as Array<Partial<PartnerFieldOption> | null | undefined>)
        .filter((o): o is Partial<PartnerFieldOption> => !!o && typeof o === "object")
        .map((o) => ({
          id: o.id ?? rid("opt"),
          label: (o.label ?? o.value ?? "").toString(),
          value: (o.value ?? o.label ?? "").toString(),
          enabled: o.enabled !== false,
        }))
    : [];
  return {
    id: raw.id ?? rid(),
    key: raw.key,
    type,
    label: raw.label ?? raw.key,
    placeholder: raw.placeholder ?? "",
    help: raw.help ?? "",
    defaultValue: raw.defaultValue ?? "",
    required: !!raw.required,
    visible: raw.visible !== false,
    enabled: raw.enabled !== false,
    readOnly: !!raw.readOnly,
    system: !!raw.system,
    systemKey: raw.systemKey as PartnerFieldKey | undefined,
    multi: raw.multi,
    options,
    validation: raw.validation ?? {},
  };
}

export function normalizeDefinition(raw: Partial<PartnerFormDefinition> | null | undefined): PartnerFormDefinition | null {
  if (!raw || !Array.isArray(raw.fields)) return null;
  const seenKeys = new Set<string>();
  const fields = (raw.fields as Array<Partial<PartnerField> | null | undefined>)
    .filter((f): f is Partial<PartnerField> & { key: string } => !!f && typeof (f as { key?: unknown }).key === "string")
    .map((f) => normalizePartnerField(f))
    .filter((f) => {
      if (seenKeys.has(f.key)) return false;
      seenKeys.add(f.key);
      return true;
    });
  return {
    version: 2,
    status: raw.status === "draft" ? "draft" : "published",
    published_at: raw.published_at ?? null,
    updated_at: raw.updated_at ?? null,
    fields,
  };
}

export function getPartnerFormDefinition(
  legacy: LegacyEventPartnerForm,
  raw: Partial<PartnerFormDefinition> | null | undefined,
): PartnerFormDefinition {
  return normalizeDefinition(raw) ?? synthesizeDefinitionFromLegacy(legacy);
}

// Convert an active (published) definition back into the legacy record so old
// consumers (e.g. server-side validators reading `partner_form.fields[k]`) keep
// working after an admin publishes a new definition.
export function definitionToLegacy(def: PartnerFormDefinition): LegacyEventPartnerForm {
  // Deep copy: DEFAULT_PARTNER_FORM is a module singleton shared by every event.
  const out = deepClone(DEFAULT_PARTNER_FORM.fields) as Record<PartnerFieldKey, PartnerFieldConfig>;
  for (const f of def.fields) {
    if (f.systemKey) {
      out[f.systemKey] = {
        visible: f.visible,
        required: f.required,
        enabled: f.enabled,
        label: f.label,
        placeholder: f.placeholder,
      };
    }
  }
  return { fields: out };
}

export function makeBlankField(type: PartnerFieldType = "text"): PartnerField {
  const key = `field_${Math.random().toString(36).slice(2, 8)}`;
  const withOptions: PartnerFieldType[] = ["dropdown", "multiselect", "radio"];
  return {
    id: rid(),
    key,
    type,
    label: "New field",
    placeholder: "",
    help: "",
    defaultValue: "",
    required: false,
    visible: true,
    enabled: true,
    readOnly: false,
    multi: type === "multiselect" || type === "organisation",
    options: withOptions.includes(type)
      ? [
          { id: rid("opt"), label: "Option 1", value: "option_1", enabled: true },
          { id: rid("opt"), label: "Option 2", value: "option_2", enabled: true },
        ]
      : [],
    validation: {},
  };
}

export function duplicateField(f: PartnerField): PartnerField {
  return {
    ...f,
    id: rid(),
    key: `${f.key}_copy`,
    system: false,
    systemKey: undefined,
    label: `${f.label} (copy)`,
    options: f.options.map((o) => ({ ...o, id: rid("opt") })),
  };
}

export const PARTNER_FIELD_TYPE_LABELS: Record<PartnerFieldType, string> = {
  text: "Single Line Text",
  textarea: "Multi Line Text",
  number: "Number",
  mobile: "Mobile Number",
  email: "Email",
  url: "URL",
  date: "Date",
  dropdown: "Dropdown",
  multiselect: "Multi Select",
  checkbox: "Checkbox",
  radio: "Radio",
  yesno: "Yes / No",
  hidden: "Hidden",
  organisation: "Organisation",
  file: "File Upload (soon)",
  image: "Image Upload (soon)",
  address: "Address (soon)",
  district: "District (soon)",
};

// Validate a submitted value against a field's rules. Returns null on success
// or an error string on failure. Used by both client and server code.
export function validateFieldValue(
  field: PartnerField,
  value: unknown,
): string | null {
  if (!field.visible || !field.enabled) return null;
  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (field.required && isEmpty) {
    return field.validation.errorMessage || `${field.label} is required.`;
  }
  if (isEmpty) return null;

  const str = Array.isArray(value) ? value.join(", ") : String(value);
  const v = field.validation;
  if (v.minLength != null && str.length < v.minLength) {
    return v.errorMessage || `${field.label} must be at least ${v.minLength} characters.`;
  }
  if (v.maxLength != null && str.length > v.maxLength) {
    return v.errorMessage || `${field.label} must be at most ${v.maxLength} characters.`;
  }
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return v.errorMessage || "Please enter a valid email address.";
  }
  if (field.type === "mobile" && !/^\d{7,15}$/.test(str.replace(/\D+/g, ""))) {
    return v.errorMessage || "Please enter a valid mobile number.";
  }
  if (field.type === "url" && !/^https?:\/\//i.test(str)) {
    return v.errorMessage || "Please enter a valid URL (starting with http/https).";
  }
  if (field.type === "number") {
    const n = Number(str);
    if (!Number.isFinite(n)) return v.errorMessage || `${field.label} must be a number.`;
    if (v.min != null && n < v.min) return v.errorMessage || `${field.label} must be ≥ ${v.min}.`;
    if (v.max != null && n > v.max) return v.errorMessage || `${field.label} must be ≤ ${v.max}.`;
  }
  if (v.pattern) {
    try {
      const re = new RegExp(v.pattern);
      if (!re.test(str)) return v.errorMessage || `${field.label} is invalid.`;
    } catch {
      /* ignore bad regex */
    }
  }
  return null;
}
