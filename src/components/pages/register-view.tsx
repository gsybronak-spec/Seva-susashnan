import { BRAND } from "@/lib/brand";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerParticipant, lookupReferralCode } from "@/lib/registration.functions";
import { partnerLookup } from "@/lib/partner.functions";
import { useEventConfig, type EventConfigInitialData } from "@/hooks/use-event-config";
import { type FormField, formatTimeRange } from "@/lib/event-config";
import { DynamicFormRenderer } from "@/components/dynamic-form-renderer";
import {
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  QrCode,
  Loader2,
  CheckCircle2,
  AlertCircle,
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

  const eventLevel = String(config.general?.level || (config as any).type || "").trim().toLowerCase();
  const isDistrictEvent = eventLevel === "district";
  const targetDistrict = (
    districtName ||
    (config as any).district_name ||
    (config as any).district ||
    (config.general as any)?.district ||
    ""
  ).trim();

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
  const [formValues, setFormValues] = useState<Record<string, any>>(() => ({
    ref: ref ? ref.toUpperCase() : "",
    referral_code: ref ? ref.toUpperCase() : "",
    ...(isDistrictEvent && targetDistrict ? { district: targetDistrict } : {}),
  }));
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
          setFormValues((cur) => ({
            ...cur,
            ref: res.registration_number,
            referral_code: res.registration_number,
          }));
        } else {
          setReferralInfo({
            status: "invalid",
            message: res.message || "Referral code not valid for this event.",
          });
          setFormValues((cur) => {
            const next = { ...cur };
            delete next.ref;
            delete next.referral_code;
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
      .filter((f) => !(partnerInfo && f.key === "designation"))
      .map((f) => {
        if ((f.key === "referral_code" || f.key === "ref") && ref) {
          return {
            ...f,
            readonly: true,
            default_value: ref.toUpperCase(),
            help: "Code from invitation link automatically applied.",
          };
        }
        if (f.key === "district" && isDistrictEvent && targetDistrict) {
          return {
            ...f,
            type: "text",
            label: f.label || "District / Area",
            placeholder: targetDistrict,
            required: true,
            readonly: true,
            default_value: targetDistrict,
            help: "District is pre-filled for this event.",
            options: [],
          };
        }
        return f;
      });

    // If district field isn't present, add it based on coverage/level
    if (!list.some((f) => f.key === "district")) {
      if (isDistrictEvent && targetDistrict) {
        list.push({
          key: "district",
          type: "text",
          label: "District / Area",
          placeholder: targetDistrict,
          required: true,
          enabled: true,
          readonly: true,
          unique: false,
          hidden: false,
          default_value: targetDistrict,
          options: [],
          validation: {},
          visible_if: [],
          builtin: true,
          order: 6,
          help: "District is pre-filled for this event.",
        });
      } else {
        list.push({
          key: "district",
          type: coverageDistricts && coverageDistricts.length > 0 ? "dropdown" : "text",
          label: "District / Area",
          placeholder: "Select District",
          required: true,
          enabled: true,
          readonly: !(coverageDistricts && coverageDistricts.length > 0),
          unique: false,
          hidden: false,
          default_value: districtName || "",
          options: (coverageDistricts ?? []).map((d) => ({ label: d.name, value: d.id })),
          validation: {},
          visible_if: [],
          builtin: true,
          order: 6,
          help: "District where event is organized.",
        });
      }
    }

    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [config.form?.fields, coverageDistricts, districtName, partnerInfo, ref, isDistrictEvent, targetDistrict]);

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
        if (isDistrictEvent && targetDistrict) {
          next.district = targetDistrict;
        }
        return next;
      });
    }
  }, [fields, isDistrictEvent, targetDistrict]);

  function handleFieldChange(key: string, value: any) {
    if (isDistrictEvent && key === "district") {
      return; // Locked: do not allow modification
    }
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

      if (strVal && field.key === "full_name") {
        if (strVal.length < 2) {
          errors[field.key] = "Full Name must be at least 2 characters.";
        }
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

      if (strVal && field.type === "dropdown" && field.options && field.options.length > 0) {
        const validValues = field.options.map((o) => String(o.value ?? o.label).toLowerCase());
        if (!validValues.includes(strVal.toLowerCase())) {
          errors[field.key] = `Please select a valid option for ${field.label}.`;
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

    const fullName = String(formValues.full_name || "").trim().toUpperCase();
    const mobile = String(formValues.mobile || "").replace(/\D/g, "");
    const email = formValues.email ? String(formValues.email).trim() : undefined;
    const organization = formValues.organization ? String(formValues.organization).trim() : undefined;
    const taluka = formValues.taluka ? String(formValues.taluka).trim() : undefined;
    const gender = formValues.gender && ["Male", "Female"].includes(formValues.gender) ? formValues.gender : undefined;
    const dob = formValues.date_of_birth ? String(formValues.date_of_birth).trim() : undefined;
    const designation = formValues.participant_type || formValues.designation || undefined;
    const refCodeVal = formValues.referral_code || formValues.ref
      ? String(formValues.referral_code || formValues.ref).trim().toUpperCase()
      : undefined;

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
      "referral_code",
    ]);

    const custom_fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formValues)) {
      if (!builtinKeys.has(k) && v !== undefined && v !== "") {
        custom_fields[k] = v;
      }
    }

    const effectiveDistrict = isDistrictEvent && targetDistrict ? targetDistrict : formValues.district;

    // 5-field mapping
    if (effectiveDistrict) {
      custom_fields.district = effectiveDistrict;
      if (!isDistrictEvent) {
        custom_fields.area_type = effectiveDistrict === "VADODARA RURAL" ? "gramya" : "municipal";
        if (effectiveDistrict === "VADODARA RURAL") {
          custom_fields.rural_taluka = "VADODARA RURAL";
        } else {
          custom_fields.municipal_zone = effectiveDistrict;
        }
      }
    }
    if (formValues.reference_name) {
      custom_fields.reference_name = String(formValues.reference_name).trim().toUpperCase();
    }
    if (refCodeVal) {
      custom_fields.referral_code = refCodeVal;
    }

    // Always preserve participant_type in custom_fields for card display if present
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
          window.sessionStorage.setItem(`vadodara_card_access:${res.registration_number}`, res.card_access);
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

  const eventTitle = config.general?.title || "ગુજરાત રાજ્ય યોગ બોર્ડ યોગ શિબિર";
  const rawDate = config.general?.event_date || (config as any)?.event_date;
  const eventDate = rawDate
    ? new Date(rawDate + (rawDate.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const eventTime =
    (config.general?.start_time && config.general?.end_time
      ? formatTimeRange(config.general.start_time, config.general.end_time)
      : null) ||
    config.general?.event_time ||
    (config as any)?.event_time ||
    formatTimeRange(config.general?.start_time, config.general?.end_time) ||
    "06:00 AM – 08:00 AM";
  const venue =
    (config.venue && config.venue.trim().length > 0 ? config.venue.trim() : null) ||
    ((config.general as any)?.venue && (config.general as any).venue.trim().length > 0 ? (config.general as any).venue.trim() : null) ||
    ((config.general as any)?.venue_address && (config.general as any).venue_address.trim().length > 0 ? (config.general as any).venue_address.trim() : null) ||
    "સ્થળ ટૂંક સમયમાં જાહેર કરવામાં આવશે";
  const isRegistrationClosed =
    config.features?.registration === false ||
    (config.general as any)?.registration_mode === "external";
  const contactMobile = config.general?.contact_mobile || (config.general as any)?.contact_mobiles?.[0] || "";

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2623] pt-3 sm:pt-5 pb-8 sm:pb-12 px-3.5 sm:px-6 relative overflow-x-hidden">
      {/* Subtle Ambient Lotus Watermark (Top Right & Bottom Left) */}
      <div className="fixed -top-12 -right-12 w-64 sm:w-80 h-64 sm:h-80 pointer-events-none opacity-20 z-0">
        <img
          src="/images/lotus-transparent.svg"
          alt=""
          className="w-full h-full object-contain"
          aria-hidden="true"
        />
      </div>
      <div className="fixed -bottom-16 -left-16 w-60 sm:w-72 h-60 sm:h-72 pointer-events-none opacity-15 z-0">
        <img
          src="/images/lotus-transparent.svg"
          alt=""
          className="w-full h-full object-contain rotate-45"
          aria-hidden="true"
        />
      </div>

      <div className="max-w-xl mx-auto space-y-4 sm:space-y-6 relative z-10">
        {/* Compact Mobile Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E0D5] bg-[#0F3E3E] text-white shadow-lg">
          {/* Natural Yoga Background Visual with Soft Dark Gradient */}
          <div className="absolute inset-0 z-0">
            <img
              src="/images/yoga-hero-dawn.jpg"
              alt="Yoga Serenity at Dawn"
              className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F3E3E] via-[#0F3E3E]/85 to-[#0F3E3E]/60" />
          </div>

          {/* Decorative Transparent Lotus Accent */}
          <div className="absolute top-2 right-2 w-28 sm:w-36 h-28 sm:h-36 opacity-30 pointer-events-none z-0">
            <img
              src="/images/lotus-transparent.svg"
              alt=""
              className="w-full h-full object-contain"
              aria-hidden="true"
            />
          </div>

          {/* Compact Content */}
          <div className="relative z-10 p-4 sm:p-6 space-y-3">
            {/* Official GSYB Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[#FEF3C7] text-[11px] font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>ગુજરાત રાજ્ય યોગ બોર્ડ • સત્તાવાર પોર્ટલ</span>
            </div>

            {/* Event Title */}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                {eventTitle}
              </h1>
              <p className="text-xs sm:text-sm font-medium text-emerald-200 mt-1">
                રમતગમત, યુવા અને સાંસ્કૃતિક પ્રવૃત્તિઓ વિભાગ, ગુજરાત સરકાર
              </p>
            </div>

            {/* Event Logistics Badge Row */}
            <div className="pt-2 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-100">
                <Calendar className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <span><strong>{eventDate || "તારીખ ટૂંક સમયમાં"}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-emerald-100">
                <Clock className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <span>{eventTime}</span>
              </div>
              <div className="flex items-start gap-2 text-emerald-100 sm:col-span-2 pt-0.5">
                <MapPin className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                <span className="line-clamp-2 text-[11.5px] leading-relaxed">{venue}</span>
              </div>
            </div>

            {/* Participant Perks */}
            <div className="pt-2 flex flex-wrap items-center justify-start gap-4 text-[11px] text-[#FEF3C7] border-t border-white/10">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> નિઃશુલ્ક પ્રવેશ (Free)
              </span>
              <span className="flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-[#F59E0B]" /> ડિજિટલ QR પાસ
              </span>
            </div>
          </div>
        </div>

        {/* Main Registration Form Glass Card */}
        <div className="relative rounded-2xl bg-white/95 backdrop-blur-md border border-[#E8E0D5] shadow-xl shadow-[#0F3E3E]/5 overflow-hidden">
          {/* Top Indian Tricolor Stripe */}
          <div className="h-1.5 w-full flex">
            <div className="w-1/3 bg-[#FF9933]" />
            <div className="w-1/3 bg-white" />
            <div className="w-1/3 bg-[#138808]" />
          </div>

          {/* Form Header */}
          <div className="p-5 sm:p-8 space-y-6">
            <div className="border-b border-[#E8E0D5] pb-4">
              <h2 className="text-lg sm:text-xl font-bold text-[#0F3E3E] tracking-tight">
                સહભાગી નોંધણી ફોર્મ / Registration Form
              </h2>
              <p className="text-xs text-[#5C7065] mt-1">
                કૃપા કરીને નીચે આપેલ માહિતી ભરો. (<span className="text-[#D97706] font-bold">*</span> ચિહ્નિત વિગતો ફરજિયાત છે)
              </p>
            </div>

            {/* Referral Info Banner */}
            {ref && referralInfo.status === "valid" && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Referred by <strong>{referralInfo.referrerName || ref.toUpperCase()}</strong> ({ref.toUpperCase()})
                </span>
              </div>
            )}

            {/* Dynamic Form Engine OR External Registration Notice */}
            {isRegistrationClosed ? (
              <div className="p-6 sm:p-8 text-center space-y-4 rounded-xl bg-amber-50/60 border border-amber-200/80">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 mx-auto">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0F3E3E]">
                  બાહ્ય પોર્ટલ પર નોંધણી / Registration on External Portal
                </h3>
                <p className="text-sm text-[#5C7065] max-w-md mx-auto leading-relaxed">
                  આ શિબિર માટે નોંધણી અન્ય વ્યવસ્થા અથવા સત્તાવાર બાહ્ય પોર્ટલ દ્વારા સંચાલિત કરવામાં આવે છે.
                </p>
                {contactMobile && (
                  <div className="p-3 bg-white/80 border border-amber-200/50 rounded-xl inline-block text-xs font-semibold text-[#0F3E3E]">
                    વધુ માહિતી અને સહાય માટે સંપર્ક: <span className="font-bold font-mono text-brand-primary">{contactMobile}</span>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <DynamicFormRenderer
                  fields={fields}
                  values={formValues}
                  onChange={handleFieldChange}
                  errors={formErrors}
                  disabled={submitting}
                  isReferralApplied={Boolean(ref)}
                />

                {/* Full-width High-Impact Primary CTA */}
                <div className="pt-2 space-y-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-14 bg-[#0F3E3E] hover:bg-[#144D4D] active:scale-[0.99] text-[#FAF8F5] font-bold rounded-xl shadow-lg shadow-[#0F3E3E]/20 text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                    <span>
                      {submitting ? "નોંધણી પ્રક્રિયા ચાલુ છે..." : "Complete Registration / નોંધણી કરો"}
                    </span>
                  </Button>

                  <p className="text-[11.5px] text-center text-[#5C7065] leading-relaxed">
                    🔒 નોંધણી પૂર્ણ થતાં જ તમારો ડિજિટલ ID કાર્ડ અને સત્તાવાર પ્રવેશ QR કોડ તરત જ મળશે.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
