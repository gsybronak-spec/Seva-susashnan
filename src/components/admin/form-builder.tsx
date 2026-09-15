import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateEventQueries } from "@/lib/query-cache";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2, Plus, ArrowUp, ArrowDown, Copy, RotateCcw, Save, Rocket, History, EyeOff, Download, Upload,
} from "lucide-react";
import {
  adminGetEventConfig,
  adminUpdateEventSection,
} from "@/lib/event.functions";
import {
  BUILTIN_FIELD_KEYS,
  DEFAULT_FORM_FIELDS,
  deepClone,
  DEFAULT_TEMPLATES,
  ESSENTIAL_FIELD_KEYS,
  mergeConfig,
  normalizeField,
  type FormField,
  type FormFieldType,
  type FormTemplate,
  type FormVersion,
  type VisibilityOperator,
  type VisibilityRule,
  type EventConfig,
  type EventForm,
} from "@/lib/event-config";
import { DynamicFormRenderer } from "@/components/dynamic-form-renderer";

const ESSENTIAL = new Set<string>(ESSENTIAL_FIELD_KEYS);
const BUILTIN = new Set<string>(BUILTIN_FIELD_KEYS);
const isEssential = (k: string) => ESSENTIAL.has(k);


const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Single Line Text" },
  { value: "textarea", label: "Multi Line Text" },
  { value: "phone", label: "Mobile Number" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Radio Button" },
  { value: "checkbox", label: "Checkbox" },
  { value: "multiselect", label: "Multi Select" },
  { value: "hidden", label: "Hidden Field" },
];

const OPTION_TYPES: FormFieldType[] = ["dropdown", "radio", "checkbox", "multiselect"];

