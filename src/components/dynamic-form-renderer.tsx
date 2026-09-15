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
import { CheckCircle2, Ticket } from "lucide-react";
import type { FormField, VisibilityRule } from "@/lib/event-config";

export type DynamicFormValues = Record<string, any>;

interface DynamicFormRendererProps {
  fields: FormField[];
  values: DynamicFormValues;
  onChange: (key: string, value: any) => void;
  errors?: Record<string, string | null>;
  disabled?: boolean;
  isReferralApplied?: boolean;
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
  isReferralApplied = false,
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
        const isRefField = field.key === "referral_code" || field.key === "ref";
        const hasRefApplied = isRefField && (isReferralApplied || field.readonly);

        return (
          <div key={field.key} className="space-y-2 transition-all duration-200">
            {field.type !== "hidden" && (
              <Label
                htmlFor={field.key}
                className="text-sm font-semibold text-[#0F3E3E] flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  {isRefField && <Ticket className="h-3.5 w-3.5 text-[#4E7D66]" />}
                  <span>{field.label}</span>
                  {field.required && <span className="text-[#D97706] font-bold text-base leading-none">*</span>}
                </span>
                {hasRefApplied ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 animate-in fade-in">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Referral Code Applied
                  </span>
                ) : field.required ? (
                  <span className="text-[10px] uppercase font-semibold text-[#4E7D66] bg-[#4E7D66]/10 px-1.5 py-0.5 rounded">
                    Required
                  </span>
                ) : (
                  <span className="text-[10px] text-[#8C9B94]">Optional</span>
                )}
              </Label>
            )}

            {renderFieldControl({
              field,
              value: val,
              onChange: (v) => onChange(field.key, v),
              disabled: disabled || field.readonly || hasRefApplied,
              hasError: !!err,
            })}

            {field.type !== "hidden" && (
              <p className="text-xs text-[#5C7065] leading-relaxed">
                {hasRefApplied
                  ? "Code from invitation link automatically applied."
                  : field.help}
              </p>
            )}

            {err && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in duration-200">
                <span className="font-bold">⚠</span>
                <span>{err}</span>
              </div>
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
    ? "border-rose-400 ring-1 ring-rose-400/50 bg-rose-50/30"
    : "border-[#E8E0D5] hover:border-[#4E7D66]/60 focus-visible:border-[#0F3E3E] focus-visible:ring-2 focus-visible:ring-[#0F3E3E]/20";

  const isUppercase = field.key === "full_name" || field.key === "referral_code" || field.key === "ref";

  switch (field.type) {
    case "text":
      return (
        <Input
          id={field.key}
          type="text"
          value={value ?? ""}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          autoCapitalize={isUppercase ? "characters" : undefined}
          autoComplete={field.key === "full_name" ? "name" : undefined}
          onChange={(e) => {
            const v = isUppercase ? e.target.value.toUpperCase() : e.target.value;
            onChange(v);
          }}
          className={`h-12 bg-white/95 text-base sm:text-sm rounded-xl px-3.5 transition-all shadow-xs ${
            isUppercase ? "uppercase font-medium" : ""
          } ${disabled ? "bg-stone-50 cursor-not-allowed opacity-90" : ""} ${borderClasses}`}
        />
      );

    case "phone":
    case "tel" as any:
      return (
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-xs font-bold text-[#0F3E3E] pointer-events-none bg-[#FAF8F5] border border-[#E8E0D5] px-2 py-1 rounded-md shadow-xs flex items-center gap-1">
            <span>🇮🇳</span>
            <span>+91</span>
          </span>
          <Input
            id={field.key}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={10}
            value={value ?? ""}
            placeholder={field.placeholder || "10-digit mobile number"}
            disabled={disabled}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              onChange(digits);
            }}
            className={`h-12 pl-20 bg-white/95 text-base sm:text-sm font-mono tracking-wider rounded-xl transition-all shadow-xs ${borderClasses}`}
          />
        </div>
      );

    case "email":
      return (
        <Input
          id={field.key}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value ?? ""}
          placeholder={field.placeholder || "example@email.com"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`h-12 bg-white/95 text-base sm:text-sm rounded-xl px-3.5 transition-all shadow-xs ${borderClasses}`}
        />
      );

    case "number":
      return (
        <Input
          id={field.key}
          type="number"
          inputMode="numeric"
          value={value ?? ""}
          placeholder={field.placeholder || ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={`h-12 bg-white/95 text-base sm:text-sm rounded-xl px-3.5 transition-all shadow-xs ${borderClasses}`}
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
          className={`h-12 bg-white/95 text-base sm:text-sm rounded-xl px-3.5 transition-all shadow-xs ${borderClasses}`}
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
          className={`h-12 bg-white/95 text-base sm:text-sm rounded-xl px-3.5 transition-all shadow-xs ${borderClasses}`}
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
          className={`bg-white/95 text-base sm:text-sm rounded-xl p-3.5 transition-all shadow-xs ${borderClasses}`}
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
            className={`h-12 bg-white/95 text-base sm:text-sm rounded-xl px-3.5 transition-all shadow-xs ${borderClasses} ${!current ? "text-stone-400" : "text-[#0F3E3E] font-medium"}`}
          >
            <SelectValue placeholder={field.placeholder || "Select option"} />
          </SelectTrigger>
          <SelectContent className="max-h-64 bg-white border border-[#E8E0D5] shadow-xl rounded-xl">
            {options.map((opt) => {
              const optVal = opt.value || opt.label;
              return (
                <SelectItem key={optVal} value={optVal} className="text-sm py-2.5 px-3 cursor-pointer">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {options.map((opt) => {
            const optVal = opt.value || opt.label;
            const isSelected = current === optVal;
            return (
              <label
                key={optVal}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-semibold cursor-pointer transition-all min-h-[48px] ${
                  isSelected
                    ? "bg-[#FAF8F5] border-[#0F3E3E] text-[#0F3E3E] shadow-sm ring-1 ring-[#0F3E3E]/30"
                    : "bg-white/95 border-[#E8E0D5] text-[#2D4A3E] hover:border-[#4E7D66]/60 hover:bg-[#FAF8F5]/50"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "border-[#0F3E3E] bg-[#0F3E3E]" : "border-[#C8BEB0] bg-white"
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#FAF8F5]" />}
                </div>
                <input
                  type="radio"
                  name={field.key}
                  value={optVal}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onChange(optVal)}
                  className="sr-only"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "checkbox":
      return (
        <div className="flex items-center space-x-3 pt-1 p-2 rounded-xl hover:bg-stone-50 transition-colors">
          <Checkbox
            id={field.key}
            checked={!!value}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(!!checked)}
            className="w-5 h-5 rounded-md border-[#4E7D66] data-[state=checked]:bg-[#0F3E3E] data-[state=checked]:text-white"
          />
          <Label htmlFor={field.key} className="text-sm font-medium text-[#2D4A3E] cursor-pointer leading-snug">
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
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isChecked
                    ? "bg-[#0F3E3E] text-white border-[#0F3E3E] shadow-xs"
                    : "bg-white/95 text-[#2D4A3E] border-[#E8E0D5] hover:border-[#4E7D66]"
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
