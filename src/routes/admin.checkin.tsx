import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, Search, UserCheck, UserX, ScanLine, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { resolveQrToken, performCheckin } from "@/lib/checkin.functions";
import { checkinSearch } from "@/lib/checkin-search.server";
import type { QrResolution } from "@/lib/checkin.functions";

export const Route = createFileRoute("/admin/checkin")({
  head: () => ({
    meta: [{ title: `Check-In — ${BRAND.name}` }],
  }),
  component: CheckinPage,
});

type Participant = {
  registration_number: string;
  full_name: string;
  district: string | null;
  organization: string | null;
};

type ScanState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "found"; participant: Participant; checkedIn: boolean; checkInTime?: string; method?: string }
  | { kind: "success"; participant: Participant; time: string }
  | { kind: "duplicate"; participant: Participant; time: string }
  | { kind: "error"; message: string };

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function CheckinPage() {
  const qc = useQueryClient();
  const resolveFn = useServerFn(resolveQrToken);
  const checkinFn = useServerFn(performCheckin);
  const searchFn = useServerFn(checkinSearch);
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const [manualQuery, setManualQuery] = useState("");
  const [manualResult, setManualResult] = useState<Participant | null>(null);
  const [manualMsg, setManualMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerActive = useRef(false);
  const zxingRef = useRef<{ stop: () => void } | null>(null);

  // ---------------- QR scanning via camera ----------------
  // Tries the native BarcodeDetector API first (Chrome/Android — fast). On
  // Safari/iOS or Firefox it falls back to the ZXing browser reader so any
  // staff/volunteer phone can scan. Manual check-in remains the last resort.
  useEffect(() => {
    return () => {
      scannerActive.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void zxingRef.current?.stop();
    };
  }, []);

  async function startScanner() {
    setState({ kind: "scanning" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scannerActive.current = true;

      const DetectorCtor =
        (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (DetectorCtor) {
        const detector = new DetectorCtor({ formats: ["qr_code"] });

        const tick = async () => {
          if (!scannerActive.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const raw = codes[0].rawValue;
              stopScanner();
              await handleToken(raw);
              return;
            }
          } catch {
            /* transient frame error — keep scanning */
          }
          requestAnimationFrame(() => void tick());
        };
        requestAnimationFrame(() => void tick());
      } else {
        // ZXing fallback (Safari iOS / Firefox): decode loop driven by the
        // library's own continuous scan API.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && scannerActive.current) {
            const raw = result.getText();
            stopScanner();
            void handleToken(raw);
          }
        });
        zxingRef.current = controls;
      }
    } catch {
      setState({
        kind: "error",
        message: "Camera permission denied or unavailable. Use manual check-in below.",
      });
    }
  }

  function stopScanner() {
    scannerActive.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void zxingRef.current?.stop();
    zxingRef.current = null;
  }

  async function handleToken(token: string) {
    setBusy(true);
    try {
      const res = (await resolveFn({ data: { token } })) as QrResolution;
      if (!res.ok) {
        setState({ kind: "error", message: res.error });
        return;
      }
      if (res.attendance.checked_in) {
        setState({
          kind: "duplicate",
          participant: res.participant,
          time: res.attendance.check_in_time,
        });
        return;
      }
      // Not yet checked in → mark present immediately.
      await doCheckin(res.participant.registration_number, "qr");
    } finally {
      setBusy(false);
    }
  }

  async function doCheckin(regNumber: string, method: "qr" | "manual") {
    setBusy(true);
    try {
      const res = await checkinFn({
        data: { registration_number: regNumber, method },
      });
      if (!res.ok) {
        setState({ kind: "error", message: res.error });
        return;
      }
      if (res.action === "already") {
        setState({ kind: "duplicate", participant: res.participant, time: res.previous_check_in_time });
      } else {
        setState({ kind: "success", participant: res.participant, time: res.check_in_time });
      }
      void qc.invalidateQueries({ queryKey: ["admin-list"] });
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } finally {
      setBusy(false);
    }
  }

  // ---------------- Manual check-in ----------------
  async function manualSearch() {
    setManualMsg(null);
    setManualResult(null);
    const q = manualQuery.trim();
    if (q.length < 3) {
      setManualMsg("Enter at least 3 characters (name, mobile or participant ID).");
      return;
    }
    setBusy(true);
    try {
      const res = await searchFn({ data: { q } });
      if (!res.ok) {
        setManualMsg(res.error ?? "Search failed.");
        return;
      }
      if (!res.participants?.length) {
        setManualMsg("No participant found. Check the spelling or try the mobile number.");
        return;
      }
      setManualResult(res.participants as unknown as Participant);
    } catch {
      setManualMsg("Search failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const res = state;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-brand-primary">Event Check-In</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan the participant ID card QR or check in manually.
        </p>
      </div>

      {/* Scanner card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="brand-bar h-1 w-full" />
        <div className="p-4">
          {res.kind === "scanning" ? (
            <div>
              <div className="relative overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-brand-accent" />
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Point the camera at the QR code on the ID card…
              </p>
              <Button variant="outline" className="mt-2 w-full" onClick={() => { stopScanner(); setState({ kind: "idle" }); }}>
                <CameraOff className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </div>
          ) : res.kind === "idle" ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-brand-primary">
                <ScanLine className="h-8 w-8" />
              </div>
              <Button size="lg" className="h-12 w-full text-base" onClick={startScanner}>
                <Camera className="mr-2 h-5 w-5" />
                Scan ID Card QR
              </Button>
            </div>
          ) : (
            /* Result cards */
            <div className="text-center">
              {res.kind === "found" && (
                <>
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-brand-primary">
                    <UserCheck className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-bold">{res.participant.full_name}</h2>
                  <p className="font-mono text-sm text-muted-foreground">{res.participant.registration_number}</p>
                  {!res.checkedIn ? (
                    <Button
                      size="lg"
                      className="mt-4 h-12 w-full text-base"
                      disabled={busy}
                      onClick={() => doCheckin(res.participant.registration_number, "qr")}
                    >
                      Mark Present
                    </Button>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Already checked in {res.checkInTime ? `at ${formatTime(res.checkInTime)}` : ""}
                    </p>
                  )}
                </>
              )}
              {res.kind === "success" && (
                <>
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-success text-white">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-bold text-brand-success">Checked In ✓</h2>
                  <p className="mt-1 font-semibold">{res.participant.full_name}</p>
                  <p className="font-mono text-sm text-muted-foreground">{res.participant.registration_number}</p>
                  <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {formatTime(res.time)}
                  </p>
                </>
              )}
              {res.kind === "duplicate" && (
                <>
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/20 text-brand-accent">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-bold text-brand-accent">Attendance already recorded</h2>
                  <p className="mt-1 font-semibold">{res.participant.full_name}</p>
                  <p className="font-mono text-sm text-muted-foreground">{res.participant.registration_number}</p>
                  <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> previously at {formatTime(res.time)}
                  </p>
                </>
              )}
              {res.kind === "error" && (
                <>
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <UserX className="h-8 w-8" />
                  </div>
                  <h2 className="text-lg font-bold text-destructive">Not found</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{res.message}</p>
                </>
              )}
              <Button variant="outline" className="mt-4 w-full" onClick={() => setState({ kind: "idle" })}>
                <ScanLine className="mr-2 h-4 w-4" />
                Scan Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Manual check-in */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/40 p-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-primary">
            <Search className="h-4 w-4" />
            Manual Check-In (no QR available)
          </h2>
        </div>
        <div className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="manual-q">Name / Mobile / Participant ID</Label>
            <div className="flex gap-2">
              <Input
                id="manual-q"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="e.g. 98765 43210"
                inputMode="text"
              />
              <Button onClick={manualSearch} disabled={busy}>
                Search
              </Button>
            </div>
          </div>
          {manualMsg && <p className="text-xs text-muted-foreground">{manualMsg}</p>}
          {manualResult && (
            <div className="space-y-2">
              {(Array.isArray(manualResult) ? manualResult : [manualResult]).map((p) => (
                <div
                  key={p.registration_number}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.registration_number}</div>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => doCheckin(p.registration_number, "manual")}>
                    <UserCheck className="mr-1 h-4 w-4" />
                    Check In
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
