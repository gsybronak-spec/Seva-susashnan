import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormField, VisibilityRule } from "@/lib/event-config";

export type DynamicFormValues = Record<string, any>;

interface DynamicFormRendererProps {
  fields: FormField[];
  values: DynamicFormValues;
  onChange: (key: string, value: any) => void;
  errors?: Record<string, string | null>;
  disabled?: boolean;
}

export function isFieldVisible(field: FormField, values: DynamicFormValues): boolean {
  if (field.hidden || field.enabled === false) return false;
  if (!field.visible_if || field.visible_if.length === 0) return true;

  // ALL rules must match (AND condition)
  return field.visible_if.every((rule: VisibilityRule) => {
    const parentVal = values[rule.field];
    const strParent = parentVal === undefined || parentVal === null ? "" : String(parentVal).trim();
    const strRule = String(rule.value).trim();

    switch (rule.operator) {
      case "equals":
        return strParent.toLowerCase() === strRule.toLowerCase();
      case "not_equals":
        return strParent.toLowerCase() !== strRule.toLowerCase();
      case "includes":
        if (Array.isArray(parentVal)) {
          return parentVal.some((item) => String(item).toLowerCase() === strRule.toLowerCase());
        }
        return strParent.toLowerCase().includes(strRule.toLowerCase());
      default:
        return true;
    }
  });
}

export function DynamicFormRenderer({
  fields,
  values,
  onChange,
  errors = {},
  disabled = false,
}: DynamicFormRendererProps) {
  // Sort by order ascending
  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [fields]);

  return (
    <div className="space-y-4">
      {sortedFields.map((field) => {
        if (!isFieldVisible(field, values)) return null;

        const val = values[field.key];
        const err = errors[field.key];

        return (
          <div key={field.key} className="space-y-1.5 transition-all duration-200">
            {field.type !== "hidden" && (
              <Label
                htmlFor={field.key}
                className="text-sm font-semibold text-[#0F3E3E] flex items-center gap-1"
              >
                <span>{field.label}</span>
                {field.required && <span className="text-rose-600 font-bold">*</span>}
              </Label>
            )}

            {renderFieldControl({
              field,
              value: val,
              onChange: (v) => onChange(field.key, v),
              disabled: disabled || field.readonly,
              hasError: !!err,
            })}

            {field.help && field.type !== "hidden" && (
              <p className="text-xs text-[#5C7065] leading-relaxed">{field.help}</p>
            )}

            {err && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                <span>⚠</span> {err}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderFieldControl({
  field,
  value,
  onChange,
  disabled,
  hasError,
}: {
  field: FormField;
  value: any;
  onChange: (val: any) => void;
  disabled: boolean;
  hasError: boolean;
}) {
  const borderClasses = hasError
    ? "border-rose-500 focus-visible:ring-rose-400"
    : "border-[#E8E0D5] focus-visible:border-[#D97706] focus-visible:ring-[#D97706]/30";

  switch (field.type) {
    case "text":
      return (
        <Input
          id={field.key}
          type="text"
          value={value ?? ""}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 bg-white/90 text-sm ${borderClasses}`}
        />
      );

    case "phone":
    case "tel" as any:
      return (
        <div className="relative flex items-center">
          <span className="absolute left-3 text-xs font-semibold text-[#4E7D66] pointer-events-none bg-stone-100 px-1.5 py-0.5 rounded">
            +91
          </span>
          <Input
            id={field.key}
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={value ?? ""}
            placeholder={field.placeholder || "10-digit mobile number"}
            disabled={disabled}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              onChange(digits);
            }}
            className={`h-11 pl-14 bg-white/90 text-sm font-mono tracking-wide ${borderClasses}`}
          />
        </div>
      );

    case "email":
      return (
        <Input
          id={field.key}
          type="email"
          value={value ?? ""}
          placeholder={field.placeholder || "example@email.com"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 bg-white/90 text-sm ${borderClasses}`}
        />
      );

    case "number":
      return (
        <Input
          id={field.key}
          type="number"
          value={value ?? ""}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={`h-11 bg-white/90 text-sm ${borderClasses}`}
        />
      );

    case "date":
      return (
        <Input
          id={field.key}
          type="date"
          value={value ?? ""}
          placeholder={field.placeholder || "YYYY-MM-DD"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 bg-white/90 text-sm ${borderClasses}`}
        />
      );

    case "time":
      return (
        <Input
          id={field.key}
          type="time"
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 bg-white/90 text-sm ${borderClasses}`}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={field.key}
          rows={3}
          value={value ?? ""}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`bg-white/90 text-sm ${borderClasses}`}
        />
      );

    case "dropdown": {
      const options = field.options ?? [];
      const current = value !== undefined && value !== null ? String(value) : "";
      return (
        <Select
          disabled={disabled}
          value={current}
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger
            id={field.key}
            className={`h-11 bg-white/90 text-sm ${borderClasses} ${!current ? "text-muted-foreground" : "text-[#0F3E3E]"}`}
          >
            <SelectValue placeholder={field.placeholder || "Select option"} />
          </SelectTrigger>
          <SelectContent className="max-h-64 bg-white border border-[#E8E0D5] shadow-lg">
            {options.map((opt) => {
              const optVal = opt.value || opt.label;
              return (
                <SelectItem key={optVal} value={optVal} className="text-sm py-2">
                  {opt.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }

    case "radio": {
      const options = field.options ?? [];
      const current = value !== undefined && value !== null ? String(value) : "";
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {options.map((opt) => {
            const optVal = opt.value || opt.label;
            const isSelected = current === optVal;
            return (
              <label
                key={optVal}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[#FAF8F5] border-[#D97706] text-[#D97706] shadow-sm ring-1 ring-[#D97706]"
                    : "bg-white/80 border-[#E8E0D5] text-[#2D4A3E] hover:border-[#4E7D66]"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name={field.key}
                  value={optVal}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onChange(optVal)}
                  className="sr-only"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "checkbox":
      return (
        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id={field.key}
            checked={!!value}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(!!checked)}
            className="border-[#4E7D66] data-[state=checked]:bg-[#4E7D66] data-[state=checked]:text-white"
          />
          <Label htmlFor={field.key} className="text-sm font-normal text-[#2D4A3E] cursor-pointer">
            {field.placeholder || field.label}
          </Label>
        </div>
      );

    case "multiselect": {
      const options = field.options ?? [];
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          {options.map((opt) => {
            const optVal = opt.value || opt.label;
            const isChecked = selected.includes(optVal);
            return (
              <button
                type="button"
                key={optVal}
                disabled={disabled}
                onClick={() => {
                  if (isChecked) {
                    onChange(selected.filter((v) => v !== optVal));
                  } else {
                    onChange([...selected, optVal]);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isChecked
                    ? "bg-[#4E7D66] text-white border-[#4E7D66]"
                    : "bg-white text-[#2D4A3E] border-[#E8E0D5] hover:border-[#4E7D66]"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {opt.label} {isChecked && "✓"}
              </button>
            );
          })}
        </div>
      );
    }

    case "hidden":
      return <input type="hidden" id={field.key} name={field.key} value={value ?? ""} />;

    default:
      return (
        <Input
          id={field.key}
          type="text"
          value={value ?? ""}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 bg-white/90 text-sm ${borderClasses}`}
        />
      );
  }
}
