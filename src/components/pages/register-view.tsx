import { BRAND } from "@/lib/brand";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerParticipant, lookupReferralCode } from "@/lib/registration.functions";
import { partnerLookup } from "@/lib/partner.functions";
import { useEventConfig, type EventConfigInitialData } from "@/hooks/use-event-config";
import type { FormField } from "@/lib/event-config";

type Designation = "" | "Yoga Coach" | "Yoga Trainer" | "Yoga Sadhak" | "Other";

export type RegisterViewProps = {
  eventSlug?: string;
  refCode?: string;
  partnerSlug?: string;
  initialData?: EventConfigInitialData | null;
};

export function RegisterView({
  eventSlug,
  refCode,
  partnerSlug,
  initialData,
}: RegisterViewProps) {
  const ref = refCode ?? "";
  const initialPartner = partnerSlug ? partnerSlug.trim().toUpperCase() : "";
  const navigate = useNavigate();
  const register = useServerFn(registerParticipant);
  const lookup = useServerFn(partnerLookup);
  const lookupRef = useServerFn(lookupReferralCode);
  const { config, isLoading, districtName, coverageDistricts } = useEventConfig(
    eventSlug ?? null,
    initialData,
  );
  const [submitting, setSubmitting] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<
    { partner_id: string; partner_name: string; slug: string } | null
  >(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  // Referral state: non-blocking validation against the current event
  const [referralInfo, setReferralInfo] = useState<{
    status: "idle" | "validating" | "valid" | "invalid";
    referrerName?: string;
    message?: string;
  }>(() => (ref ? { status: "validating" } : { status: "idle" }));

  const [values, setValues] = useState<Record<string, unknown>>({
    ref: ref ? ref.toUpperCase() : "",
  });

  useEffect(() => {
    if (!initialPartner) return;
    let cancelled = false;
    lookup({ data: { slug: initialPartner } })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPartnerInfo({
            partner_id: res.partner_id,
            partner_name: res.partner_name,
            slug: res.slug,
          });
        } else {
          setPartnerError(res.error);
        }
      })
      .catch(() => setPartnerError("Could not verify partner link."));
    return () => {
      cancelled = true;
    };
  }, [initialPartner, lookup]);

  // Non-blocking background validation for referral code against THIS event
  useEffect(() => {
    if (!ref) {
      setReferralInfo({ status: "idle" });
      return;
    }
    let cancelled = false;
    lookupRef({ data: { ref, district_slug: eventSlug } })
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.valid) {
          setReferralInfo({
            status: "valid",
            referrerName: res.full_name,
          });
          setValues((cur) => ({ ...cur, ref: res.registration_number }));
        } else {
          setReferralInfo({
            status: "invalid",
            message: res.message || "This referral code is not valid for this event.",
          });
          // Clear values.ref so the participant can still register normally without failing
          setValues((cur) => {
            const next = { ...cur };
            delete next.ref;
            return next;
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setReferralInfo({
          status: "invalid",
          message: "Referral code could not be verified. You can still register below.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [ref, eventSlug, lookupRef]);

  const districtLabel = useMemo(() => {
    if (districtName && districtName.trim().length > 0) return districtName.trim();
    if (eventSlug && eventSlug.trim().length > 0) {
      const s = eventSlug.trim();
      if (!/^event[-_0-9]/i.test(s) && !/-zone$/i.test(s)) {
        return s.charAt(0).toUpperCase() + s.slice(1);
      }
    }
    return BRAND.regionName;
  }, [districtName, eventSlug]);

  const fields = useMemo(
    () => {
      const list = config.form.fields
        .filter((f) => f.enabled)
        .filter((f) => !(partnerInfo && f.key === "designation"));
      if (!list.some((f) => f.key === "district")) {
        list.push({
          key: "district",
          type: coverageDistricts && coverageDistricts.length > 0 ? "dropdown" : "text",
          label: "District",
          placeholder: "Select District",
          required: true,
          enabled: true,
          readonly: !(coverageDistricts && coverageDistricts.length > 0),
          unique: false,
          hidden: false,
          default_value: "",
          options: [],
          validation: {},
          visible_if: [],
          builtin: true,
          order: 5,
          help:
            coverageDistricts && coverageDistricts.length > 0
              ? "Please select your district from the options available."
              : "District is automatically selected based on the active event.",
        });
      }
      return list.sort((a, b) => a.order - b.order);
    },
    [config.form.fields, partnerInfo, coverageDistricts],
  );

  const [seeded, setSeeded] = useState(false);
  if (!seeded && fields.length > 0) {
    setValues((cur) => {
      const next = { ...cur };
      for (const f of fields) {
        if (next[f.key] === undefined && f.default_value) next[f.key] = f.default_value;
      }
      return next;
    });
    setSeeded(true);
  }

  function setV(key: string, val: unknown) {
    setValues((cur) => ({ ...cur, [key]: val }));
  }
  function get(key: string): string {
    const v = values[key];
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  function validateField(f: FormField, v: unknown): string | null {
    const s = typeof v === "string" ? v : v == null ? "" : String(v);
    const isEmpty = s.trim() === "" || (Array.isArray(v) && v.length === 0);
    if (f.key === "district") {
      if (coverageDistricts && coverageDistricts.length > 0) {
        if (isEmpty) return "Please select your district.";
      }
      return null;
    }
    if (f.required && isEmpty) return f.validation.message || `${f.label} is required.`;
    if (isEmpty) return null;
    const { min, max, pattern } = f.validation;
    const isNumeric = f.type === "number";
    if (isNumeric) {
      const n = Number(s);
      if (Number.isFinite(n)) {
        if (min != null && n < min) return f.validation.message || `${f.label} must be at least ${min}.`;
        if (max != null && n > max) return f.validation.message || `${f.label} must be at most ${max}.`;
      }
    } else if (typeof s === "string") {
      if (min != null && s.length < min) return f.validation.message || `${f.label} must be at least ${min} characters.`;
      if (max != null && s.length > max) return f.validation.message || `${f.label} must be at most ${max} characters.`;
    }
    if (pattern) {
      try { if (!new RegExp(pattern).test(s)) return f.validation.message || `${f.label} is invalid.`; } catch { /* ignore bad regex */ }
    }
    return null;
  }

  function fieldVisible(f: FormField): boolean {
    if (!f.enabled || f.hidden) return false;
    const rules = f.visible_if ?? [];
    if (rules.length === 0) return true;
    for (const r of rules) {
      const other = values[r.field];
      const otherStr = Array.isArray(other) ? other.map(String) : other == null ? "" : String(other);
      const match = Array.isArray(otherStr)
        ? otherStr.includes(r.value)
        : r.operator === "not_equals"
        ? otherStr !== r.value
        : r.operator === "includes"
        ? otherStr.includes(r.value)
        : otherStr === r.value;
      if (!match) return false;
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    for (const f of fields) {
      if (!fieldVisible(f) && f.type !== "hidden") continue;
      const err = validateField(f, values[f.key]);
      if (err) { toast.error(err); return; }
    }

    if (coverageDistricts && coverageDistricts.length > 0) {
      const selectedDistrict = typeof values.district === "string" ? values.district.trim() : "";
      if (!selectedDistrict) {
        toast.error("Please select your district.");
        return;
      }
      if (!coverageDistricts.some((d) => d.id === selectedDistrict)) {
        toast.error("Please select a valid district from the options available.");
        return;
      }
    }

    const isOn = (key: string) => fields.some((f) => f.key === key && f.enabled);

    const full_name = get("full_name").trim();
    const mobile = get("mobile").replace(/\D/g, "");
    const email = get("email").trim();
    const organization = get("organization").trim();
    const taluka = get("taluka").trim();
    const designation = get("designation").trim() as Designation;
    const gender = get("gender").trim();
    const date_of_birth = get("date_of_birth").trim();
    const refTrimmed = get("ref").trim().toUpperCase();

    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (isOn("designation") && designation && !["Yoga Coach", "Yoga Trainer", "Yoga Sadhak", "Other"].includes(designation)) {
      toast.error("Please select a valid designation.");
      return;
    }
    if (isOn("gender") && gender && !["Male", "Female", "Other"].includes(gender)) {
      toast.error("Please select a valid gender.");
      return;
    }
    if (isOn("date_of_birth") && date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
      toast.error("Please enter a valid date of birth.");
      return;
    }

    // Process referral code gracefully: an invalid or cross-event referral
    // MUST NEVER block the participant from completing registration.
    let finalRef: string | undefined = undefined;
    if (refTrimmed) {
      if (referralInfo.status === "invalid") {
        // Referral was invalid or belongs to another event: ignore attribution safely
        finalRef = undefined;
      } else if (/^SYB[A-Z0-9_-]{4,}$/i.test(refTrimmed)) {
        finalRef = refTrimmed;
      }
    }

    const builtin = new Set(["full_name", "mobile", "email", "gender", "date_of_birth", "district", "taluka", "organization", "designation", "ref"]);

    const custom_fields: Record<string, unknown> = {};
    for (const f of fields) {
      if (builtin.has(f.key)) continue;
      const v = values[f.key];
      if (v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
        custom_fields[f.key] = v;
      }
    }

    setSubmitting(true);
    const timeoutPromise = new Promise<{ ok: false; error: string }>((resolve) =>
      setTimeout(
        () => resolve({ ok: false, error: "Registration is taking longer than usual. Please try again." }),
        15_000,
      ),
    );

    try {
      const res = await Promise.race([
        register({
          data: {
            full_name,
            mobile,
            email: email || undefined,
            organization: organization || undefined,
            taluka: taluka || undefined,
            gender: isOn("gender") && gender
              ? (gender as "Male" | "Female" | "Other")
              : undefined,
            date_of_birth: isOn("date_of_birth") && date_of_birth ? date_of_birth : undefined,
            designation: partnerInfo
              ? undefined
              : isOn("designation") && designation
                ? (designation as "Yoga Coach" | "Yoga Trainer" | "Yoga Sadhak" | "Other")
                : undefined,
            ref: finalRef,
            partner_slug: partnerInfo ? partnerInfo.slug : undefined,
            district_slug: eventSlug || undefined,
            district_id: coverageDistricts && coverageDistricts.length > 0 && typeof values.district === "string" ? values.district : undefined,
            custom_fields: Object.keys(custom_fields).length ? custom_fields : undefined,
          },
        }),
        timeoutPromise,
      ]);

      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Physical check-in flow: after registering, send the participant to
      // the success page which links to their ID card for the venue.
      const successPath = eventSlug ? `/${eventSlug}/success` : "/success";
      navigate({ to: successPath, search: { reg: res.registration_number } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const isMultiDistrictEvent = !!(coverageDistricts && coverageDistricts.length > 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 text-center">
        <p className="kicker justify-center">Registration</p>
        <h1 className="display-2 mt-2">{config.general.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {!isMultiDistrictEvent && districtLabel ? `${districtLabel} District` : " "}
        </p>
        {/* trust strip — the three things every participant receives */}
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-success" />
            Free registration
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
            Instant participant ID &amp; QR pass
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            Official participation certificate
          </li>
        </ul>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="brand-bar h-1 w-full" />
        <form onSubmit={onSubmit} className="space-y-5 p-6 sm:p-8">
          {ref && referralInfo.status === "valid" && (
            <div className="rounded-md bg-accent/60 px-3 py-2 text-xs text-brand-primary">
              Referred by <span className="font-semibold">{referralInfo.referrerName || ref.toUpperCase()}</span> ({ref.toUpperCase()})
            </div>
          )}

          {ref && referralInfo.status === "validating" && (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
              Verifying referral code {ref.toUpperCase()}…
            </div>
          )}

          {ref && referralInfo.status === "invalid" && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {referralInfo.message || "Referral code is not valid for this event. You can still complete your registration below."}
            </div>
          )}

          {initialPartner && partnerError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {partnerError}
            </div>
          )}

          {partnerInfo && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Partner</Label>
              <Input value={partnerInfo.partner_name} disabled readOnly />
              <p className="text-xs text-muted-foreground">
                Registering through partner link ({partnerInfo.slug}).
              </p>
            </div>
          )}

          {/* Until this event's own form definition has loaded we must not
              render the built-in default fields: doing so briefly showed a
              generic locked "District" field that does not belong to this
              event. Show a neutral placeholder instead. */}
          {isLoading ? (
            <div className="space-y-4" aria-busy="true">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <p className="text-sm text-muted-foreground">Loading registration form…</p>
            </div>
          ) : (
            fields.filter(fieldVisible).map((f) => (
              <FieldRenderer
                key={f.key}
                field={f}
                value={values[f.key]}
                setValue={(v) => setV(f.key, v)}
                refLocked={!!ref && f.key === "ref" && referralInfo.status === "valid"}
                districtLabel={districtLabel}
                coverageDistricts={coverageDistricts}
                refStatus={referralInfo.status}
              />
            ))
          )}

          <Button type="submit" size="lg" disabled={submitting || isLoading} className="h-12 w-full text-base">
            {submitting ? "Registering..." : "Register"}
          </Button>

        </form>
      </div>
    </div>
  );
}

function FieldRenderer({
  field, value, setValue, refLocked, districtLabel, coverageDistricts, refStatus,
}: {
  field: FormField;
  value: unknown;
  setValue: (v: unknown) => void;
  refLocked: boolean;
  districtLabel: string;
  coverageDistricts?: { id: string; slug: string; name: string }[] | null;
  refStatus?: "idle" | "validating" | "valid" | "invalid";
}) {
  if (field.hidden || field.type === "hidden") return null;

  const label = (
    <Label className="text-sm font-medium">
      {field.label} {field.required && <span className="text-destructive">*</span>}
    </Label>
  );
  const help = field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null;

  if (field.key === "district") {
    if (coverageDistricts && coverageDistricts.length > 0) {
      return (
        <div className="space-y-1.5">{label}
          <Select value={typeof value === "string" ? value : ""} onValueChange={(v) => setValue(v)}>
            <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
            <SelectContent>
              {coverageDistricts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Please select your district from the options available.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">{label}
        <Input value={districtLabel} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          District is automatically selected based on the active event.
        </p>
      </div>
    );
  }


  if (field.key === "mobile") {
    return (
      <div className="space-y-1.5">{label}
        <Input
          required={field.required}
          inputMode="numeric"
          pattern="[6-9][0-9]{9}"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder={field.placeholder}
          readOnly={field.readonly}
        />
        {help}
      </div>
    );
  }

  if (field.key === "ref") {
    let statusHelp = help;
    if (refLocked && refStatus === "valid") {
      statusHelp = <p className="text-xs text-brand-primary">Auto-filled from your verified invitation link.</p>;
    } else if (refStatus === "invalid") {
      statusHelp = (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Referral code was not valid for this event. You can leave this blank or enter another code.
        </p>
      );
    } else if (refStatus === "validating") {
      statusHelp = <p className="text-xs text-muted-foreground">Verifying invitation code…</p>;
    }
    return (
      <div className="space-y-1.5">{label}
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value.toUpperCase().slice(0, 16))}
          placeholder={field.placeholder}
          readOnly={refLocked || field.readonly}
        />
        {statusHelp}
      </div>
    );
  }

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-1.5">{label}
          <Textarea
            required={field.required}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder}
            readOnly={field.readonly}
          />
          {help}
        </div>
      );
    case "dropdown":
      return (
        <div className="space-y-1.5">{label}
          <Select value={typeof value === "string" ? value : ""} onValueChange={(v) => setValue(v)} disabled={field.readonly}>
            <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
            <SelectContent>
              {field.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {help}
        </div>
      );
    case "radio":
      return (
        <div className="space-y-2">{label}
          <div className="space-y-1">
            {field.options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input type="radio" name={field.key} value={o.value} checked={value === o.value} onChange={() => setValue(o.value)} disabled={field.readonly} />
                {o.label}
              </label>
            ))}
          </div>
          {help}
        </div>
      );
    case "checkbox":
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">{label}
          <div className="space-y-1">
            {field.options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={arr.includes(o.value)}
                  disabled={field.readonly}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value);
                    setValue(next);
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
          {help}
        </div>
      );
    }
    case "number":
    case "date":
    case "time":
    case "email":
    case "phone":
    case "text":
    default: {
      const typeMap: Record<string, string> = {
        number: "number", date: "date", time: "time", email: "email", phone: "tel", text: "text",
      };
      return (
        <div className="space-y-1.5">{label}
          <Input
            type={typeMap[field.type] ?? "text"}
            required={field.required}
            value={typeof value === "string" ? value : value == null ? "" : String(value)}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder}
            readOnly={field.readonly}
            maxLength={field.type === "text" ? 500 : undefined}
          />
          {help}
        </div>
      );
    }
  }
}
