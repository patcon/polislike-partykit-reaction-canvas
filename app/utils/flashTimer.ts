// Flash-timer helpers for the Snap Moment countdown feature.
// The emcee schedules a snap a few seconds out; a countdown is broadcast to
// every canvas and the snapshot fires at zero. See SPEC.md.

export const FLASH_TIMER_DEFAULT_SEC = 5;

/** Coerce arbitrary input into a whole-second positive duration, defaulting on garbage. */
export function normalizeFlashDuration(durationSec: number): number {
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
    return FLASH_TIMER_DEFAULT_SEC;
  }
  return Math.floor(durationSec);
}

export interface FlashTimerStartMessage {
  type: 'startFlashTimer';
  endTimestamp: number;
  label: string;
}

/** Build the client→server message. `endTimestamp` is absolute epoch ms so clients tick independently. */
export function buildFlashTimerStart(durationSec: number, label: string, now: number): FlashTimerStartMessage {
  const seconds = normalizeFlashDuration(durationSec);
  return {
    type: 'startFlashTimer',
    endTimestamp: now + seconds * 1000,
    label: label.trim(),
  };
}

export interface FlashTimerStartedMessage {
  type: 'flashTimerStarted';
  endTimestamp: number;
  label: string;
}

/** Build the server→all broadcast that drives the countdown overlay on every canvas. */
export function buildFlashTimerStarted(endTimestamp: number, label: string): FlashTimerStartedMessage {
  return { type: 'flashTimerStarted', endTimestamp, label };
}

/** Whole seconds left until `endTimestamp`, rounded up and clamped at 0. Each client ticks this from its own clock. */
export function flashSecondsRemaining(endTimestamp: number, now: number): number {
  return Math.max(0, Math.ceil((endTimestamp - now) / 1000));
}
