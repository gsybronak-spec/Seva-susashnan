import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flashlight,
  FlashlightOff,
  Loader2,
  LogIn,
  LogOut,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  SwitchCamera,
  User,
  UserCheck,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventConfig } from "@/hooks/use-event-config";
import {
  operatorCheck,
  operatorCheckIn,
  operatorManualCheckIn,
  operatorSearchParticipants,
  operatorSignIn,
  operatorSignOut,
} from "@/lib/event-engine.functions";

type ScanResult = {
  state: "success" | "duplicate" | "invalid" | "unauthorized" | "error";
  participant_name?: string;
  participant_id?: string;
  event_id?: string;
  event_title?: string;
  district?: string;
  check_in_time?: string;
  error?: string;
  code?: string;
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
      // Pleasant double chime (880Hz -> 1175Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === "duplicate") {
      // Warning buzz (330Hz -> 220Hz)
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Error double buzz (180Hz)
      osc.type = "square";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

interface EventOperatorScannerViewProps {
  eventSlug?: string;
  defaultEventId?: string;
}

export function EventOperatorScannerView({
  eventSlug,
  defaultEventId,
}: EventOperatorScannerViewProps) {
  const { config, isLoading: isConfigLoading, districtName } = useEventConfig(eventSlug);
  const targetEventId = config?.id || defaultEventId;

  // Server functions
  const checkSession = useServerFn(operatorCheck);
  const signInFn = useServerFn(operatorSignIn);
  const signOutFn = useServerFn(operatorSignOut);
  const checkInFn = useServerFn(operatorCheckIn);
  const manualCheckInFn = useServerFn(operatorManualCheckIn);
  const searchParticipantsFn = useServerFn(operatorSearchParticipants);

  // Session state
  const [session, setSession] = useState<{
    authed: boolean;
    scanner_id?: string | null;
    scanner_name?: string;
    operator_name?: string;
    event_id?: string;
    event_title?: string;
    present_count?: number;
    scan_count?: number;
    is_admin?: boolean;
  } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Operator login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Scanner hardware & stream state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  // Result & history state
  const [result, setResult] = useState<ScanResult | null>(null);
  const [autoResumeSeconds, setAutoResumeSeconds] = useState<number | null>(null);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);

  // Manual lookup drawer state
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Refs for camera loop and timers
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamTrackRef = useRef<MediaStreamTrack | null>(null);
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  const autoResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check operator session
  const verifyAuth = useCallback(async () => {
    try {
      const res = await checkSession({ data: { target_event_id: targetEventId || undefined } });
      if (res.authed) {
        setSession(res);
      } else {
        setSession({ authed: false });
      }
    } catch {
      setSession({ authed: false });
    } finally {
      setIsCheckingAuth(false);
    }
  }, [checkSession, targetEventId]);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
    };
  }, []);

  // Advance / reset scanner to ready state
  const scanNext = useCallback(() => {
    if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
    setAutoResumeSeconds(null);
    setResult(null);
    isProcessingRef.current = false;
  }, []);

  // Hands-free fast auto-resume (~1.0s on success, ~1.4s on duplicate/error)
  useEffect(() => {
    if (!result) {
      setAutoResumeSeconds(null);
      if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
      return;
    }

    const duration = result.state === "success" ? 1.0 : 1.4;
    setAutoResumeSeconds(duration);

    const timer = setTimeout(() => {
      scanNext();
    }, duration * 1000);

    autoResumeTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [result, scanNext]);

  // Process decoded QR token
  const processToken = useCallback(
    async (token: string) => {
      if (isProcessingRef.current) return;
      const now = Date.now();

      // Guard: prevent immediate repeat scan within 1.5 seconds for the exact same token
      if (
        lastScannedTokenRef.current &&
        lastScannedTokenRef.current.token === token &&
        now - lastScannedTokenRef.current.time < 1500
      ) {
        return;
      }

      isProcessingRef.current = true;
      lastScannedTokenRef.current = { token, time: now };
      setBusy(true);

      try {
        const res = (await checkInFn({
          data: {
            qr_token: token,
            target_event_id: session?.event_id || targetEventId,
          },
        })) as ScanResult & { present_count?: number; scan_count?: number };

        setResult(res);

        // Update live counts in session header
        if (typeof res.present_count === "number" || typeof res.scan_count === "number") {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  present_count: res.present_count ?? prev.present_count,
                  scan_count: res.scan_count ?? prev.scan_count,
                }
              : prev,
          );
        }

        // Sound feedback
        if (soundEnabled) {
          if (res.state === "success") playSound("success");
          else if (res.state === "duplicate") playSound("duplicate");
          else playSound("error");
        }

        // Add to recent activity
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
        const errorMsg = err instanceof Error ? err.message : "હાજરી તપાસમાં ક્ષતિ આવી.";
        setResult({ state: "error", error: errorMsg });
        if (soundEnabled) playSound("error");
      } finally {
        setBusy(false);
      }
    },
    [checkInFn, session?.event_id, soundEnabled, targetEventId],
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
        delayBetweenScanAttempts: 40,
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

      // Check torch support
      try {
        const stream = videoRef.current.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        if (track) {
          streamTrackRef.current = track;
          const capabilities = (track.getCapabilities?.() as any) || {};
          setTorchSupported(Boolean(capabilities.torch));
        }
      } catch {}

      setIsCameraActive(true);
      scanNext();
    } catch {
      setIsCameraActive(false);
      setResult({
        state: "error",
        error:
          "કેમેરા ઍક્સેસ મેળવી શકાયો નથી. કૃપા કરીને બ્રાઉઝરમાં કેમેરાની પરવાનગી આપો અથવા નીચેથી 'મેન્યુઅલ હાજરી' નો ઉપયોગ કરો.",
      });
    } finally {
      setBusy(false);
    }
  }, [facingMode, processToken, scanNext]);

  // Auto-start camera when authenticated
  useEffect(() => {
    if (session?.authed && !isCameraActive && !controlsRef.current && videoRef.current) {
      void startCamera();
    }
  }, [session?.authed, isCameraActive, startCamera]);

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

  // Toggle torch / flashlight
  async function toggleTorch() {
    if (!streamTrackRef.current || !torchSupported) return;
    try {
      const next = !torchEnabled;
      await (streamTrackRef.current as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchEnabled(next);
    } catch {
      setTorchEnabled(false);
    }
  }

  // Keyboard shortcut Space / Enter to advance scan
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

  // Handle operator sign-in
  async function handleOperatorLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const res = await signInFn({
        data: {
          username: username.trim(),
          password,
          target_event_id: targetEventId || undefined,
        },
      });

      if (res.ok) {
        setUsername("");
        setPassword("");
        await verifyAuth();
      } else {
        setLoginError(res.error || "લોગિન નિષ્ફળ ગયું.");
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "સર્વર કનેક્શન ક્ષતિ.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  // Handle operator sign-out
  async function handleSignOut() {
    stopCamera();
    await signOutFn();
    setSession({ authed: false });
    setResult(null);
  }

  // Handle manual participant search
  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || !targetEventId) return;
    setSearching(true);
    try {
      const res = await searchParticipantsFn({
        data: {
          query: searchQuery.trim(),
          target_event_id: session?.event_id || targetEventId,
        },
      });
      if (res.ok) {
        setSearchResults(res.rows);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  // Handle manual check-in button click
  async function handleManualMark(regId: string) {
    if (!targetEventId) return;
    setMarkingId(regId);
    try {
      const res = await manualCheckInFn({
        data: {
          registration_id: regId,
          target_event_id: session?.event_id || targetEventId,
        },
      });

      if (res.ok) {
        setResult({
          state: res.state === "duplicate" ? "duplicate" : "success",
          participant_name: res.participant_name,
          participant_id: res.participant_id,
          check_in_time: res.check_in_time,
        });

        if (soundEnabled) {
          playSound(res.state === "duplicate" ? "duplicate" : "success");
        }

        // Close manual drawer
        setManualDrawerOpen(false);
        setSearchQuery("");
        setSearchResults([]);
        // Re-verify counts
        void verifyAuth();
      } else {
        setResult({ state: "error", error: res.error });
      }
    } catch (err) {
      setResult({
        state: "error",
        error: err instanceof Error ? err.message : "મેન્યુઅલ હાજરી નોંધવામાં ક્ષતિ આવી.",
      });
    } finally {
      setMarkingId(null);
    }
  }

  // Loading state
  if (isConfigLoading || isCheckingAuth) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F3E3E]" />
        <p className="mt-3 text-sm font-medium text-stone-600">સ્કેનર કન્સોલ લોડ થઈ રહ્યું છે...</p>
      </div>
    );
  }

  const eventTitle =
    session?.event_title ||
    config?.general?.title ||
    (districtName ? `${districtName} યોગ શિબિર` : "ગુજરાત રાજ્ય યોગ બોર્ડ શિબિર");

  // =========================================================================
  // VIEW 1: UNAUTHENTICATED OPERATOR LOGIN SCREEN
  // =========================================================================
  if (!session?.authed) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Official Emblem & Event Header */}
          <div className="text-center mb-6">
            <img
              src="/logo-gsyb.png"
              alt="GSYB Emblem"
              className="w-16 h-16 mx-auto mb-2 object-contain drop-shadow-xs"
            />
            <p className="text-xs font-bold text-[#0F3E3E] uppercase tracking-wider mb-2">
              GUJARAT STATE YOG BOARD
            </p>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200/60 mb-3">
              <span className="text-[10px] font-bold text-[#5C7065] uppercase tracking-wider block">
                Digital ID Card Scanner
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-[#0F3E3E] leading-snug mt-0.5">
                {eventSlug && districtName ? `${districtName} યોગ શિબિર` : "સર્વ શિબિર સ્કેનર કન્સોલ"}
              </h1>
              <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                Universal Multi-Event Gate Entry
              </span>
            </div>
            <h2 className="text-sm font-extrabold text-[#1C2623] tracking-tight">
              Scanner Login
            </h2>
            <p className="text-[11px] text-[#5C7065] mt-0.5">
              ઓપરેટર યુઝરનેમ અને સ્કેનર પાસવર્ડ દાખલ કરો
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-6 shadow-sm">
            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed font-medium">{loginError}</span>
              </div>
            )}

            <form onSubmit={handleOperatorLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#0F3E3E]">
                  Username
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. patan_gate1 or SCN-5FAC1DDD"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 text-xs border-[#D9D0C5] focus:border-[#0F3E3E] rounded-xl"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-[#0F3E3E]">
                    Scanner Key / Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#5C7065] hover:text-[#0F3E3E] flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter scanner key / password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 text-xs border-[#D9D0C5] focus:border-[#0F3E3E] rounded-xl"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoggingIn || !username.trim() || !password}
                className="w-full h-11 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-bold text-xs rounded-xl shadow-xs gap-2 transition-all active:scale-[0.99] tracking-wider uppercase"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying credentials...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>LOGIN</span>
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#F0EAE1] text-center">
              <p className="text-[11px] text-[#78887F] leading-relaxed">
                નોંધ: આ સ્કેનર ક્રેડેન્શિયલ્સ તમામ શિબિરો માટે માન્ય છે. QR કોડના આધારે હાજરી આપોઆપ યોગ્ય શિબિરમાં નોંધાશે.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED SCANNER OPERATOR CONSOLE (MOBILE OPTIMIZED 390PX)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col select-none">
      {/* Top Header Bar */}
      <header className="bg-[#0A101D] border-b border-slate-800 px-3 py-2.5 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2 overflow-hidden">
          <img src="/logo-gsyb.png" alt="Emblem" className="w-7 h-7 object-contain shrink-0" />
          <div className="truncate">
            <h1 className="text-xs font-bold text-white truncate leading-tight">
              Digital ID Card Scanner
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
              <span className="text-emerald-400 font-medium">● સક્રિય</span>
              <span>&bull;</span>
              <span className="text-slate-300 font-semibold truncate">
                {session.operator_name || session.scanner_name}
              </span>
              {districtName && (
                <>
                  <span>&bull;</span>
                  <span className="text-emerald-300 font-medium truncate">
                    {districtName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Live Scans Counter Pill */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-full text-[11px] font-mono">
            <span className="text-emerald-400 font-bold">{session.scan_count ?? 0}</span>
            <span className="text-slate-400 text-[10px]">કુલ સ્કેન</span>
          </div>

          <button
            onClick={() => void verifyAuth()}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="રિફ્રેશ કાઉન્ટર"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-300 hover:bg-rose-900 transition-colors"
            title="લોગઆઉટ"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Scanner Container (Full-height continuous camera) */}
      <div className="relative flex-1 flex flex-col justify-center items-center overflow-hidden bg-black">
        {/* Continuous Video Feed (NEVER unmounted) */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Semi-transparent dark overlay framing the scanner box */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          {/* Target Viewfinder Box (Substantially larger: 86vw up to 340px) */}
          <div className="relative w-[86vw] max-w-[340px] aspect-square rounded-3xl border-2 border-emerald-400/90 shadow-[0_0_35px_rgba(16,185,129,0.35)] flex items-center justify-center overflow-hidden">
            {/* Animated Laser Scan Line */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[scanLaser_2.0s_ease-in-out_infinite]" />

            {/* Corner Bracket Accents (Prominent & Clear) */}
            <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

            {busy && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <span className="text-xs font-semibold mt-2">ચકાસી રહ્યું છે...</span>
              </div>
            )}
          </div>

          <p className="text-slate-200 text-xs font-semibold mt-4 tracking-wide text-center px-4 drop-shadow-md">
            આઈડી કાર્ડનો QR કોડ કેમેરા સામે રાખો
          </p>
        </div>

        {/* Camera Controls Floating Bar */}
        <div className="absolute top-3 inset-x-0 flex justify-center gap-3 z-10">
          <button
            onClick={() => {
              setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
              setTimeout(() => void startCamera(), 100);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-200 text-xs font-medium shadow-md active:scale-95 transition-all"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
            <span>કેમેરા બદલો</span>
          </button>

          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-medium shadow-md active:scale-95 transition-all ${
                torchEnabled
                  ? "bg-amber-500 border-amber-400 text-black font-bold"
                  : "bg-slate-900/85 border-slate-700 text-slate-200"
              }`}
            >
              {torchEnabled ? <Flashlight className="w-3.5 h-3.5" /> : <FlashlightOff className="w-3.5 h-3.5" />}
              <span>{torchEnabled ? "ટોર્ચ ચાલુ" : "ટોર્ચ"}</span>
            </button>
          )}

          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-200 text-xs font-medium shadow-md active:scale-95 transition-all"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{soundEnabled ? "અવાજ ચાલુ" : "મ્યૂટ"}</span>
          </button>
        </div>

        {/* Result Feedback Banner (Slide-up overlay card) */}
        {result && (
          <div
            onClick={scanNext}
            className="absolute inset-x-3 bottom-16 sm:bottom-20 z-30 cursor-pointer animate-in fade-in slide-in-from-bottom-6 duration-200"
          >
            {/* SUCCESS STATE */}
            {result.state === "success" && (
              <div className="bg-emerald-950/95 border-2 border-emerald-400 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        ✅ હાજરી સફળ થઈ (PRESENT)
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-white truncate mt-0.5">
                      {result.participant_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-mono text-emerald-200 font-bold bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-500/40">
                        {result.participant_id}
                      </span>
                      {result.district && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-extrabold uppercase tracking-wider">
                          📍 {result.district}
                        </span>
                      )}
                      {result.event_title && (
                        <span className="text-xs text-emerald-200 font-semibold truncate max-w-[200px]">
                          {result.event_title}
                        </span>
                      )}
                    </div>
                    {result.check_in_time && (
                      <p className="text-[10px] text-emerald-300/80 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>સમય: {new Date(result.check_in_time).toLocaleTimeString("en-IN")}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DUPLICATE STATE */}
            {result.state === "duplicate" && (
              <div className="bg-amber-950/95 border-2 border-amber-400 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        ⚠️ પહેલાંથી હાજર થયેલ છે
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-white truncate mt-0.5">
                      {result.participant_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-mono text-amber-200 font-bold bg-amber-900/60 px-2 py-0.5 rounded border border-amber-500/40">
                        {result.participant_id}
                      </span>
                      {result.district && (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-extrabold uppercase tracking-wider">
                          📍 {result.district}
                        </span>
                      )}
                      {result.event_title && (
                        <span className="text-xs text-amber-200 font-semibold truncate max-w-[200px]">
                          {result.event_title}
                        </span>
                      )}
                    </div>
                    {result.check_in_time && (
                      <p className="text-[10px] text-amber-200 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>
                          પ્રથમ હાજરી:{" "}
                          {new Date(result.check_in_time).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* INVALID / CROSS-EVENT / ERROR STATE */}
            {(result.state === "invalid" || result.state === "error" || result.state === "unauthorized") && (
              <div className="bg-rose-950/95 border-2 border-rose-400 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                    <XCircle className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                        {result.code === "PLAIN_REGISTRATION_NUMBER"
                          ? "સાદો નંબર સ્કેન અમાન્ય"
                          : result.code === "CROSS_EVENT"
                          ? "અન્ય શિબિરનો QR"
                          : "અમાન્ય QR કોડ"}
                      </span>
                      {autoResumeSeconds !== null && (
                        <span className="text-[10px] font-mono text-rose-300/80">
                          આગામી સ્કેન {autoResumeSeconds} સે...
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-rose-100 leading-relaxed mt-1">
                      {result.error || "અમાન્ય અથવા મેળ ન ખાતો QR કોડ."}
                    </p>
                    {result.code === "PLAIN_REGISTRATION_NUMBER" && (
                      <p className="text-[10px] text-rose-300 mt-1 font-semibold">
                        👉 નીચેથી &quot;મેન્યુઅલ હાજરી&quot; બટન દબાવીને હાજરી પૂરી શકો છો.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar: Manual Search Action & Recent Activity Drawer */}
      <footer className="bg-[#0A101D] border-t border-slate-800 p-3 flex items-center justify-between gap-2 shrink-0 z-20">
        <Button
          onClick={() => setManualDrawerOpen(true)}
          className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs rounded-xl border border-slate-700 gap-2 active:scale-98 transition-all"
        >
          <Search className="w-4 h-4 text-amber-400" />
          <span>મેન્યુઅલ હાજરી શોધો (નામ / મોબાઈલ / નંબર)</span>
        </Button>
      </footer>

      {/* =====================================================================
          MANUAL LOOKUP DRAWER (SEARCH & EXPLICIT ATTENDANCE CONFIRMATION)
          ===================================================================== */}
      {manualDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end">
          <div
            className="bg-[#FAF8F5] text-slate-900 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl border-t border-[#E8E0D5] animate-in slide-in-from-bottom duration-200"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#E8E0D5] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#0F3E3E]">
                  મેન્યુઅલ હાજરી શોધો
                </h3>
                <p className="text-[11px] text-[#5C7065] mt-0.5">
                  નામ, મોબાઈલ અથવા રજીસ્ટ્રેશન નંબર દાખલ કરી હાજરી નોંધો.
                </p>
              </div>
              <button
                onClick={() => setManualDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-stone-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Search Input Box */}
            <div className="p-4 bg-white border-b border-[#E8E0D5]">
              <form onSubmit={handleManualSearch} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="નામ, મોબાઈલ (૧૦ અંક), અથવા PAT000177..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 text-xs border-[#D9D0C5] focus:border-[#0F3E3E] rounded-xl flex-1 text-black"
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="h-11 px-4 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-bold text-xs rounded-xl"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>
            </div>

            {/* Search Results List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl bg-white border border-[#E8E0D5] shadow-2xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#0F3E3E] truncate">
                        {r.full_name}
                      </h4>
                      {r.is_attended && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          હાજર
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#5C7065] mt-0.5">
                      <span>{r.registration_number}</span>
                      <span>&bull;</span>
                      <span>{r.mobile}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    disabled={markingId === r.id}
                    onClick={() => handleManualMark(r.id)}
                    className={`h-9 px-3 rounded-lg text-xs font-bold gap-1 ${
                      r.is_attended
                        ? "bg-amber-600 hover:bg-amber-500 text-white"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                  >
                    {markingId === r.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{r.is_attended ? "ફરી ચકાસો" : "હાજરી પૂરો"}</span>
                  </Button>
                </div>
              ))}

              {searchQuery && !searching && searchResults.length === 0 && (
                <div className="p-8 text-center text-stone-400 text-xs">
                  કોઈ ભાગ લેનાર મળ્યા નથી.
                </div>
              )}

              {!searchQuery && (
                <div className="p-8 text-center text-stone-400 text-xs">
                  ભાગ લેનારનું નામ, મોબાઈલ અથવા રજીસ્ટ્રેશન નંબર લખીને સર્ચ કરો.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
