import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import {
  PARTNER_FIELD_TYPE_LABELS,
  PARTNER_FIELD_TYPES_ENABLED,
  PARTNER_FIELD_TYPES_DISABLED,
  duplicateField,
  makeBlankField,
  type PartnerField,
  type PartnerFieldOption,
  type PartnerFieldType,
  type PartnerFormDefinition,
} from "@/lib/partner-form";
import {
  partnerFormDiscardDraft,
  partnerFormGet,
  partnerFormPublish,
  partnerFormSaveDraft,
  partnerFormUsedKeys,
} from "@/lib/partner-form.functions";
import { PartnerDynamicForm } from "@/components/partner-dynamic-form";
import { organisationList } from "@/lib/organisation.functions";
import { invalidateEventQueries } from "@/lib/query-cache";

export function PartnerFormBuilder({ eventId }: { eventId: string }) {
  const load = useServerFn(partnerFormGet);
  const saveDraft = useServerFn(partnerFormSaveDraft);
  const publish = useServerFn(partnerFormPublish);
  const discard = useServerFn(partnerFormDiscardDraft);
  const loadOrgs = useServerFn(organisationList);
  const loadUsedKeys = useServerFn(partnerFormUsedKeys);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["partner-form-def", eventId],
    queryFn: () => load({ data: { event_id: eventId } }),
  });
  const { data: orgData } = useQuery({
    queryKey: ["organisations", eventId],
    queryFn: () => loadOrgs({ data: { event_id: eventId } }),
  });
  const { data: usedKeysData } = useQuery({
    queryKey: ["partner-form-used-keys", eventId],
    queryFn: () => loadUsedKeys({ data: { event_id: eventId } }),
    refetchInterval: 30_000,
  });
  const lockedKeys = useMemo(
    () => new Set(usedKeysData?.ok ? usedKeysData.keys : []),
    [usedKeysData],
  );
  const orgOptions = ((orgData?.ok ? orgData.rows : []) as Array<{ id: string; name: string; status: string }>)
    .filter((o) => o.status === "active")
    .map((o) => ({ id: o.id, name: o.name }));

  const [draft, setDraft] = useState<PartnerFormDefinition | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!data?.ok) return;
    setDraft(data.draft ?? data.published);
  }, [data]);

  const draftMutation = useMutation({
    mutationFn: () => saveDraft({ data: { event_id: eventId, definition: draft as unknown as Record<string, unknown> } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      invalidateEventQueries(qc, eventId);
      toast.success("Draft saved");
    },
  });
  const publishMutation = useMutation({
    mutationFn: () => publish({ data: { event_id: eventId, definition: draft as unknown as Record<string, unknown> } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      invalidateEventQueries(qc, eventId);
      toast.success("Form published");
    },
  });
  const discardMutation = useMutation({
    mutationFn: () => discard({ data: { event_id: eventId } }),
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      invalidateEventQueries(qc, eventId);
      toast.success("Draft discarded");
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (isLoading || !draft) {
    return <div className="p-6 text-sm text-muted-foreground">Loading form builder…</div>;
  }

  function updateField(id: string, patch: Partial<PartnerField>) {
    setDraft((d) => (d ? { ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : d));
  }
  function removeField(id: string) {
    setDraft((d) => (d ? { ...d, fields: d.fields.filter((f) => f.id !== id) } : d));
  }
  function duplicate(id: string) {
    setDraft((d) => {
      if (!d) return d;
      const idx = d.fields.findIndex((f) => f.id === id);
      if (idx < 0) return d;
      const copy = duplicateField(d.fields[idx]);
      const fields = [...d.fields];
      fields.splice(idx + 1, 0, copy);
      return { ...d, fields };
    });
  }
  function addField(type: PartnerFieldType) {
    setDraft((d) => (d ? { ...d, fields: [...d.fields, makeBlankField(type)] } : d));
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDraft((d) => {
      if (!d) return d;
      const oldIdx = d.fields.findIndex((f) => f.id === active.id);
      const newIdx = d.fields.findIndex((f) => f.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return d;
      return { ...d, fields: arrayMove(d.fields, oldIdx, newIdx) };
    });
  }

  const hasDraftDiff = data?.ok && JSON.stringify(data.draft) !== JSON.stringify(draft);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-brand-primary">Partner Registration Form Builder</h2>
          <p className="text-sm text-muted-foreground">
            Design the Partner form for this event. Drag to reorder, click a field to edit. Publish to make it live.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.ok && data.draft && (
            <Button variant="outline" onClick={() => discardMutation.mutate()} disabled={discardMutation.isPending}>
              Discard draft
            </Button>
          )}
          <Button variant="outline" onClick={() => draftMutation.mutate()} disabled={!hasDraftDiff || draftMutation.isPending}>
            Save draft
          </Button>
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            {publishMutation.isPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_360px]">
        <FieldPalette onAdd={addField} />

        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={draft.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {draft.fields.map((f) => (
                  <SortableFieldRow
                    key={f.id}
                    field={f}
                    expanded={expanded === f.id}
                    keyLocked={lockedKeys.has(f.key)}
                    onToggle={() => setExpanded((e) => (e === f.id ? null : f.id))}
                    onChange={(p) => updateField(f.id, p)}
                    onDuplicate={() => duplicate(f.id)}
                    onDelete={() => removeField(f.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Live Preview</h3>
            <span className="text-[10px] uppercase text-muted-foreground">how partners see it</span>
          </div>
          <PartnerDynamicForm
            definition={draft}
            values={previewValues}
            onChange={(k, v) => setPreviewValues((prev) => ({ ...prev, [k]: v }))}
            organisationOptions={orgOptions}
            columns={1}
          />
        </div>
      </div>
    </div>
  );
}

function FieldPalette({ onAdd }: { onAdd: (t: PartnerFieldType) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Add Field</h3>
      <div className="space-y-1">
        {PARTNER_FIELD_TYPES_ENABLED.map((t) => (
          <Button
            key={t}
            size="sm"
            variant="ghost"
            className="w-full justify-start text-xs"
            onClick={() => onAdd(t)}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            {PARTNER_FIELD_TYPE_LABELS[t]}
          </Button>
        ))}
      </div>
      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase text-muted-foreground">Coming Soon</h3>
      <div className="space-y-1">
        {PARTNER_FIELD_TYPES_DISABLED.map((t) => (
          <div key={t} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {PARTNER_FIELD_TYPE_LABELS[t]}
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableFieldRow({
  field,
  expanded,
  keyLocked,
  onToggle,
  onChange,
  onDuplicate,
  onDelete,
}: {
  field: PartnerField;
  expanded: boolean;
  keyLocked: boolean;
  onToggle: () => void;
  onChange: (p: Partial<PartnerField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className="font-medium text-sm">{field.label || field.key}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {PARTNER_FIELD_TYPE_LABELS[field.type]}
          </span>
          {field.system && (
            <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-brand-primary">system</span>
          )}
        </button>
        <div className="flex items-center gap-3">
          <ToggleTiny label="Visible" checked={field.visible} onChange={(v) => onChange({ visible: v })} />
          <ToggleTiny label="Required" checked={field.required} onChange={(v) => onChange({ required: v })} />
          <ToggleTiny label="Enabled" checked={field.enabled} onChange={(v) => onChange({ enabled: v })} />
          <Button size="sm" variant="ghost" onClick={onDuplicate} title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {!field.system && (
            <Button size="sm" variant="ghost" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-3">
          <FieldEditor field={field} onChange={onChange} keyLocked={keyLocked} />
        </div>
      )}
    </div>
  );
}

function ToggleTiny({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function FieldEditor({
  field,
  onChange,
  keyLocked,
}: {
  field: PartnerField;
  onChange: (p: Partial<PartnerField>) => void;
  keyLocked: boolean;
}) {
  const hasOptions = ["dropdown", "multiselect", "radio"].includes(field.type);
  const lockKey = field.system || keyLocked;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Row label="Label">
        <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </Row>
      <Row label="Internal Name (key)">
        <Input
          value={field.key}
          disabled={lockKey}
          onChange={(e) => onChange({ key: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() })}
        />
        {keyLocked && !field.system && (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              This field key is locked because submissions already exist. Changing the key would orphan existing data.
            </span>
          </p>
        )}
      </Row>
      <Row label="Type">
        <Select value={field.type} onValueChange={(v) => onChange({ type: v as PartnerFieldType })} disabled={field.system}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARTNER_FIELD_TYPES_ENABLED.map((t) => (
              <SelectItem key={t} value={t}>{PARTNER_FIELD_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Placeholder">
        <Input value={field.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} />
      </Row>
      <Row label="Help Text">
        <Input value={field.help} onChange={(e) => onChange({ help: e.target.value })} />
      </Row>
      <Row label="Default Value">
        <Input value={field.defaultValue} onChange={(e) => onChange({ defaultValue: e.target.value })} />
      </Row>
      <Row label="Custom Error Message">
        <Input
          value={field.validation.errorMessage ?? ""}
          onChange={(e) => onChange({ validation: { ...field.validation, errorMessage: e.target.value } })}
        />
      </Row>
      <div className="flex items-center gap-4 pt-2">
        <label className="flex items-center gap-1.5 text-xs">
          <Switch checked={field.readOnly} onCheckedChange={(v) => onChange({ readOnly: v })} /> Read only
        </label>
        {(field.type === "organisation" || field.type === "multiselect") && (
          <label className="flex items-center gap-1.5 text-xs">
            <Switch checked={!!field.multi} onCheckedChange={(v) => onChange({ multi: v })} /> Multi select
          </label>
        )}
      </div>
      <div className="sm:col-span-2 grid gap-3 sm:grid-cols-4">
        <Row label="Min Length">
          <Input
            type="number"
            value={field.validation.minLength ?? ""}
            onChange={(e) => onChange({ validation: { ...field.validation, minLength: e.target.value ? Number(e.target.value) : null } })}
          />
        </Row>
        <Row label="Max Length">
          <Input
            type="number"
            value={field.validation.maxLength ?? ""}
            onChange={(e) => onChange({ validation: { ...field.validation, maxLength: e.target.value ? Number(e.target.value) : null } })}
          />
        </Row>
        <Row label="Min (number)">
          <Input
            type="number"
            value={field.validation.min ?? ""}
            onChange={(e) => onChange({ validation: { ...field.validation, min: e.target.value ? Number(e.target.value) : null } })}
          />
        </Row>
        <Row label="Max (number)">
          <Input
            type="number"
            value={field.validation.max ?? ""}
            onChange={(e) => onChange({ validation: { ...field.validation, max: e.target.value ? Number(e.target.value) : null } })}
          />
        </Row>
      </div>
      <Row label="Regex Pattern (optional)">
        <Input
          value={field.validation.pattern ?? ""}
          placeholder="e.g. ^\\d{6}$"
          onChange={(e) => onChange({ validation: { ...field.validation, pattern: e.target.value } })}
        />
      </Row>
      {hasOptions && (
        <div className="sm:col-span-2">
          <OptionsEditor
            options={field.options}
            onChange={(options) => onChange({ options })}
          />
        </div>
      )}
      {field.type === "organisation" && (
        <div className="sm:col-span-2 rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
          Organisation options are managed per-event under Admin → Organisations.
        </div>
      )}
      <Row label="Textarea help">
        <Textarea rows={2} value={field.help} onChange={(e) => onChange({ help: e.target.value })} />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: PartnerFieldOption[];
  onChange: (o: PartnerFieldOption[]) => void;
}) {
  const list = useMemo(() => options, [options]);
  function patch(i: number, p: Partial<PartnerFieldOption>) {
    onChange(list.map((o, idx) => (idx === i ? { ...o, ...p } : o)));
  }
  function add() {
    onChange([
      ...list,
      {
        id: `opt_${Math.random().toString(36).slice(2, 8)}`,
        label: `Option ${list.length + 1}`,
        value: `option_${list.length + 1}`,
        enabled: true,
      },
    ]);
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div className="space-y-2">
      <Label className="text-[11px] text-muted-foreground">Options</Label>
      {list.map((o, i) => (
        <div key={o.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-2">
          <Input value={o.label} onChange={(e) => patch(i, { label: e.target.value })} placeholder="Label" />
          <Input value={o.value} onChange={(e) => patch(i, { value: e.target.value })} placeholder="Value" />
          <Switch checked={o.enabled} onCheckedChange={(v) => patch(i, { enabled: v })} />
          <Button size="sm" variant="ghost" onClick={() => move(i, -1)}>↑</Button>
          <Button size="sm" variant="ghost" onClick={() => move(i, 1)}>↓</Button>
          <Button size="sm" variant="ghost" onClick={() => remove(i)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="mr-1 h-3 w-3" /> Add option
      </Button>
    </div>
  );
}
