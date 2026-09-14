import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { mergePartnerForm, type EventPartnerForm } from "@/lib/event-config";
import {


  definitionToLegacy,
  normalizeDefinition,
  synthesizeDefinitionFromLegacy,
  type PartnerFormDefinition,
} from "@/lib/partner-form";

// Return the set of custom_field keys that already have at least one saved
// value across partners for this event. Used by the form builder to lock
// the "internal name" input for fields that have received submissions.
export const partnerFormUsedKeys = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("partners")
      .select("custom_fields")
      .eq("event_id", data.event_id)
      .not("custom_fields", "is", null);
    if (error) return { ok: false as const, error: error.message, keys: [] as string[] };
    const used = new Set<string>();
    for (const r of rows ?? []) {
      const cf = (r as { custom_fields: unknown }).custom_fields;
      if (!cf || typeof cf !== "object" || Array.isArray(cf)) continue;
      for (const [k, v] of Object.entries(cf as Record<string, unknown>)) {
        if (v === null || v === undefined || v === "") continue;
        if (Array.isArray(v) && v.length === 0) continue;
        used.add(k);
      }
    }
    return { ok: true as const, keys: Array.from(used) };
  });

async function assertNoLockedKeyRenames(
  eventId: string,
  nextDef: PartnerFormDefinition,
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("events")
    .select("partner_form")
    .eq("id", eventId)
    .maybeSingle();
  const raw = (row?.partner_form ?? null) as
    | { definition?: Partial<PartnerFormDefinition> | null; draft?: Partial<PartnerFormDefinition> | null }
    | null;
  const prev =
    normalizeDefinition(raw?.definition ?? null) ??
    normalizeDefinition(raw?.draft ?? null);
  if (!prev) return null;

  const { data: partners } = await supabaseAdmin
    .from("partners")
    .select("custom_fields")
    .eq("event_id", eventId)
    .not("custom_fields", "is", null);
  const used = new Set<string>();
  for (const r of partners ?? []) {
    const cf = (r as { custom_fields: unknown }).custom_fields;
    if (!cf || typeof cf !== "object" || Array.isArray(cf)) continue;
    for (const [k, v] of Object.entries(cf as Record<string, unknown>)) {
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      used.add(k);
    }
  }
  if (used.size === 0) return null;

  const prevById = new Map(prev.fields.map((f) => [f.id, f]));
  for (const nf of nextDef.fields) {
    const pf = prevById.get(nf.id);
    if (!pf) continue;
    if (pf.key !== nf.key && used.has(pf.key)) {
      return `Field "${pf.label || pf.key}" has existing submissions — its internal key is locked and cannot be renamed.`;
    }
  }
  return null;
}


// Load the current partner form definition (draft + published if present).
export const partnerFormGet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("events")
      .select("partner_form")
      .eq("id", data.event_id)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    const raw = (row?.partner_form ?? null) as unknown as
      | (EventPartnerForm & { definition?: unknown; draft?: unknown })
      | null;
    const legacy = mergePartnerForm(raw);
    const rawDef = (raw as { definition?: Partial<PartnerFormDefinition> | null } | null)?.definition;
    const rawDraft = (raw as { draft?: Partial<PartnerFormDefinition> | null } | null)?.draft;
    const published = normalizeDefinition(rawDef) ?? synthesizeDefinitionFromLegacy(legacy);
    const draft = normalizeDefinition(rawDraft);
    return { ok: true as const, published, draft };
  });

// Save a draft without changing the live form.
export const partnerFormSaveDraft = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        definition: z.record(z.string(), z.unknown()),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const def = normalizeDefinition(data.definition as Partial<PartnerFormDefinition>);
    if (!def) return { ok: false as const, error: "Invalid form definition." };
    const lockErr = await assertNoLockedKeyRenames(data.event_id, def);
    if (lockErr) return { ok: false as const, error: lockErr };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("events")
      .select("partner_form")
      .eq("id", data.event_id)
      .maybeSingle();
    const cur = (row?.partner_form ?? {}) as unknown as Record<string, unknown>;
    const next = { ...cur, draft: { ...def, status: "draft", updated_at: new Date().toISOString() } };
    const { error } = await supabaseAdmin
      .from("events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ partner_form: next as any })
      .eq("id", data.event_id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// Publish a definition: writes it as the live form + syncs legacy field map so
// old readers keep working.
export const partnerFormPublish = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        definition: z.record(z.string(), z.unknown()),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const def = normalizeDefinition(data.definition as Partial<PartnerFormDefinition>);
    if (!def) return { ok: false as const, error: "Invalid form definition." };
    const lockErr = await assertNoLockedKeyRenames(data.event_id, def);
    if (lockErr) return { ok: false as const, error: lockErr };
    const published: PartnerFormDefinition = {
      ...def,
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const legacy = definitionToLegacy(published);
    const payload = {
      fields: legacy.fields,
      definition: published,
      draft: null,
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ partner_form: payload as any })
      .eq("id", data.event_id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });

// Discard current draft.
export const partnerFormDiscardDraft = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("events")
      .select("partner_form")
      .eq("id", data.event_id)
      .maybeSingle();
    const cur = (row?.partner_form ?? {}) as unknown as Record<string, unknown>;
    const next = { ...cur, draft: null };
    const { error } = await supabaseAdmin
      .from("events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ partner_form: next as any })
      .eq("id", data.event_id);
    if (error) return { ok: false as const, error: error.message };
    // Drop the public resolver cache so public pages see this change now.
    (await import("@/lib/event-resolver.server")).invalidatePublicEventCache();
    return { ok: true as const };
  });
