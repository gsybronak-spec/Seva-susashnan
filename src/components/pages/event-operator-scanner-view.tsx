import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
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
  Phone,
  RefreshCw,
  Search,
  SwitchCamera,
  UserCheck,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  operatorCheck,
  operatorCheckIn,
  operatorManualCheckIn,
  operatorSearchParticipants,
  operatorSignIn,
  operatorSignOut,
} from "@/lib/event-engine.functions";
import { normalizeIndianMobile } from "@/lib/event-config";

type ScanResult = {
  state: "success" | "duplicate" | "closed" | "invalid" | "unauthorized" | "error";
  code?: string;
  message?: string;
  participant_name?: string;
  participant_id?: string;
  event_id?: string;
  event_title?: string;
  district?: string;
  check_in_time?: string;
  present_count?: number;
  scan_count?: number;
  error?: string;
};

type ManualParticipantRow = {
  id: string;
  registration_number: string;
  full_name: string;
  mobile: string;
  district: string;
  event_id: string;
  event_title: string;
  event_date?: string;
  is_attended: boolean;
  check_in_time?: string | null;
  attendance_closed?: boolean;
};

function formatEventDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return trimmed;
}

function normalizeMobileClient(raw: string): string | null {
  const norm10 = normalizeIndianMobile(raw);
  if (norm10) return norm10;
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2,6}[-_]?\d{3,10}$/.test(trimmed)) {
    return trimmed.replace(/[-_\s]/g, "").toUpperCase();
  }
  return null;
}

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
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === "duplicate") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    }
  } catch {
    // AudioContext blocked or unsupported
  }
}

interface EventOperatorScannerViewProps {
  eventSlug?: string;
  defaultEventId?: string;
}

