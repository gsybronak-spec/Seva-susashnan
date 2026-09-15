import { BRAND } from "@/lib/brand";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerParticipant, lookupReferralCode } from "@/lib/registration.functions";
import { partnerLookup } from "@/lib/partner.functions";
import { useEventConfig, type EventConfigInitialData } from "@/hooks/use-event-config";
import type { FormField } from "@/lib/event-config";
import { DynamicFormRenderer } from "@/components/dynamic-form-renderer";
import {
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  QrCode,
  Award,
  Loader2,
  CheckCircle2,
} from "lucide-react";

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
  const [partnerInfo, setPartnerInfo] = useState<{
    partner_id: string;
    partner_name: string;
    slug: string;
  } | null>(null);

  // Referral state
  const [referralInfo, setReferralInfo] = useState<{
    status: "idle" | "validating" | "valid" | "invalid";
    referrerName?: string;
    message?: string;
  }>(() => (ref ? { status: "validating" } : { status: "idle" }));

  // Dynamic form state
  const [formValues, setFormValues] = useState<Record<string, any>>({
    ref: ref ? ref.toUpperCase() : "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});

  // Partner lookup
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
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialPartner, lookup]);

  // Non-blocking referral check
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
          setFormValues((cur) => ({ ...cur, ref: res.registration_number }));
        } else {
          setReferralInfo({
            status: "invalid",
            message: res.message || "Referral code not valid for this event.",
          });
          setFormValues((cur) => {
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

  // Compute active event fields
  const fields = useMemo(() => {
    const rawFields = config.form?.fields ?? [];
    const list: FormField[] = rawFields
      .filter((f) => f.enabled && !f.hidden)
      .filter((f) => !(partnerInfo && f.key === "designation"));

    // If district field isn't present, add it based on coverage
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
        default_value: districtName || "Vadodara",
        options: (coverageDistricts ?? []).map((d) => ({ label: d.name, value: d.id })),
        validation: {},
        visible_if: [],
        builtin: true,
        order: 6,
        help: "District where event is organized.",
      });
    }

    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [config.form?.fields, coverageDistricts, districtName, partnerInfo]);

  // Initialize default values
  useEffect(() => {
    if (fields.length > 0) {
      setFormValues((cur) => {
        const next = { ...cur };
        for (const f of fields) {
          if (next[f.key] === undefined && f.default_value) {
            next[f.key] = f.default_value;
          }
        }
        return next;
      });
    }
  }, [fields]);

  function handleFieldChange(key: string, value: any) {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      // If participant_type changed and is not Yog Trainer, clear coach_name
      if (key === "participant_type" && value !== "Yog Trainer") {
        delete next.coach_name;
      }
      return next;
    });

    // Clear error on change
    if (formErrors[key]) {
      setFormErrors((prev) => ({ ...prev, [key]: null }));
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    for (const field of fields) {
      if (!field.enabled || field.hidden) continue;

      // Check conditional visibility
      if (field.visible_if && field.visible_if.length > 0) {
        const isVisible = field.visible_if.every((rule) => {
          const parentVal = formValues[rule.field];
          const strParent = parentVal == null ? "" : String(parentVal).trim();
          const strRule = String(rule.value).trim();
          if (rule.operator === "equals") return strParent.toLowerCase() === strRule.toLowerCase();
          if (rule.operator === "not_equals") return strParent.toLowerCase() !== strRule.toLowerCase();
          return true;
        });
        if (!isVisible) continue;
      }

      const val = formValues[field.key];
      const strVal = val == null ? "" : String(val).trim();

      if (field.required && !strVal) {
        errors[field.key] = field.validation?.message || `${field.label} is required.`;
        continue;
      }

      if (strVal && (field.type === "phone" || field.key === "mobile")) {
        if (!/^[6-9]\d{9}$/.test(strVal)) {
          errors[field.key] = "Enter a valid 10-digit Indian mobile number.";
        }
      }

      if (strVal && (field.type === "email" || field.key === "email")) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(strVal)) {
          errors[field.key] = "Enter a valid email address.";
        }
      }

      if (strVal && field.key === "participant_type") {
        if (!["Yog Coach", "Yog Trainer", "Yog Sadhak"].includes(strVal)) {
          errors[field.key] = "Invalid option. Select Yog Coach, Yog Trainer, or Yog Sadhak.";
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields accurately.");
      return;
    }

    const fullName = String(formValues.full_name || "").trim();
    const mobile = String(formValues.mobile || "").replace(/\D/g, "");
    const email = formValues.email ? String(formValues.email).trim() : undefined;
    const organization = formValues.organization ? String(formValues.organization).trim() : undefined;
    const taluka = formValues.taluka ? String(formValues.taluka).trim() : undefined;
    const gender = formValues.gender && ["Male", "Female"].includes(formValues.gender) ? formValues.gender : undefined;
    const dob = formValues.date_of_birth ? String(formValues.date_of_birth).trim() : undefined;
    const designation = formValues.participant_type || formValues.designation || undefined;
    const refCodeVal = formValues.ref ? String(formValues.ref).trim().toUpperCase() : undefined;

    // Separate builtin vs custom_fields
    const builtinKeys = new Set([
      "full_name",
      "mobile",
      "email",
      "organization",
      "taluka",
      "gender",
      "date_of_birth",
      "designation",
      "district",
      "ref",
    ]);

    const custom_fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formValues)) {
      if (!builtinKeys.has(k) && v !== undefined && v !== "") {
        custom_fields[k] = v;
      }
    }

    // Always preserve participant_type in custom_fields for card display
    if (formValues.participant_type) {
      custom_fields.participant_type = formValues.participant_type;
    }
    if (formValues.zone) {
      custom_fields.zone = formValues.zone;
    }
    if (formValues.coach_name) {
      custom_fields.coach_name = formValues.coach_name;
    }
    if (formValues.coordinator_name) {
      custom_fields.coordinator_name = formValues.coordinator_name;
    }

    setSubmitting(true);
    try {
      const res = await register({
        data: {
          full_name: fullName,
          mobile,
          email,
          organization,
          taluka,
          gender,
          date_of_birth: dob,
          designation,
          ref: refCodeVal,
          partner_slug: partnerInfo ? partnerInfo.slug : undefined,
          district_slug: eventSlug || undefined,
          district_id:
            coverageDistricts && coverageDistricts.length > 0 && typeof formValues.district === "string"
              ? formValues.district
              : undefined,
          custom_fields: Object.keys(custom_fields).length ? custom_fields : undefined,
        },
      });

      if (!res.ok) {
        toast.error(res.error || "Registration could not be completed.");
        return;
      }

      // Save card access token in sessionStorage for refresh resilience
      if (typeof window !== "undefined" && res.card_access) {
        try {
          window.sessionStorage.setItem(`gsyb_card_access:${res.registration_number}`, res.card_access);
        } catch {}
      }

      toast.success("Registration completed successfully!");

      const successPath = eventSlug ? `/${eventSlug}/success` : "/success";
      navigate({
        to: successPath,
        search: {
          reg: res.registration_number,
          key: res.card_access,
        },
      });
    } catch (err) {
      console.error("Registration submit error:", err);
      toast.error("Registration failed. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const eventTitle = config.general?.title || "Gujarat State Yog Board Camp";
  const eventDate = config.general?.event_date || "20 September 2026";
  const eventTime =
    config.general?.start_time && config.general?.end_time
      ? `${config.general.start_time} – ${config.general.end_time}`
      : "06:00 AM – 08:00 AM";
  const venue =
    config.venue ||
    (config.general as any)?.venue_address ||
    "Railway Police Parade Ground, Kothi Kacheri Char Rasta, Vadodara";

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2623] py-6 sm:py-10 px-4 sm:px-6 relative overflow-hidden">
      {/* Decorative Natural Lotus Motif Background */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 sm:w-96 h-80 sm:h-96 pointer-events-none opacity-40 z-0">
        <img
          src="/images/lotus-motif.svg"
          alt=""
          className="w-full h-full object-contain"
          aria-hidden="true"
        />
      </div>

      <div className="max-w-xl mx-auto space-y-6 relative z-10">
        {/* Authority Header & Branding */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF8F5] border border-[#E8E0D5] text-[#0F3E3E] text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
            <span>ગુજરાત રાજ્ય યોગ બોર્ડ • સત્તાવાર પોર્ટલ</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F3E3E] tracking-tight leading-tight">
            {eventTitle}
          </h1>

          <p className="text-xs sm:text-sm font-medium text-[#4E7D66]">
            રમતગમત, યુવા અને સાંસ્કૃતિક પ્રવૃત્તિઓ વિભાગ, ગુજરાત સરકાર
          </p>
        </div>

        {/* Event Logistics Quick Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white/90 backdrop-blur-md border border-[#E8E0D5] shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#0F3E3E]">તારીખ / Date</p>
                <p className="text-[#5C7065]">{eventDate} (રવિવાર)</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#0F3E3E]">સમય / Time</p>
                <p className="text-[#5C7065]">{eventTime}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-[#E8E0D5] text-xs">
            <MapPin className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#0F3E3E]">સ્થળ / Venue</p>
              <p className="text-[#5C7065] leading-relaxed">{venue}</p>
            </div>
          </div>

          {/* 3 Participant Guarantees */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4E7D66] font-medium">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> નિઃશુલ્ક પ્રવેશ
            </span>
            <span className="flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-[#D97706]" /> ડિજિટલ QR પાસ
            </span>
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-purple-600" /> ઇ-પ્રમાણપત્ર
            </span>
          </div>
        </div>

        {/* Main Registration Card */}
        <div className="rounded-2xl bg-white border border-[#E8E0D5] shadow-lg overflow-hidden">
          {/* Top Indian Tricolor Stripe */}
          <div className="h-1.5 w-full flex">
            <div className="w-1/3 bg-[#FF9933]" />
            <div className="w-1/3 bg-white" />
            <div className="w-1/3 bg-[#138808]" />
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-[#E8E0D5] pb-4">
              <h2 className="text-lg font-bold text-[#0F3E3E]">
                સહભાગી નોંધણી ફોર્મ / Registration Form
              </h2>
              <p className="text-xs text-[#5C7065] mt-0.5">
                કૃપા કરીને નીચે આપેલ માહિતી ધ્યાનપૂર્વક ભરો. (Fields marked with * are required)
              </p>
            </div>

            {/* Referral Info Banner */}
            {ref && referralInfo.status === "valid" && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Referred by <strong>{referralInfo.referrerName || ref.toUpperCase()}</strong> ({ref.toUpperCase()})
                </span>
              </div>
            )}

            {/* Dynamic Form Engine */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <DynamicFormRenderer
                fields={fields}
                values={formValues}
                onChange={handleFieldChange}
                errors={formErrors}
                disabled={submitting}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-bold rounded-xl shadow-md text-sm gap-2 transition-all"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{submitting ? "નોંધણી થઈ રહી છે..." : "Complete Registration / નોંધણી કરો"}</span>
              </Button>

              <p className="text-[11px] text-center text-[#64748B]">
                નોંધણી પૂર્ણ કર્યા પછી તમને તાત્કાલિક તમારો ડિજિટલ ID કાર્ડ અને પ્રવેશ QR કોડ મળશે.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
