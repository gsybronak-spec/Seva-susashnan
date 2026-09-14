// Renders a Partner Registration Form from a dynamic PartnerFormDefinition.
// Shared by the Admin builder (as a live preview + the create/edit dialog) and
// by any future public partner-onboarding surface.

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PARTNER_FIELD_TYPES_ENABLED,
  type PartnerField,
  type PartnerFormDefinition,
} from "@/lib/partner-form";

export type PartnerFormValues = Record<string, unknown>;

export function PartnerDynamicForm({
  definition,
  values,
  onChange,
  errors,
  organisationOptions,
  disabled,
  columns = 2,
}: {
  definition: PartnerFormDefinition;
  values: PartnerFormValues;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string | null>;
  organisationOptions: Array<{ id: string; name: string }>;
  disabled?: boolean;
  columns?: 1 | 2;
}) {
  const visibleFields = useMemo(
    () => definition.fields.filter((f) => f.visible && f.type !== "hidden"),
    [definition.fields],
  );

  return (
    <div className={`grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {visibleFields.map((f) => (
        <FieldRow
          key={f.id}
          field={f}
          value={values[f.key]}
          error={errors?.[f.key] ?? null}
          onChange={(v) => onChange(f.key, v)}
          organisationOptions={organisationOptions}
          disabled={disabled || !f.enabled || f.readOnly}
        />
      ))}
    </div>
  );
}

function FieldRow({
  field,
  value,
  error,
  onChange,
  organisationOptions,
  disabled,
}: {
  field: PartnerField;
  value: unknown;
  error: string | null;
  onChange: (v: unknown) => void;
  organisationOptions: Array<{ id: string; name: string }>;
  disabled?: boolean;
}) {
  const unsupported = !PARTNER_FIELD_TYPES_ENABLED.includes(field.type);
  const labelNode = (
    <Label className="text-xs">
      {field.label}
      {field.required && <span className="ml-0.5 text-destructive">*</span>}
    </Label>
  );

  return (
    <div className="space-y-1.5">
      {labelNode}
      {renderControl(field, value, onChange, organisationOptions, !!disabled, unsupported)}
      {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function renderControl(
  field: PartnerField,
  value: unknown,
  onChange: (v: unknown) => void,
  orgs: Array<{ id: string; name: string }>,
  disabled: boolean,
  unsupported: boolean,
) {
  if (unsupported) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
        {field.type} fields coming soon — hidden on the live form.
      </div>
    );
  }
  const common = { disabled };

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          {...common}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          {...common}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "email":
      return (
        <Input
          type="email"
          {...common}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "mobile":
      return (
        <Input
          type="tel"
          inputMode="numeric"
          {...common}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "url":
      return (
        <Input
          type="url"
          {...common}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          {...common}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "dropdown":
      return (
        <Select
          value={((value as string) ?? "") || undefined}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {field.options
              .filter((o) => o.enabled)
              .map((o) => (
                <SelectItem key={o.id} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {field.options
            .filter((o) => o.enabled)
            .map((o) => {
              const checked = arr.includes(o.value);
              return (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(v) => {
                      const set = new Set(arr);
                      if (v) set.add(o.value);
                      else set.delete(o.value);
                      onChange(Array.from(set));
                    }}
                  />
                  <span>{o.label}</span>
                </label>
              );
            })}
        </div>
      );
    }
    case "radio":
      return (
        <div className="flex flex-wrap gap-3">
          {field.options
            .filter((o) => o.enabled)
            .map((o) => (
              <label key={o.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  disabled={disabled}
                  checked={value === o.value}
                  onChange={() => onChange(o.value)}
                />
                {o.label}
              </label>
            ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!value}
            disabled={disabled}
            onCheckedChange={(v) => onChange(!!v)}
          />
          {field.placeholder || field.label}
        </label>
      );
    case "yesno":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={value === "yes" || value === true}
            disabled={disabled}
            onCheckedChange={(v) => onChange(v ? "yes" : "no")}
          />
          <span className="text-xs text-muted-foreground">
            {value === "yes" || value === true ? "Yes" : "No"}
          </span>
        </div>
      );
    case "organisation": {
      const arr = Array.isArray(value)
        ? (value as string[])
        : value
          ? [String(value)]
          : [];
      if (orgs.length === 0) {
        return (
          <Input
            {...common}
            value={arr[0] ?? ""}
            placeholder={field.placeholder || "Organisation name"}
            onChange={(e) => onChange(field.multi ? (e.target.value ? [e.target.value] : []) : e.target.value)}
          />
        );
      }
      if (!field.multi) {
        return (
          <Select value={arr[0] ?? ""} onValueChange={(v) => onChange(v)} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "Select organisation"} />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.name}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      return (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {orgs.map((o) => {
            const checked = arr.includes(o.name);
            return (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) => {
                    const set = new Set(arr);
                    if (v) set.add(o.name);
                    else set.delete(o.name);
                    onChange(Array.from(set));
                  }}
                />
                <span>{o.name}</span>
              </label>
            );
          })}
        </div>
      );
    }
    default:
      return (
        <Input
          {...common}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
