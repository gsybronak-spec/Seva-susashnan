import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IdCard as IdCardIcon, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { EventIdCard } from "@/components/event-id-card";

export const Route = createFileRoute("/idcard")({
  validateSearch: z.object({
    reg: z.string().optional(),
    key: z.string().optional(),
    mobile: z.string().optional(),
    event: z.string().optional(),
  }),
  head: () => ({
    meta: [{ title: `Official Digital ID Card — ${BRAND.name}` }],
  }),
  component: IdCardPage,
});

const lookupRegistrationByMobile = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
      event_id: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("registrations")
      .select("registration_number, full_name, event_id")
      .eq("mobile", data.mobile)
      .order("created_at", { ascending: false });

    if (data.event_id) {
      query = query.eq("event_id", data.event_id);
    }

    const { data: rows, error } = await query.limit(1);
    if (error || !rows || rows.length === 0) {
      return { ok: false as const, error: "No registration found with this mobile number." };
    }

    return {
      ok: true as const,
      registration_number: rows[0].registration_number as string,
      event_id: rows[0].event_id as string,
    };
  });

function IdCardPage() {
  const search = Route.useSearch();
  const lookup = useServerFn(lookupRegistrationByMobile);

  const [regNumber, setRegNumber] = useState<string>(search.reg || "");
  const [accessKey, setAccessKey] = useState<string>(search.key || "");
  const [eventId, setEventId] = useState<string | undefined>(search.event);

  const [inputVal, setInputVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (search.reg) {
      setRegNumber(search.reg);
    }
    if (search.key) {
      setAccessKey(search.key);
    }
    if (search.event) {
      setEventId(search.event);
    }
  }, [search.event, search.key, search.reg]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const clean = inputVal.trim();
    if (!clean) return;
    setErrorMsg(null);

    // If it's 10 digits, look up by mobile
    if (/^[6-9]\d{9}$/.test(clean)) {
      setBusy(true);
      try {
        const res = await lookup({ data: { mobile: clean, event_id: eventId } });
        if (res.ok) {
          setRegNumber(res.registration_number);
          if (res.event_id) setEventId(res.event_id);
        } else {
          setErrorMsg(res.error);
        }
      } catch {
        setErrorMsg("Failed to lookup registration. Please try again.");
      } finally {
        setBusy(false);
      }
    } else {
      // Direct registration number (e.g. VAD000001)
      setRegNumber(clean.toUpperCase());
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#0F3E3E] text-xs font-semibold">
            <IdCardIcon className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Official Event Pass</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F3E3E] tracking-tight">
            Digital Participant Pass
          </h1>
          <p className="text-xs sm:text-sm text-[#5C7065] max-w-md mx-auto">
            Gujarat State Yog Board official entrance card with cryptographically signed check-in QR code.
          </p>
        </div>

        {/* If participant registration number is active, render the ID Card */}
        {regNumber ? (
          <div className="space-y-6">
            <EventIdCard
              registrationNumber={regNumber}
              cardAccess={accessKey}
              eventId={eventId}
            />

            <div className="text-center print:hidden pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRegNumber("");
                  setAccessKey("");
                  setInputVal("");
                }}
                className="text-xs text-[#5C7065] hover:text-[#0F3E3E]"
              >
                Look up another participant ID card
              </Button>
            </div>
          </div>
        ) : (
          /* Search / Lookup Form */
          <div className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#0F3E3E]">Find Your ID Card</h2>
              <p className="text-xs text-[#5C7065]">
                Enter your 10-digit mobile number or registration number (e.g. VAD000001).
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="search-input" className="text-xs font-semibold text-[#0F3E3E]">
                  Mobile or Registration Number
                </Label>
                <Input
                  id="search-input"
                  placeholder="e.g. 9876543210 or VAD000001"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="h-11 text-sm border-[#E8E0D5] font-medium"
                  required
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>
              )}

              <Button
                type="submit"
                disabled={busy || !inputVal.trim()}
                className="w-full h-11 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-semibold rounded-xl gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>View ID Card</span>
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
