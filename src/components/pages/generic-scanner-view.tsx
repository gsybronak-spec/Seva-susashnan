import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  SwitchCamera,
  User,
  UserCheck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  scannerCheck,
  scannerCheckIn,
  scannerSignIn,
  scannerSignOut,
  adminManualCheckIn,
  adminSearchParticipants,
  VADODARA_EVENT_ID,
} from "@/lib/event-engine.functions";

type Result = {
  state: "success" | "duplicate" | "invalid" | "unauthorized" | "error";
  participant_name?: string;
  participant_id?: string;
  check_in_time?: string;
  error?: string;
};

type ScanHistoryItem = {
  id: string;
  name: string;
  regId: string;
  time: string;
  status: "success" | "duplicate";
};

// Web Audio API feedback
function playSound(type: "success" | "duplicate" | "error") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // Pleasant double-chime (A5 -> D6)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === "duplicate") {
      // Warning low buzz
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Error low double-buzz
      osc.type = "square";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked or unsupported
  }
}

export function GenericScannerView({ defaultEventId }: { defaultEventId?: string }) {
  const targetEventId = defaultEventId || VADODARA_EVENT_ID;

  const check = useServerFn(scannerCheck);
  const signIn = useServerFn(scannerSignIn);
  const signOut = useServerFn(scannerSignOut);
  const checkIn = useServerFn(scannerCheckIn);
  const manualCheckIn = useServerFn(adminManualCheckIn);
  const searchParticipants = useServerFn(adminSearchParticipants);

  const [session, setSession] = useState<{
    authed: boolean;
    scanner_name?: string;
    operator_name?: string;
    event_id?: string;
    event_title?: string;
  } | null>(null);

  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [autoResumeSeconds, setAutoResumeSeconds] = useState<number | null>(null);

  // Manual search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  const autoResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial session check
  useEffect(() => {
    check().then(setSession);
  }, [check]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      if (autoResumeTimerRef.current) clearInterval(autoResumeTimerRef.current);
    };
  }, []);

  const scanNext = useCallback(() => {
    if (autoResumeTimerRef.current) clearInterval(autoResumeTimerRef.current);
    setAutoResumeSeconds(null);
    setResult(null);
    isProcessingRef.current = false;
  }, []);

  // Handle auto-resume countdown
  useEffect(() => {
    if (!result) {
      setAutoResumeSeconds(null);
      if (autoResumeTimerRef.current) clearInterval(autoResumeTimerRef.current);
      return;
    }

    if (result.state === "success" || result.state === "duplicate") {
      setAutoResumeSeconds(3);
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = 3 - elapsed;
        if (remaining <= 0) {
          clearInterval(interval);
          scanNext();
        } else {
          setAutoResumeSeconds(remaining);
        }
      }, 500);
      autoResumeTimerRef.current = interval;
      return () => clearInterval(interval);
    }
  }, [result, scanNext]);

  // Process decoded QR token
  const processToken = useCallback(
    async (token: string) => {
      if (isProcessingRef.current) return;
      const now = Date.now();
      if (
        lastScannedTokenRef.current &&
        lastScannedTokenRef.current.token === token &&
        now - lastScannedTokenRef.current.time < 3500
      ) {
        return;
      }

      isProcessingRef.current = true;
      lastScannedTokenRef.current = { token, time: now };
      setBusy(true);

      try {
        const res = (await checkIn({
          data: { qr_token: token, event_id: session?.event_id || targetEventId },
        })) as Result;
        setResult(res);

        if (soundEnabled) {
          if (res.state === "success") playSound("success");
          else if (res.state === "duplicate") playSound("duplicate");
          else playSound("error");
        }

        if (res.state === "success" || res.state === "duplicate") {
          setRecentScans((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              name: res.participant_name || "Participant",
              regId: res.participant_id || "",
              time: new Date().toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              status: res.state as "success" | "duplicate",
            },
            ...prev.slice(0, 4),
          ]);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Check-in request failed.";
        setResult({ state: "error", error: errorMsg });
        if (soundEnabled) playSound("error");
      } finally {
        setBusy(false);
      }
    },
    [checkIn, session?.event_id, soundEnabled, targetEventId],
  );

  // Start continuous camera stream
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setBusy(true);

    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 150,
      });

      controlsRef.current = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        videoRef.current,
        (decoded) => {
          if (decoded && !isProcessingRef.current) {
            void processToken(decoded.getText());
          }
        },
      );

      setIsCameraActive(true);
      scanNext();
    } catch {
      setIsCameraActive(false);
      setResult({
        state: "error",
        error:
          "Camera access denied or unavailable. Please check permissions or use manual check-in below.",
      });
    } finally {
      setBusy(false);
    }
  }, [facingMode, processToken, scanNext]);

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }
    setIsCameraActive(false);
    isProcessingRef.current = false;
  }, []);

  // Keyboard shortcut Space / Enter to advance
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.code === "Space" || e.code === "Enter") && result) {
        e.preventDefault();
        scanNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [result, scanNext]);

  async function submitKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await signIn({
      data: { access_key: key.trim(), event_id: targetEventId },
    });
    setBusy(false);
    if (res.ok) {
      setSession({
        authed: true,
        scanner_name: res.scanner_name,
        operator_name: res.operator_name,
        event_id: res.event_id,
        event_title: res.event_title,
      });
      setKey("");
    } else {
      setResult({ state: "unauthorized", error: res.error });
    }
  }

  async function handleSignOut() {
    stopCamera();
    await signOut();
    setSession({ authed: false });
    setResult(null);
  }

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await searchParticipants({
        data: { event_id: session?.event_id || targetEventId, query: searchQuery.trim() },
      });
      setSearchResults(res.rows || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleManualCheckInRow(regId: string) {
    setBusy(true);
    try {
      const res = await manualCheckIn({
        data: { event_id: session?.event_id || targetEventId, registration_id: regId },
      });
      if (res.ok) {
        setResult({
          state: res.state,
          check_in_time: res.check_in_time,
        });
        if (soundEnabled) {
          if (res.state === "success") playSound("success");
          else playSound("duplicate");
        }
      } else {
        setResult({ state: "error", error: res.error });
        if (soundEnabled) playSound("error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C2623] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-[#E8E0D5] shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg font-bold text-[#0F3E3E] tracking-tight">
                Live Attendance Scanner
              </h1>
            </div>
            <p className="text-xs text-[#5C7065] mt-0.5">
              {session?.event_title || "Gujarat State Yog Board"} &bull; Continuous Mode
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-9 px-3 border-[#E8E0D5] text-[#0F3E3E]"
              title={soundEnabled ? "Mute Tones" : "Enable Tones"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>

            {session?.authed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="h-9 px-3 border-[#E8E0D5] text-stone-600 hover:text-rose-600 gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-xs">Sign Out</span>
              </Button>
            )}
          </div>
        </div>

        {/* Scanner Auth Card (if not authenticated) */}
        {!session?.authed ? (
          <div className="p-8 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm space-y-6 max-w-md mx-auto">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E8E0D5] flex items-center justify-center mx-auto text-[#D97706]">
                <QrCode className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#0F3E3E]">Scanner Sign In</h2>
              <p className="text-xs text-[#5C7065]">
                Enter your issued scanner operator access key to begin checking in participants.
              </p>
            </div>

            <form onSubmit={submitKey} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key" className="text-xs font-semibold text-[#0F3E3E]">
                  Scanner Access Key
                </Label>
                <Input
                  id="key"
                  type="password"
                  placeholder="SCN-XXXXX.secret"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="font-mono text-xs h-11 border-[#E8E0D5]"
                  required
                />
              </div>

              {result?.state === "unauthorized" && (
                <p className="text-xs text-rose-600 font-medium">{result.error}</p>
              )}

              <Button
                type="submit"
                disabled={busy || !key.trim()}
                className="w-full h-11 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-semibold rounded-xl"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span className="ml-2">Authenticate Scanner</span>
              </Button>
            </form>
          </div>
        ) : (
          /* Authenticated Scanner Console */
          <div className="space-y-6">
            {/* Operator info badge */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8E0D5] text-xs">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#D97706]" />
                <span className="font-semibold text-[#0F3E3E]">{session.scanner_name}</span>
                <span className="text-stone-400">&bull;</span>
                <span className="text-[#5C7065]">{session.operator_name}</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                ACTIVE
              </span>
            </div>

            {/* Video Viewport & Overlays */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square sm:aspect-[4/3] max-h-[480px] flex items-center justify-center border border-stone-800 shadow-xl">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Viewport scan targeting frame */}
              {isCameraActive && !result && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4 sm:p-8">
                  <div className="relative w-52 h-52 sm:w-64 sm:h-64 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                    {/* Animated laser scanline */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}

              {/* Idle / Camera Off state */}
              {!isCameraActive && !busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-stone-900/90 text-center space-y-4">
                  <Camera className="w-12 h-12 text-stone-500" />
                  <div>
                    <h3 className="text-white font-semibold text-sm sm:text-base">Camera Inactive</h3>
                    <p className="text-stone-400 text-xs mt-1">
                      Start continuous scanning to begin reading passes.
                    </p>
                  </div>
                  <Button
                    onClick={startCamera}
                    className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow-lg cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Scanner</span>
                  </Button>
                </div>
              )}

              {/* Result Flash Overlay */}
              {result && (
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md transition-all ${
                    result.state === "success"
                      ? "bg-emerald-950/90 text-white"
                      : result.state === "duplicate"
                      ? "bg-amber-950/90 text-white"
                      : "bg-rose-950/90 text-white"
                  }`}
                >
                  {result.state === "success" ? (
                    <CheckCircle2 className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-400 mb-2 animate-bounce" />
                  ) : result.state === "duplicate" ? (
                    <AlertTriangle className="w-14 h-14 sm:w-16 sm:h-16 text-amber-400 mb-2" />
                  ) : (
                    <ShieldAlert className="w-14 h-14 sm:w-16 sm:h-16 text-rose-400 mb-2" />
                  )}

                  <h3 className="text-lg sm:text-2xl font-bold tracking-tight">
                    {result.state === "success"
                      ? "CHECK-IN VERIFIED"
                      : result.state === "duplicate"
                      ? "ALREADY CHECKED IN"
                      : "INVALID PASS"}
                  </h3>

                  {result.participant_name && (
                    <p className="text-base sm:text-lg font-semibold mt-1.5 text-white line-clamp-1">
                      {result.participant_name}
                    </p>
                  )}

                  {result.participant_id && (
                    <p className="text-sm font-mono text-emerald-200 mt-0.5">
                      {result.participant_id}
                    </p>
                  )}

                  {result.check_in_time && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-300 mt-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{result.check_in_time}</span>
                    </div>
                  )}

                  {result.error && (
                    <p className="text-xs sm:text-sm text-rose-200 mt-2 max-w-xs">{result.error}</p>
                  )}

                  {/* Auto-resume counter or manual advance button */}
                  <div className="mt-5 flex items-center gap-3">
                    <Button
                      onClick={scanNext}
                      className="h-12 px-6 rounded-xl bg-white text-[#0F3E3E] hover:bg-stone-100 font-bold shadow-lg gap-2 text-sm cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>
                        Scan Next{" "}
                        {autoResumeSeconds !== null && `(${autoResumeSeconds}s)`}
                      </span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-stone-300 mt-2">
                    Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded font-mono">Space</kbd> or{" "}
                    <kbd className="px-1.5 py-0.5 bg-white/20 rounded font-mono">Enter</kbd> to advance
                  </p>
                </div>
              )}
            </div>

            {/* Camera Controls Bar */}
            {isCameraActive && (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFacingMode(facingMode === "environment" ? "user" : "environment");
                    startCamera();
                  }}
                  className="h-10 px-4 rounded-xl border-[#E8E0D5] text-[#0F3E3E] gap-2"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span>Switch Camera</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopCamera}
                  className="h-10 px-4 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 gap-1.5"
                >
                  <span>Pause Camera</span>
                </Button>
              </div>
            )}

            {/* Recent Scans Strip */}
            {recentScans.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Recent Venue Scans
                </h4>
                <div className="space-y-1.5">
                  {recentScans.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#E8E0D5] text-xs shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            item.status === "success" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        <div>
                          <p className="font-bold text-[#1C2623]">{item.name}</p>
                          <p className="font-mono text-[11px] text-[#64748B]">{item.regId}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#64748B]">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Lookup Fallback */}
            <div className="p-5 rounded-2xl bg-white border border-[#E8E0D5] shadow-sm space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#0F3E3E]">Manual Participant Check-In</h4>
                <p className="text-xs text-[#5C7065]">
                  Search by Mobile, Registration Number, or Full Name if camera cannot read the pass.
                </p>
              </div>

              <form onSubmit={handleManualSearch} className="flex gap-2">
                <Input
                  placeholder="Search name, mobile or reg no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 text-xs border-[#E8E0D5]"
                />
                <Button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="h-11 px-5 rounded-xl bg-[#0F3E3E] text-white font-semibold"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div className="divide-y divide-[#E8E0D5] border-t border-[#E8E0D5] pt-2 max-h-60 overflow-y-auto">
                  {searchResults.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-xs font-bold text-[#1C2623]">{p.full_name}</p>
                        <p className="text-[11px] font-mono text-[#64748B]">
                          {p.registration_number} &bull; {p.mobile}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleManualCheckInRow(p.id)}
                        disabled={busy}
                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Check In</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
