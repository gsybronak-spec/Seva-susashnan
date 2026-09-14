// Deep-copy helpers for the event configuration layer.
//
// Every event is an independent application: no configuration value, JSON
// object, array, or nested id may ever be shared between two event rows.
// These helpers guarantee that a create/clone operation produces a fully
// detached copy — structurally deep-cloned, with every nested identifier
// regenerated so two events can never collide on a field/template id.

export const EVENT_CONFIG_SECTIONS = [
  "general",
  "features",
  "live",
  "attendance",
  "certificate",
  "referral",
  "whatsapp",
  "social",
  "status",
  "demo_mode",
  "form",
  "partner_form",
] as const;
// Note: coverage is stored INSIDE `general` (general.coverage), so it is
// deep-copied along with general — never a standalone section/column.

export type EventConfigSection = (typeof EVENT_CONFIG_SECTIONS)[number];

/**
 * Columns that identify one specific event. They must NEVER be carried over
 * to a new event row, no matter which template it was created from.
 */
export const NON_INHERITABLE_COLUMNS = [
  "id",
  "slug",
  "created_at",
  "updated_at",
  "is_active",
  "is_template",
  "template_category",
  "lifecycle_status",
  "publish_status",
  "archived_at",
  "qr_token",
  "reg_prefix",
  "district",
  "district_id",
  "district_name",
] as const;

export function deepCopy<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function regenIds(list: unknown, prefix: string): void {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (isObj(item) && "id" in item) item.id = newId(prefix);
  }
}

/**
 * Deep copy one configuration section for a brand-new event, regenerating
 * every nested identifier so nothing is shared with the source.
 */
export function copySection(section: EventConfigSection, raw: unknown): unknown {
  const value = deepCopy(raw);
  if (!isObj(value)) return value;

  if (section === "form") {
    // Registration form builder: fields, drafts, templates, history.
    const templates = value.templates;
    if (Array.isArray(templates)) {
      for (const t of templates) {
        if (!isObj(t)) continue;
        t.id = newId("tpl");
      }
      // active_template_id must point at this copy's own template.
      value.active_template_id =
        (isObj(templates[0]) ? (templates[0] as { id?: string }).id : undefined) ?? null;
    }
    // A clone starts with no unsaved draft and no edit history of the source.
    value.draft = null;
    value.history = [];
    return value;
  }

  if (section === "partner_form") {
    regenIds(value.fields, "pf");
    if (isObj(value.definition)) regenIds((value.definition as Record<string, unknown>).fields, "pf");
    if (isObj(value.draft)) regenIds((value.draft as Record<string, unknown>).fields, "pf");
    return value;
  }

  if (section === "certificate") {
    const templates = value.templates;
    if (Array.isArray(templates)) {
      for (const t of templates) {
        if (!isObj(t)) continue;
        t.id = newId("cert");
      }
      value.active_template_id =
        (isObj(templates[0]) ? (templates[0] as { id?: string }).id : undefined) ?? null;
    }
    return value;
  }

  return value;
}

/**
 * Build the fully detached configuration payload for a new event created
 * from `source`. Returns only the JSONB configuration sections — identity
 * columns are never inherited (see NON_INHERITABLE_COLUMNS).
 */
export function copyEventConfigSections(
  source: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!source) return out;
  for (const section of EVENT_CONFIG_SECTIONS) {
    if (source[section] === undefined || source[section] === null) continue;
    out[section] = copySection(section, source[section]);
  }
  return out;
}
