// Recorded playback program: replays a captured cursor stream (the emcee
// PlaybackFile format) as sim_ cursors, looping. Proves the "recorded stream"
// category works through the same program interface as the generators.
//
// The recording asset is fetched at runtime (not bundled) and the program
// degrades gracefully if it's missing — see docs/specs/simulated-users.md and
// issue #170. The pure parse + windowing is separated from the fetch so it's
// testable without the asset.

import type { CursorEvent, SimulationProgram } from '../types';

/** Served path of the sample recording (gitignored; may be absent). */
export const RECORDING_URL = '/sim-recordings/sample.json';

/** One event as stored in a PlaybackFile (mode 'positions'). */
export interface RecordingEvent {
  connectionId: string;
  type: 'move' | 'touch' | 'remove' | 'arrival' | 'departure';
  timestamp: number;
  x?: number;
  y?: number;
}

export interface RecordingFile {
  recordingStart: number;
  recordingEnd: number;
  room?: string;
  mode?: string;
  events: RecordingEvent[];
}

interface NormalizedEvent {
  /** Milliseconds from the start of the recording. */
  t: number;
  cursor: CursorEvent;
}

/**
 * Convert a raw recording into time-sorted cursor events (rebased to start at 0),
 * plus the total duration and the distinct sim user ids that appear.
 * `move`/`touch` map to the same type; `remove`/`departure` map to `remove`;
 * `arrival` is dropped (the first move/touch establishes the cursor).
 */
export function parseRecording(file: RecordingFile): {
  events: NormalizedEvent[];
  duration: number;
  userIds: string[];
} {
  const origin = file.recordingStart ?? 0;
  const userIds = new Set<string>();
  const events: NormalizedEvent[] = [];

  for (const e of file.events) {
    const userId = `sim_${e.connectionId}`;
    if (e.type === 'move' || e.type === 'touch') {
      userIds.add(userId);
      events.push({ t: e.timestamp - origin, cursor: { type: e.type, position: { x: e.x ?? 0, y: e.y ?? 0, timestamp: 0, userId } } });
    } else if (e.type === 'remove' || e.type === 'departure') {
      events.push({ t: e.timestamp - origin, cursor: { type: 'remove', position: { x: 0, y: 0, timestamp: 0, userId } } });
    }
    // 'arrival' has no position; skip it.
  }

  events.sort((a, b) => a.t - b.t);
  const duration = Math.max(1, (file.recordingEnd ?? origin) - origin);
  return { events, duration, userIds: [...userIds] };
}

async function defaultLoad(): Promise<RecordingFile> {
  const res = await fetch(RECORDING_URL);
  if (!res.ok) throw new Error(`recording ${res.status}`);
  return res.json();
}

/** Whether the recording asset can be fetched (used to enable/disable the option). */
export async function isRecordingAvailable(): Promise<boolean> {
  try {
    const res = await fetch(RECORDING_URL, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Create a Recorded-playback program. Loads the recording via `load` (defaults
 * to fetching {@link RECORDING_URL}) and replays it by elapsed time, looping.
 * Emits nothing until the load resolves, and nothing at all if it fails.
 * @param load Injectable loader; tests pass a fixture to avoid the network.
 */
export function createRecordedPlaybackProgram(
  load: () => Promise<RecordingFile> = defaultLoad,
): SimulationProgram {
  let events: NormalizedEvent[] = [];
  let duration = 1;
  let userIds: string[] = [];
  let idx = 0;
  let lastLoopT = 0;
  let loaded = false;

  return {
    id: 'recorded',
    label: 'Recorded playback',

    init() {
      events = [];
      userIds = [];
      idx = 0;
      lastLoopT = 0;
      loaded = false;
      load()
        .then((file) => {
          const parsed = parseRecording(file);
          events = parsed.events;
          duration = parsed.duration;
          userIds = parsed.userIds;
          loaded = true;
        })
        .catch(() => { loaded = false; }); // missing/unreadable asset — stay silent
    },

    tick(tMs: number): CursorEvent[] {
      if (!loaded || events.length === 0) return [];
      const loopT = tMs % duration;
      if (loopT < lastLoopT) idx = 0; // wrapped past the end — restart the loop
      const out: CursorEvent[] = [];
      while (idx < events.length && events[idx].t <= loopT) {
        out.push(events[idx].cursor);
        idx += 1;
      }
      lastLoopT = loopT;
      return out;
    },

    teardown(): CursorEvent[] {
      return userIds.map((userId) => ({ type: 'remove', position: { x: 0, y: 0, timestamp: 0, userId } }));
    },
  };
}
