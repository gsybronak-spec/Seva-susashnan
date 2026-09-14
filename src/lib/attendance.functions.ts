// ============================================================
// ATTENDANCE (physical check-in model)
// ============================================================
// The old heartbeat-based online attendance system was removed with
// the webinar concept. All attendance is now physical check-in via
// QR scan or manual staff action — see checkin.functions.ts.
// This module keeps the public API surface used by the success page.
// ============================================================

export { verifyRegistration } from "./checkin-verify";
export {
  resolveQrToken,
  performCheckin,
  adminAttendanceSummary,
  adminAttendanceList,
  type CheckinResult,
  type QrResolution,
  type CheckinParticipant,
} from "./checkin.functions";