export function EventOperatorScannerView({
  defaultEventId,
}: EventOperatorScannerViewProps) {
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
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  // Result state
  const [result, setResult] = useState<ScanResult | null>(null);

  // Manual mobile search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ManualParticipantRow[]>([]);
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [eventSelectionWarning, setEventSelectionWarning] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Refs for camera lifecycle and concurrency locks
  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamTrackRef = useRef<MediaStreamTrack | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startingCameraRef = useRef(false);
  const userRequestedCameraRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  const autoResumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check operator session (lightweight single call, never blocks on event config)
  const verifyAuth = useCallback(async () => {
    try {
      const res = await checkSession({ data: { target_event_id: defaultEventId || undefined } });
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
  }, [checkSession, defaultEventId]);

  useEffect(() => {
    void verifyAuth();
  }, [verifyAuth]);

  // Release all camera hardware tracks safely
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      } catch {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        const currentObj = videoRef.current.srcObject as MediaStream | null;
        if (currentObj) {
          currentObj.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
        }
        videoRef.current.srcObject = null;
      } catch {}
    }
    streamTrackRef.current = null;
    setTorchEnabled(false);
    setTorchSupported(false);
    setIsCameraActive(false);
    isProcessingRef.current = false;
  }, []);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      userRequestedCameraRef.current = false;
      stopCamera();
      if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
    };
  }, [stopCamera]);

  // Advance / reset scanner to ready state
  const scanNext = useCallback(() => {
    if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
    setResult(null);
    isProcessingRef.current = false;
  }, []);

  // Auto-clear QR scan result after 2.5s so continuous scanning stays hands-free while readable
  useEffect(() => {
    if (!result) {
      if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
      return;
    }
    const timer = setTimeout(() => {
      isProcessingRef.current = false;
    }, 900);
    autoResumeTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [result]);

  // Process decoded QR token
  const processToken = useCallback(
    async (token: string) => {
      if (isProcessingRef.current) return;
      const now = Date.now();

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
          },
        })) as ScanResult;

        setResult(res);

        if (res.present_count !== undefined && res.scan_count !== undefined) {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  present_count: res.present_count,
                  scan_count: res.scan_count,
                }
              : prev,
          );
        }

        if (soundEnabled) {
          if (res.state === "success") playSound("success");
          else if (res.state === "duplicate") playSound("duplicate");
          else playSound("error");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "હાજરી તપાસમાં ક્ષતિ આવી.";
        setResult({ state: "error", error: errorMsg });
        if (soundEnabled) playSound("error");
      } finally {
        setBusy(false);
      }
    },
    [checkInFn, soundEnabled],
  );

  // Acquire camera stream with safe progressive fallback constraints
  async function acquireSafeMediaStream(mode: "environment" | "user"): Promise<MediaStream> {
    if (typeof window === "undefined") {
      throw new Error("Camera unavailable on server");
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      throw new Error("HTTPS required for camera");
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      throw new Error("getUserMedia not supported");
    }

    const constraintCandidates: MediaStreamConstraints[] = [
      { video: { facingMode: mode }, audio: false },
      { video: { facingMode: { ideal: mode } }, audio: false },
      { video: true, audio: false },
    ];

    let lastError: unknown = null;
    for (const constraints of constraintCandidates) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        lastError = err;
        // If user explicitly denied permission, do not retry further constraint variations
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError" || err?.name === "SecurityError") {
          break;
        }
      }
    }
    throw lastError || new Error("Unable to access camera");
  }

  // Start camera ONLY when explicitly requested by user tap ("કેમેરા શરૂ કરો")
  const startCamera = useCallback(
    async (overrideFacingMode?: "environment" | "user") => {
      if (startingCameraRef.current) return;
      startingCameraRef.current = true;
      userRequestedCameraRef.current = true;
      setIsStartingCamera(true);
      setCameraError(null);

      // Always stop and release any old MediaStream before starting another
      stopCamera();

      const targetMode = overrideFacingMode ?? facingMode;

      try {
        const stream = await acquireSafeMediaStream(targetMode);
        streamRef.current = stream;

        const videoEl = videoRef.current;
        if (!videoEl) {
          stopCamera();
          return;
        }

        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.muted = true;
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});

        const track = stream.getVideoTracks()[0];
        if (track) {
          streamTrackRef.current = track;
          try {
            const capabilities = (track.getCapabilities?.() as any) || {};
            setTorchSupported(Boolean(capabilities.torch));
          } catch {
            setTorchSupported(false);
          }
        }

        let usedNative = false;

        // 1. Try Native BarcodeDetector if supported
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            const formats: string[] = await (window as any).BarcodeDetector.getSupportedFormats().catch(() => []);
            if (Array.isArray(formats) && formats.includes("qr_code")) {
              const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
              let activeLoop = true;
              const detectLoop = async () => {
                if (!activeLoop) return;
                if (videoRef.current && videoRef.current.readyState >= 2 && !isProcessingRef.current) {
                  try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                      void processToken(barcodes[0].rawValue);
                    }
                  } catch {
                    // Ignore frame decode errors
                  }
                }
                if (activeLoop) {
                  animFrameRef.current = requestAnimationFrame(detectLoop);
                }
              };
              animFrameRef.current = requestAnimationFrame(detectLoop);
              controlsRef.current = {
                stop: () => {
                  activeLoop = false;
                  if (animFrameRef.current) {
                    cancelAnimationFrame(animFrameRef.current);
                    animFrameRef.current = null;
                  }
                },
              };
              usedNative = true;
            }
          } catch {
            usedNative = false;
          }
        }

        // 2. Automatic ZXing Fallback using the ALREADY open MediaStream (never opens a conflicting 2nd camera stream!)
        if (!usedNative) {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const reader = new BrowserQRCodeReader(undefined, {
            delayBetweenScanAttempts: 60,
          });
          controlsRef.current = await reader.decodeFromStream(
            stream,
            videoEl,
            (decoded) => {
              if (decoded && !isProcessingRef.current) {
                void processToken(decoded.getText());
              }
            },
          );
        }

        setIsCameraActive(true);
        setCameraError(null);
      } catch (err) {
        console.warn("[Scanner Camera Error]:", err);
        stopCamera();
        setCameraError("કેમેરા શરૂ થઈ શક્યો નથી. Camera Permission ચેક કરો અથવા Mobile Number દ્વારા શોધો.");
      } finally {
        startingCameraRef.current = false;
        setIsStartingCamera(false);
      }
    },
    [facingMode, processToken, stopCamera],
  );

  // Handle browser suspend/resume (iOS Safari & Android backgrounding)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        if (isCameraActive) {
          stopCamera();
        }
      } else if (userRequestedCameraRef.current && !isCameraActive && !startingCameraRef.current) {
        void startCamera();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isCameraActive, startCamera, stopCamera]);

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
          target_event_id: defaultEventId || undefined,
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
    userRequestedCameraRef.current = false;
    stopCamera();
    await signOutFn();
    setSession({ authed: false });
    setResult(null);
  }

  // Handle manual mobile number search (Universal across all events, never requires targetEventId)
  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    const rawInput = searchQuery.trim();
    if (!rawInput) return;

    // Reset all previous search/selection/result state before searching
    setSearchResults([]);
    setSelectedRegId(null);
    setEventSelectionWarning(null);
    setSearchError(null);
    setResult(null);
    setHasSearched(true);

    const normalized = normalizeMobileClient(rawInput);
    if (!normalized) {
      setSearchError("આ મોબાઇલ નંબરથી કોઈ નોંધણી મળી નથી.");
      if (soundEnabled) playSound("error");
      return;
    }

    setSearching(true);

    try {
      const res = await searchParticipantsFn({
        data: {
          query: normalized,
        },
      });
      if (res.ok) {
        const rows = (res.rows as ManualParticipantRow[]) || [];
        setSearchResults(rows);
        if (rows.length === 1) {
          // Single registration: automatically select it for immediate Check In
          setSelectedRegId(rows[0].id);
        } else if (rows.length > 1) {
          // Multiple registrations across events: NEVER auto-select; require explicit event selection
          setSelectedRegId(null);
        } else {
          setSelectedRegId(null);
          setSearchError("આ મોબાઇલ નંબરથી કોઈ નોંધણી મળી નથી.");
        }
      } else {
        setSearchResults([]);
        setSelectedRegId(null);
        setSearchError(res.error || "હાજરી નોંધવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.");
      }
    } catch {
      setSearchResults([]);
      setSelectedRegId(null);
      setSearchError("હાજરી નોંધવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.");
    } finally {
      setSearching(false);
    }
  }

  // Handle manual check-in button click (Sends both registration_id and event_id to server)
  async function handleManualMark(row?: ManualParticipantRow | null) {
    if (markingId) return;
    if (!row) {
      setEventSelectionWarning("કૃપા કરીને કાર્યક્રમ પસંદ કરો.");
      if (soundEnabled) playSound("error");
      return;
    }

    setEventSelectionWarning(null);
    setMarkingId(row.id);

    try {
      const res = await manualCheckInFn({
        data: {
          registration_id: row.id,
          event_id: row.event_id,
        },
      });

      if (res.ok) {
        const nextState = res.state === "duplicate" ? "duplicate" : "success";
        setResult({
          state: nextState,
          message:
            (res as any).message ||
            (nextState === "duplicate"
              ? "આ સદસ્યની હાજરી પહેલેથી નોંધાઈ ગઈ છે."
              : "હાજરી સફળતાપૂર્વક નોંધાઈ ગઈ છે."),
          participant_name: res.participant_name || row.full_name,
          participant_id: res.participant_id || row.registration_number,
          event_id: res.event_id || row.event_id,
          event_title: res.event_title || row.event_title,
          district: res.district || row.district,
          check_in_time: res.check_in_time,
          present_count: res.present_count,
          scan_count: res.scan_count,
        });

        // Update local search result row immediately so UI reflects attendance without extra network calls
        setSearchResults((prev) =>
          prev.map((item) =>
            item.id === row.id
              ? { ...item, is_attended: true, check_in_time: res.check_in_time }
              : item,
          ),
        );

        if (res.present_count !== undefined && res.scan_count !== undefined) {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  present_count: res.present_count,
                  scan_count: res.scan_count,
                }
              : prev,
          );
        }

        if (soundEnabled) {
          playSound(nextState);
        }
      } else {
        const nextState =
          (res as any).state === "closed"
            ? "closed"
            : (res as any).state === "invalid"
            ? "invalid"
            : "error";
        setResult({
          state: nextState,
          code: (res as any).code,
          participant_name: (res as any).participant_name || row.full_name,
          participant_id: (res as any).participant_id || row.registration_number,
          event_title: (res as any).event_title || row.event_title,
          district: (res as any).district || row.district,
          error: res.error || "હાજરી નોંધવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.",
        });
        if (soundEnabled) playSound("error");
      }
    } catch {
      setResult({
        state: "error",
        error: "હાજરી નોંધવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.",
      });
      if (soundEnabled) playSound("error");
    } finally {
      setMarkingId(null);
    }
  }

  // Initial lightweight auth check spinner
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] p-4 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="mt-3 text-sm font-semibold text-slate-200">યોગ શિબિર હાજરી લોડ થઈ રહ્યું છે...</p>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: UNAUTHENTICATED OPERATOR LOGIN SCREEN
  // =========================================================================
  if (!session?.authed) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center px-4 py-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-5">
            <p className="text-xs font-bold text-[#0F3E3E] uppercase tracking-wider mb-1">
              GUJARAT STATE YOG BOARD
            </p>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200/60 mb-3">
              <h1 className="text-base font-extrabold text-[#0F3E3E] leading-snug">
                યોગ શિબિર હાજરી
              </h1>
              <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                Universal Multi-Event Attendance Scanner
              </span>
            </div>
            <h2 className="text-sm font-extrabold text-[#1C2623] tracking-tight">
              Scanner Login
            </h2>
            <p className="text-[11px] text-[#5C7065] mt-0.5">
              ઓપરેટર યુઝરનેમ અને સ્કેનર પાસવર્ડ દાખલ કરો
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E0D5] p-5 shadow-sm">
            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed font-medium">{loginError}</span>
              </div>
            )}

            <form onSubmit={handleOperatorLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-[#0F3E3E]">Username</Label>
                <Input
                  type="text"
                  placeholder="e.g. SCN-5FAC1DDD"
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
                  <Label className="text-xs font-bold text-[#0F3E3E]">Scanner Key / Password</Label>
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
                className="w-full h-11 bg-[#0F3E3E] hover:bg-[#1C4E4E] text-white font-bold text-xs rounded-xl shadow-xs gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>LOGIN</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: AUTHENTICATED MOBILE-FIRST SCANNER & MANUAL ATTENDANCE CONSOLE
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col">
      {/* Top Header Bar: "યોગ શિબિર હાજરી" */}
      <header className="bg-[#0A101D] border-b border-slate-800 px-3 py-2.5 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
          <div className="truncate">
            <h1 className="text-sm font-extrabold text-white truncate leading-tight">
              યોગ શિબિર હાજરી
            </h1>
            <p className="text-[10px] text-slate-400 truncate">
              {session.operator_name || session.scanner_name || "Operator"} &bull; સર્વ શિબિર સ્કેનર
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-full text-[11px] font-mono">
            <span className="text-emerald-400 font-bold">{session.scan_count ?? 0}</span>
            <span className="text-slate-400 text-[10px]">હાજરી</span>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="અવાજ"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          <button
            type="button"
            onClick={() => void verifyAuth()}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="રિફ્રેશ"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-300 hover:bg-rose-900"
            title="લોગઆઉટ"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area: Primary Camera Scanner + Secondary Manual Mobile Lookup */}
      <main className="flex-1 w-full max-w-md mx-auto px-3 py-3 space-y-3">
        {/* LIVE RESULT BANNER (Immediate feedback for both QR and Manual Check-In) */}
        {result && (
          <div
            onClick={scanNext}
            className="cursor-pointer rounded-2xl shadow-xl transition-all"
            data-testid="attendance-result-banner"
          >
            {result.state === "success" && (
              <div className="bg-emerald-950 border-2 border-emerald-400 text-white p-3.5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 block">
                      ✅ હાજરી સફળતાપૂર્વક નોંધાઈ
                    </span>
                    <h3 className="text-base font-extrabold text-white truncate mt-0.5">
                      {result.participant_name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs font-mono text-emerald-200 font-bold bg-emerald-900/70 px-2 py-0.5 rounded border border-emerald-500/40">
                        {result.participant_id}
                      </span>
                      {result.district && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-extrabold">
                          📍 {result.district}
                        </span>
                      )}
                    </div>
                    {result.event_title && (
                      <p className="text-xs text-emerald-200 font-semibold mt-1 truncate">
                        {result.event_title}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result.state === "duplicate" && (
              <div className="bg-amber-950 border-2 border-amber-400 text-white p-3.5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 block">
                      ⚠️ {result.message || "આ સદસ્યની હાજરી પહેલેથી નોંધાઈ ગઈ છે."}
                    </span>
                    <h3 className="text-base font-extrabold text-white truncate mt-0.5">
                      {result.participant_name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs font-mono text-amber-200 font-bold bg-amber-900/70 px-2 py-0.5 rounded border border-amber-500/40">
                        {result.participant_id}
                      </span>
                      {result.district && (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-extrabold">
                          📍 {result.district}
                        </span>
                      )}
                    </div>
                    {result.event_title && (
                      <p className="text-xs text-amber-200 font-semibold mt-1 truncate">
                        {result.event_title}
                      </p>
                    )}
                    {result.check_in_time && (
                      <p className="text-[10px] text-amber-300 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
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

            {result.state === "closed" && (
              <div className="bg-slate-900 border-2 border-rose-500 text-white p-3.5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400 block">
                      🔒 હાજરી બંધ / શિબિર પૂર્ણ
                    </span>
                    {result.participant_name && (
                      <h3 className="text-base font-extrabold text-white truncate mt-0.5">
                        {result.participant_name}
                      </h3>
                    )}
                    {result.event_title && (
                      <p className="text-xs text-rose-200 font-semibold mt-1 truncate">
                        {result.event_title}
                      </p>
                    )}
                    <p className="text-xs font-medium text-rose-100 leading-relaxed mt-1">
                      {result.error || "આ યોગ શિબિરની હાજરી નોંધણીનો સમય પૂર્ણ થઈ ગયો છે."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(result.state === "invalid" || result.state === "error" || result.state === "unauthorized") && (
              <div className="bg-rose-950 border-2 border-rose-400 text-white p-3.5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                    <XCircle className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400 block">
                      {result.code === "PLAIN_REGISTRATION_NUMBER"
                        ? "સાદો નંબર સ્કેન અમાન્ય"
                        : result.code === "NOT_REGISTERED"
                        ? "નોંધણી મળી નથી"
                        : result.code === "DB_ERROR"
                        ? "સર્વર સમસ્યા"
                        : "હાજરી સૂચના"}
                    </span>
                    <p className="text-xs font-medium text-rose-100 leading-relaxed mt-1">
                      {result.error || "હાજરી નોંધવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRIMARY SECTION: CAMERA QR SCANNER */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="relative w-full aspect-[4/3] max-h-[270px] bg-black flex flex-col items-center justify-center overflow-hidden">
            {/* Video Element (Always mounted for safe ref binding) */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`absolute inset-0 w-full h-full object-cover ${isCameraActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            />

            {isCameraActive ? (
              <>
                {/* Viewfinder Frame */}
                <div className="relative w-48 h-48 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_25px_rgba(16,185,129,0.25)] pointer-events-none flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                  {busy && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                      <span className="text-[11px] font-semibold mt-1">ચકાસી રહ્યું છે...</span>
                    </div>
                  )}
                </div>

                {/* Active Camera Controls */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = facingMode === "environment" ? "user" : "environment";
                      setFacingMode(nextMode);
                      void startCamera(nextMode);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900/85 border border-slate-700 text-slate-200 text-[11px] font-semibold"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>કેમેરા બદલો</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {torchSupported && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold ${
                          torchEnabled
                            ? "bg-amber-500 border-amber-400 text-black font-bold"
                            : "bg-slate-900/85 border-slate-700 text-slate-200"
                        }`}
                      >
                        {torchEnabled ? <Flashlight className="w-3.5 h-3.5" /> : <FlashlightOff className="w-3.5 h-3.5" />}
                        <span>ટોર્ચ</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        userRequestedCameraRef.current = false;
                        stopCamera();
                      }}
                      className="px-2.5 py-1.5 rounded-full bg-rose-950/85 border border-rose-700/60 text-rose-200 text-[11px] font-semibold"
                    >
                      બંધ કરો
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Idle / Error Camera Startup Prompt */
              <div className="p-4 text-center flex flex-col items-center justify-center max-w-xs z-10">
                {cameraError ? (
                  <div
                    className="mb-3 p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-100 text-xs leading-relaxed font-medium"
                    data-testid="camera-error-message"
                  >
                    {cameraError}
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 mb-3 font-medium">
                    QR કોડ સ્કેન કરવા માટે કેમેરા શરૂ કરો
                  </p>
                )}

                <Button
                  type="button"
                  disabled={isStartingCamera}
                  onClick={() => void startCamera()}
                  data-testid="start-camera-button"
                  className="h-11 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl gap-2 shadow-md"
                >
                  {isStartingCamera ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>કેમેરા શરૂ થઈ રહ્યો છે...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>કેમેરા શરૂ કરો</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* SECONDARY SECTION: MANUAL MOBILE NUMBER LOOKUP ("Mobile Number થી શોધો") */}
        <section
          className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 space-y-3 shadow-lg"
          data-testid="manual-mobile-section"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-xs sm:text-sm font-extrabold text-white">
                Mobile Number થી શોધો
              </h2>
            </div>
            <span className="text-[10px] text-slate-400">
              10-અંકનો મોબાઈલ નંબર
            </span>
          </div>

          <form onSubmit={handleManualSearch} className="flex gap-2">
            <Input
              ref={mobileInputRef}
              type="tel"
              inputMode="tel"
              placeholder="મોબાઈલ નંબર લખો (દા.ત. 9876543210)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchResults([]);
                setSelectedRegId(null);
                setEventSelectionWarning(null);
                setSearchError(null);
                setHasSearched(false);
                setResult(null);
              }}
              data-testid="manual-mobile-input"
              className="h-11 text-sm bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-400 rounded-xl flex-1 font-mono"
            />
            <Button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              data-testid="manual-search-button"
              className="h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl gap-1.5 shrink-0"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>શોધી રહ્યા છીએ...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>શોધો</span>
                </>
              )}
            </Button>
          </form>

          {searchError && (
            <div
              className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/60 text-rose-200 text-xs font-semibold"
              data-testid="manual-search-error"
            >
              {searchError}
            </div>
          )}

          {/* STEP 4: MULTIPLE REGISTRATIONS EVENT SELECTION (NO AUTO-SELECTION) */}
          {searchResults.length > 1 && (
            <div
              className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2.5"
              data-testid="manual-multiple-event-selector"
            >
              <p className="text-xs font-extrabold text-amber-300 leading-relaxed">
                આ મોબાઇલ નંબર સાથે એકથી વધુ નોંધણી મળી છે. કયા કાર્યક્રમમાં હાજરી નોંધાવવી છે?
              </p>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
                {searchResults.map((r) => {
                  const isSelected = selectedRegId === r.id;
                  const formattedDate = formatEventDateDisplay(r.event_date);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRegId(r.id);
                        setEventSelectionWarning(null);
                      }}
                      data-testid={`manual-event-option-${r.event_id}`}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-emerald-950/70 border-emerald-400 text-white shadow-sm"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                          {r.event_title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap">
                          {r.district && (
                            <span className="font-semibold text-emerald-300">
                              📍 {r.district}
                            </span>
                          )}
                          {formattedDate && (
                            <span className="text-slate-400 font-mono">
                              📅 {formattedDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-500 text-black"
                            : "border-slate-600"
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {eventSelectionWarning && (
                <p
                  className="text-xs font-bold text-rose-400 px-1"
                  data-testid="manual-select-event-warning"
                >
                  {eventSelectionWarning}
                </p>
              )}

              {!selectedRegId && (
                <Button
                  type="button"
                  onClick={() => void handleManualMark(null)}
                  data-testid="manual-unselected-checkin-button"
                  className="w-full h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Check In</span>
                </Button>
              )}
            </div>
          )}

          {/* STEP 3 & STEP 5: SELECTED PARTICIPANT CARD & CHECK-IN */}
          {(() => {
            const selectedRow =
              searchResults.length === 1
                ? searchResults[0]
                : searchResults.find((r) => r.id === selectedRegId) || null;
            if (!selectedRow) return null;

            const formattedDate = formatEventDateDisplay(selectedRow.event_date);

            return (
              <div
                key={selectedRow.id}
                data-testid={`manual-result-${selectedRow.registration_number}`}
                className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-extrabold text-white truncate">
                        {selectedRow.full_name}
                      </h3>
                      {selectedRow.is_attended && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                          આ સદસ્યની હાજરી પહેલેથી નોંધાઈ ગઈ છે.
                        </span>
                      )}
                      {selectedRow.attendance_closed && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                          આ યોગ શિબિરની હાજરી નોંધણીનો સમય પૂર્ણ થઈ ગયો છે.
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-emerald-400 truncate">
                      {selectedRow.event_title}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-slate-300 flex-wrap">
                      <span className="font-mono font-bold text-slate-200 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {selectedRow.registration_number}
                      </span>
                      {selectedRow.district && (
                        <span className="text-slate-300 truncate">
                          📍 {selectedRow.district}
                        </span>
                      )}
                      {formattedDate && (
                        <span className="text-slate-400 font-mono">
                          📅 {formattedDate}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={markingId === selectedRow.id}
                    onClick={() => void handleManualMark(selectedRow)}
                    data-testid={`manual-checkin-${selectedRow.registration_number}`}
                    className={`h-10 px-4 rounded-xl text-xs font-extrabold gap-1.5 shrink-0 ${
                      selectedRow.attendance_closed
                        ? "bg-rose-900/80 hover:bg-rose-800 text-rose-100"
                        : selectedRow.is_attended
                        ? "bg-amber-600 hover:bg-amber-500 text-white"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                  >
                    {markingId === selectedRow.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : selectedRow.attendance_closed ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{selectedRow.attendance_closed ? "હાજરી બંધ" : "Check In"}</span>
                  </Button>
                </div>
              </div>
            );
          })()}

          {hasSearched && !searching && searchResults.length === 0 && !searchError && (
            <div
              className="p-4 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs"
              data-testid="manual-no-results"
            >
              આ મોબાઇલ નંબરથી કોઈ નોંધણી મળી નથી.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
