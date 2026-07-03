// Shared recognition for "simulated" cursor identities.
//
// Two sources produce fake cursors that existing UIs render as simulated
// (purple/dashed, counted separately, slots freed on removal):
//   - `replay_<connectionId>` — the emcee record/playback feature (usePlayback).
//   - `sim_<n>` / `sim_<id>`   — the demo-page simulation engine (app/lib/simulation).
//
// Identity travels in the cursor payload (position.userId), so both are
// recognized purely by prefix. Keep this the single source of truth — inline
// `startsWith('replay_')` checks should call isSimulatedUserId instead.

export const SIM_PREFIX = 'sim_';
export const REPLAY_PREFIX = 'replay_';

/** True for cursor ids produced by either simulation source. */
export function isSimulatedUserId(userId: string): boolean {
  return userId.startsWith(SIM_PREFIX) || userId.startsWith(REPLAY_PREFIX);
}