function newFieldKey() {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function makeBlankField(order: number): FormField {
  return normalizeField({
    key: newFieldKey(),
    type: "text",
    label: "New Field",
    order,
  });
}

export function FormBuilder({ eventId }: { eventId: string }) {
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

  const [form, setForm] = useState<EventForm | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [configId, setConfigId] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.ok && data.config) {
      const raw = data.config as unknown as Partial<EventConfig> & { id: string };
      const cfg = mergeConfig(raw);
      setForm(cfg.form);
      // If a draft exists, load it; otherwise load published fields.
      setFields(cfg.form.draft ?? cfg.form.fields);
      setConfigId(raw.id);
      setDirty(false);
    }
  }, [data]);

  const mutate = useMutation({
    mutationFn: (value: Partial<EventForm>) =>
      save({ data: { id: configId, section: "form", value: value as unknown as Record<string, unknown> } }),
    onSuccess: (res, _vars, _ctx) => {
      if (!res.ok) return toast.error(res.error);
      invalidateEventQueries(qc, configId);
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!data?.ok || !form) return <div className="p-6 text-sm text-destructive">Failed to load</div>;

  // ---- field ops ----
  function update(idx: number, patch: Partial<FormField>) {
    setFields((cur) => cur.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    setDirty(true);
  }
  function move(idx: number, dir: -1 | 1) {
    setFields((cur) => {
      const next = [...cur];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((f, i) => ({ ...f, order: i + 1 }));
    });
    setDirty(true);
  }
  function remove(idx: number) {
    const f = fields[idx];
    if (isEssential(f.key)) {
      toast.error(`"${f.label}" is essential (used for identification & de-duplication) and cannot be deleted. You can rename or reorder it.`);
      return;
    }
    if (!confirm(`Delete "${f.label}"? This cannot be undone once you publish.`)) return;
    setFields((cur) => cur.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i + 1 })));
    setDirty(true);
  }
  function duplicate(idx: number) {
    const src = fields[idx];
    const copy: FormField = {
      ...src,
      key: newFieldKey(),
      label: `${src.label} (Copy)`,
      builtin: false,
      order: idx + 2,
    };
    setFields((cur) => {
      const next = [...cur.slice(0, idx + 1), copy, ...cur.slice(idx + 1)];
      return next.map((f, i) => ({ ...f, order: i + 1 }));
    });
    setDirty(true);
  }
  function addField() {
    setFields((cur) => [...cur, makeBlankField(cur.length + 1)]);
    setDirty(true);
  }
  function resetField(idx: number) {
    const f = fields[idx];
    const def = DEFAULT_FORM_FIELDS.find((d) => d.key === f.key);
    if (!def) return toast.error("This field has no default to restore.");
    setFields((cur) => cur.map((x, i) => (i === idx ? deepClone(def) : x)));
    setDirty(true);
    toast.success(`"${def.label}" restored to default settings.`);
  }
  function resetDefaults() {
    if (!confirm("Reset the current form to the default 7 built-in fields? This clears your unsaved changes.")) return;
    setFields(deepClone(DEFAULT_FORM_FIELDS));
    setDirty(true);
  }

  // ---- validation before publish ----
  function validateForm(list: FormField[]): string | null {
    const keys = list.map((f) => f.key);
    for (const k of ESSENTIAL_FIELD_KEYS) {
      const f = list.find((x) => x.key === k);
      if (!f) return `Essential field "${k}" is missing. Add it back before publishing.`;
      if (!f.enabled) return `Essential field "${f.label}" must stay Enabled (used for identification).`;
      if (f.hidden) return `Essential field "${f.label}" cannot be hidden.`;
    }
    // Duplicate keys
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length) return `Duplicate field key: ${dupes[0]}. Every field key must be unique.`;
    // Bad keys
    const bad = list.find((f) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.key));
    if (bad) return `Invalid field key "${bad.key}". Use letters, numbers, and underscore only.`;
    // Options presence for choice types (district options are dynamically provided by Coverage & Districts)
    const needOpts = list.find((f) =>
      ["dropdown", "radio", "checkbox", "multiselect"].includes(f.type) &&
      f.enabled &&
      f.options.length === 0 &&
      f.key !== "district",
    );
    if (needOpts) return `"${needOpts.label}" needs at least one option.`;
    // Conditional-logic references
    for (const f of list) {
      for (const r of f.visible_if) {
        if (!keys.includes(r.field)) return `"${f.label}" has a conditional rule pointing at a missing field "${r.field}".`;
      }
    }
    return null;
  }

  // ---- persistence ----
  async function saveDraft() {
    await mutate.mutateAsync({ ...form, draft: fields });
    toast.success("Draft saved");
    setDirty(false);
  }
  async function publish() {
    const err = validateForm(fields);
    if (err) { toast.error(err); return; }
    if (!confirm("Publish this form? Live registration form will update immediately.")) return;
    const history: FormVersion[] = [
      { at: new Date().toISOString(), label: "Auto-save before publish", fields: form!.fields },
      ...form!.history,
    ].slice(0, 20);
    // Also update the active template so switching won't lose the changes.
    const templates = form!.templates.map((t) =>
      t.id === form!.active_template_id ? { ...t, fields } : t,
    );
    await mutate.mutateAsync({
      ...form,
      fields,
      draft: null,
      history,
      templates,
    });
    toast.success("Form published — live now on /register");
    setDirty(false);
  }
  async function discardDraft() {
    if (!confirm("Discard the unsaved draft and revert to the currently published form?")) return;
    setFields(form!.fields);
    await mutate.mutateAsync({ ...form, draft: null });
    toast.success("Draft discarded");
    setDirty(false);
  }
  async function restoreVersion(v: FormVersion) {
    if (!confirm(`Restore version from ${new Date(v.at).toLocaleString()}? It becomes the current draft (you must Publish to make it live).`)) return;
    setFields(v.fields);
    await mutate.mutateAsync({ ...form, draft: v.fields });
    toast.success("Version restored as draft. Review and Publish to go live.");
    setDirty(false);
  }

  // ---- import / export ----
  function exportJson() {
    const activeTpl = form!.templates.find((t) => t.id === form!.active_template_id);
    const payload = {
      exported_at: new Date().toISOString(),
      template_name: activeTpl?.name ?? "Form",
      fields,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form-${(activeTpl?.name ?? "export").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Form exported");
  }
  async function importJson(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const raw = Array.isArray(json) ? json : Array.isArray(json?.fields) ? json.fields : null;
      if (!raw) throw new Error("File does not contain a 'fields' array.");
      const imported = raw
        .filter((f: unknown) => f && typeof f === "object" && typeof (f as { key?: unknown }).key === "string")
        .map((f: Partial<FormField> & { key: string }, i: number) => normalizeField(f, i + 1));
      if (imported.length === 0) throw new Error("No valid fields found in the file.");
      const err = validateForm(imported);
      if (err) { toast.error(`Import blocked: ${err}`); return; }
      const name = (json?.template_name && String(json.template_name)) || "Imported Form";
      if (confirm(`Import ${imported.length} fields as a new template "${name}" and switch to it?`)) {
        const id = `tpl_${Date.now().toString(36)}`;
        const tpl: FormTemplate = { id, name, fields: imported };
        const templates = [...form!.templates, tpl];
        await mutate.mutateAsync({ ...form, templates, active_template_id: id, draft: imported });
        setFields(imported);
        toast.success(`Imported "${name}"`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  }



  // ---- templates ----
  async function switchTemplate(id: string) {
    if (dirty && !confirm("You have unsaved changes. Switch template anyway?")) return;
    const tpl = form!.templates.find((t) => t.id === id);
    if (!tpl) return;
    setFields(tpl.fields);
    await mutate.mutateAsync({ ...form, active_template_id: id, draft: tpl.fields });
    toast.success(`Switched to template: ${tpl.name}`);
  }
  async function saveAsTemplate() {
    const name = prompt("Template name (e.g. Competition Registration)?")?.trim();
    if (!name) return;
    const id = `tpl_${Date.now().toString(36)}`;
    const tpl: FormTemplate = { id, name, fields };
    const templates = [...form!.templates, tpl];
    await mutate.mutateAsync({ ...form, templates, active_template_id: id, draft: fields });
    toast.success(`Saved as template: ${name}`);
  }
  async function renameTemplate() {
    const tpl = form!.templates.find((t) => t.id === form!.active_template_id);
    if (!tpl) return;
    const name = prompt("Rename template:", tpl.name)?.trim();
    if (!name) return;
    const templates = form!.templates.map((t) => (t.id === tpl.id ? { ...t, name } : t));
    await mutate.mutateAsync({ ...form, templates });
    toast.success("Template renamed");
  }
  async function deleteTemplate() {
    if (form!.templates.length <= 1) return toast.error("At least one template is required.");
    const tpl = form!.templates.find((t) => t.id === form!.active_template_id);
    if (!tpl) return;
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    const templates = form!.templates.filter((t) => t.id !== tpl.id);
    const nextId = templates[0].id;
    await mutate.mutateAsync({
      ...form,
      templates,
      active_template_id: nextId,
      draft: templates[0].fields,
    });
    setFields(templates[0].fields);
    toast.success("Template deleted");
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Header / template controls */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-brand-primary">Registration Form Builder</h3>
            <p className="text-xs text-muted-foreground">
              Manage every field on the public registration form. Save a draft, then Publish to make it live. Every field automatically saves with each registration — no code changes needed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Template</Label>
              <Select value={form.active_template_id} onValueChange={switchTemplate}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {form.templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={saveAsTemplate}>Save as new template</Button>
            <Button variant="outline" size="sm" onClick={renameTemplate}>Rename</Button>
            <Button variant="outline" size="sm" onClick={deleteTemplate}>Delete</Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={addField}><Plus className="mr-2 h-4 w-4" /> Add Field</Button>
          <Button variant="outline" onClick={resetDefaults}><RotateCcw className="mr-2 h-4 w-4" /> Reset to Default</Button>
          <Button variant="outline" onClick={exportJson}><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
          <label className="inline-flex">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
              <Upload className="mr-2 h-4 w-4" /> Import JSON
            </span>
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {form.draft && !dirty && (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900">
                Editing an unpublished draft
              </span>
            )}
            {dirty && (
              <span className="rounded-md bg-orange-100 px-2 py-1 text-xs text-orange-900">
                Unsaved changes
              </span>
            )}
            {form.draft && (
              <Button variant="outline" onClick={discardDraft} disabled={mutate.isPending}>Discard draft</Button>
            )}
            <Button variant="outline" onClick={saveDraft} disabled={mutate.isPending}>
              <Save className="mr-2 h-4 w-4" /> Save Draft
            </Button>
            <Button onClick={publish} disabled={mutate.isPending}>
              <Rocket className="mr-2 h-4 w-4" /> Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Two-panel: editor + live preview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {fields.map((f, idx) => (
            <FieldEditor
              key={f.key}
              field={f}
              allFields={fields}
              first={idx === 0}
              last={idx === fields.length - 1}
              onUpdate={(patch) => update(idx, patch)}
              onMove={(dir) => move(idx, dir)}
              onDuplicate={() => duplicate(idx)}
              onRemove={() => remove(idx)}
              onResetDefault={() => resetField(idx)}
            />
          ))}
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <LivePreview fields={fields} />
          <VersionHistory history={form.history} onRestore={restoreVersion} />
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Field editor row
// -----------------------------------------------------
function FieldEditor({
  field, allFields, first, last, onUpdate, onMove, onDuplicate, onRemove, onResetDefault,
}: {
  field: FormField;
  allFields: FormField[];
  first: boolean;
  last: boolean;
  onUpdate: (patch: Partial<FormField>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onResetDefault: () => void;
}) {
  const isBuiltin = field.builtin;
  const essential = isEssential(field.key);
  const hasDefault = DEFAULT_FORM_FIELDS.some((d) => d.key === field.key);
  const showOptions = OPTION_TYPES.includes(field.type);
  const otherFields = allFields.filter((f) => f.key !== field.key);
  // Essentials cannot change type (DB depends on it) or key. Other built-ins can.
  const typeLocked = essential;
  const keyLocked = essential || isBuiltin;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{field.key}</span>
          {essential && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">essential</span>}
          {isBuiltin && !essential && <span className="rounded bg-accent px-2 py-0.5 text-xs text-brand-primary">core</span>}
          {field.hidden && <EyeOff className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          {hasDefault && (
            <Button size="sm" variant="ghost" onClick={onResetDefault} title="Restore this field's default settings">
              <RotateCcw className="mr-1 h-3 w-3" /> Reset
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={first}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={last}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDuplicate}><Copy className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onRemove} disabled={essential} title={essential ? "Essential field — cannot delete" : "Delete field"}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={field.label} onChange={(e) => onUpdate({ label: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Field Name / Key</Label>
          <Input
            value={field.key}
            disabled={keyLocked}
            onChange={(e) => onUpdate({ key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Placeholder</Label>
          <Input value={field.placeholder} onChange={(e) => onUpdate({ placeholder: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select
            value={field.type}
            disabled={typeLocked}
            onValueChange={(v) => onUpdate({ type: v as FormFieldType })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Help Text (shown under the input)</Label>
          <Input value={field.help} onChange={(e) => onUpdate({ help: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Default Value</Label>
          <Input value={field.default_value} onChange={(e) => onUpdate({ default_value: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Display Order</Label>
          <Input
            type="number" min={1} value={field.order}
            onChange={(e) => onUpdate({ order: Number(e.target.value) || field.order })}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Toggle label="Enabled (visible)" checked={field.enabled} onChange={(b) => onUpdate({ enabled: b })} disabled={essential} />
        <Toggle label="Required" checked={field.required} onChange={(b) => onUpdate({ required: b })} />
        <Toggle label="Read only" checked={field.readonly} onChange={(b) => onUpdate({ readonly: b })} />
        <Toggle label="Hidden" checked={field.hidden} onChange={(b) => onUpdate({ hidden: b })} disabled={essential} />
        <Toggle label="Unique value (no duplicates)" checked={field.unique} onChange={(b) => onUpdate({ unique: b })} />
      </div>
      {essential && (
        <p className="mt-2 text-xs text-muted-foreground">
          Essential system field — the label, placeholder, help, order, and validation can be changed, but it must stay enabled and visible so participants can register.
        </p>
      )}
      {field.key === "district" && (
        <p className="mt-2 rounded-md bg-brand-primary/5 px-3 py-2 text-xs text-muted-foreground">
          This field is <b>coverage-aware</b>: for Single District events it shows the event's
          district automatically; for Zone events it lists only the districts configured in the
          event's <b>Coverage &amp; Districts</b> settings; for State-wide events it lists all
          active districts. Options come from the event configuration — do not add options here.
        </p>
      )}

      {/* Validation */}
      <details className="mt-3 rounded-md border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">Validation rules</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Min (length or value)</Label>
            <Input
              type="number"
              value={field.validation.min ?? ""}
              onChange={(e) => onUpdate({ validation: { ...field.validation, min: e.target.value === "" ? null : Number(e.target.value) } })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max (length or value)</Label>
            <Input
              type="number"
              value={field.validation.max ?? ""}
              onChange={(e) => onUpdate({ validation: { ...field.validation, max: e.target.value === "" ? null : Number(e.target.value) } })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Regex pattern (optional)</Label>
            <Input
              value={field.validation.pattern ?? ""}
              onChange={(e) => onUpdate({ validation: { ...field.validation, pattern: e.target.value } })}
              placeholder="^[A-Z]{3}\\d{4}$"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs">Custom error message</Label>
            <Input
              value={field.validation.message ?? ""}
              onChange={(e) => onUpdate({ validation: { ...field.validation, message: e.target.value } })}
            />
          </div>
        </div>
      </details>

      {showOptions && (
        <div className="mt-3">
          <OptionsEditor
            options={field.options}
            onChange={(opts) => onUpdate({ options: opts })}
          />
        </div>
      )}

      {/* Conditional Logic */}
      <details className="mt-3 rounded-md border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Conditional logic {field.visible_if.length > 0 && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{field.visible_if.length} rule(s)</span>}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Show this field only when ALL of the following rules match. Leave empty to always show.
        </p>
        <div className="mt-2 space-y-2">
          {field.visible_if.map((r, i) => (
            <ConditionalRule
              key={i}
              rule={r}
              otherFields={otherFields}
              onChange={(next) => {
                const rules = [...field.visible_if];
                rules[i] = next;
                onUpdate({ visible_if: rules });
              }}
              onRemove={() => onUpdate({ visible_if: field.visible_if.filter((_, j) => j !== i) })}
            />
          ))}
          <Button size="sm" variant="outline" onClick={() => {
            const first = otherFields[0];
            if (!first) return;
            onUpdate({ visible_if: [...field.visible_if, { field: first.key, operator: "equals", value: "" }] });
          }} disabled={otherFields.length === 0}>
            <Plus className="mr-1 h-3 w-3" /> Add rule
          </Button>
        </div>
      </details>
    </div>
  );
}

function ConditionalRule({
  rule, otherFields, onChange, onRemove,
}: {
  rule: VisibilityRule;
  otherFields: FormField[];
  onChange: (r: VisibilityRule) => void;
  onRemove: () => void;
}) {
  const target = otherFields.find((f) => f.key === rule.field);
  const hasOptions = target && OPTION_TYPES.includes(target.type) && target.options.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
      <span className="text-xs text-muted-foreground">If</span>
      <Select value={rule.field} onValueChange={(v) => onChange({ ...rule, field: v })}>
        <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {otherFields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={rule.operator} onValueChange={(v) => onChange({ ...rule, operator: v as VisibilityOperator })}>
        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="equals">equals</SelectItem>
          <SelectItem value="not_equals">does not equal</SelectItem>
          <SelectItem value="includes">contains</SelectItem>
        </SelectContent>
      </Select>
      {hasOptions ? (
        <Select value={rule.value} onValueChange={(v) => onChange({ ...rule, value: v })}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Select value" /></SelectTrigger>
          <SelectContent>
            {target!.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input className="h-8 w-[180px] text-xs" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} placeholder="Value to match" />
      )}
      <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}


function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (b: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-md border border-border p-2 ${disabled ? "opacity-60" : ""}`}>
      <span className="text-xs">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

// -----------------------------------------------------
// Options editor with add/edit/delete/reorder
// -----------------------------------------------------
function OptionsEditor({
  options, onChange,
}: {
  options: { label: string; value: string }[];
  onChange: (opts: { label: string; value: string }[]) => void;
}) {
  function update(i: number, patch: Partial<{ label: string; value: string }>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...options, { label: "New Option", value: `opt_${options.length + 1}` }]);
  }
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs">Options</Label>
        <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3 w-3" /> Add option</Button>
      </div>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input className="flex-1" placeholder="Label" value={o.label} onChange={(e) => update(i, { label: e.target.value })} />
            <Input className="flex-1" placeholder="Value (stored)" value={o.value} onChange={(e) => update(i, { value: e.target.value })} />
            <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === options.length - 1}><ArrowDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {options.length === 0 && <div className="text-xs text-muted-foreground">No options yet.</div>}
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Live preview — mirrors the /register renderer
// -----------------------------------------------------

function LivePreview({ fields }: { fields: FormField[] }) {
  const [values, setValues] = useState<Record<string, any>>({});
  useEffect(() => {
    const init: Record<string, any> = {};
    for (const f of fields) if (f.default_value) init[f.key] = f.default_value;
    setValues(init);
  }, [fields]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-brand-primary">Live Preview</h4>
        <span className="text-xs text-muted-foreground">Updates as you edit</span>
      </div>
      <div className="max-h-[70vh] space-y-4 overflow-auto rounded-md border border-dashed border-border bg-background p-4">
        <DynamicFormRenderer
          fields={fields}
          values={values}
          onChange={(key, val) => setValues((cur) => ({ ...cur, [key]: val }))}
        />
        {fields.length === 0 && <div className="text-xs text-muted-foreground">No fields configured.</div>}
        {fields.length > 0 && (
          <Button className="w-full mt-4" disabled>Register (preview)</Button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------
// Version history
// -----------------------------------------------------
function VersionHistory({ history, onRestore }: { history: FormVersion[]; onRestore: (v: FormVersion) => void }) {
  if (history.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-4 w-4 text-brand-primary" />
        <h4 className="text-sm font-semibold text-brand-primary">Previous versions</h4>
      </div>
      <ul className="space-y-2">
        {history.map((v, i) => (
          <li key={i} className="flex items-center justify-between rounded-md border border-border bg-background p-2 text-sm">
            <div>
              <div className="font-medium">{new Date(v.at).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{v.label} · {v.fields.length} fields</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onRestore(v)}>Restore</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Guard so unused imports don't get pruned when tree-shaking references them elsewhere
export const _internal = { BUILTIN_FIELD_KEYS, DEFAULT_TEMPLATES };
