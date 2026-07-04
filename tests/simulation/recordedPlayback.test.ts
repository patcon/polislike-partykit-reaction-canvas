import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseRecording,
  createRecordedPlaybackProgram,
  isRecordingAvailable,
  type RecordingFile,
} from '../../app/lib/simulation/programs/recordedPlayback';
import { DEFAULT_ANCHORS } from '../../app/utils/voteRegion';
import type { SimContext } from '../../app/lib/simulation/types';

// Recorded playback ignores ctx, but the SimulationProgram.init signature requires one.
const CTX: SimContext = { userCount: 0, seed: 0, regionAnchors: DEFAULT_ANCHORS };

const FIXTURE: RecordingFile = {
  recordingStart: 1000,
  recordingEnd: 1300,
  mode: 'positions',
  events: [
    { connectionId: 'a', type: 'arrival', timestamp: 1000 },
    { connectionId: 'a', type: 'move', timestamp: 1100, x: 10, y: 20 },
    { connectionId: 'b', type: 'touch', timestamp: 1150, x: 30, y: 40 },
    { connectionId: 'a', type: 'departure', timestamp: 1250 },
  ],
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('parseRecording', () => {
  it('maps connectionIds to sim_ ids, rebases time, sorts, and skips arrivals', () => {
    const { events, duration, userIds } = parseRecording(FIXTURE);
    expect(duration).toBe(300);
    expect(userIds.sort()).toEqual(['sim_a', 'sim_b']);
    expect(events.map((e) => ({ t: e.t, type: e.cursor.type, id: e.cursor.position.userId }))).toEqual([
      { t: 100, type: 'move', id: 'sim_a' },
      { t: 150, type: 'touch', id: 'sim_b' },
      { t: 250, type: 'remove', id: 'sim_a' }, // departure -> remove
    ]);
    expect(events[0].cursor.position).toMatchObject({ x: 10, y: 20 });
  });
});

describe('recorded playback program', () => {
  it('emits recorded events in order once loaded', async () => {
    const p = createRecordedPlaybackProgram(async () => FIXTURE);
    p.init(CTX);
    await flush();
    const emitted: Array<{ type: string; id: string }> = [];
    for (const t of [120, 160, 260]) {
      for (const e of p.tick(t, 50)) emitted.push({ type: e.type, id: e.position.userId });
    }
    expect(emitted).toEqual([
      { type: 'move', id: 'sim_a' },
      { type: 'touch', id: 'sim_b' },
      { type: 'remove', id: 'sim_a' },
    ]);
  });

  it('emits nothing before the recording has loaded', () => {
    const p = createRecordedPlaybackProgram(async () => FIXTURE);
    p.init(CTX);
    expect(p.tick(120, 50)).toEqual([]); // load promise not resolved yet
  });

  it('loops when time passes the recording duration', async () => {
    const p = createRecordedPlaybackProgram(async () => FIXTURE);
    p.init(CTX);
    await flush();
    let moves = 0;
    for (let t = 0; t <= 650; t += 50) {
      for (const e of p.tick(t, 50)) if (e.type === 'move' && e.position.userId === 'sim_a') moves += 1;
    }
    expect(moves).toBeGreaterThanOrEqual(2); // ~one per 300ms loop across >2 loops
  });

  it('teardown removes every user seen in the recording', async () => {
    const p = createRecordedPlaybackProgram(async () => FIXTURE);
    p.init(CTX);
    await flush();
    const t = p.teardown();
    expect(t.every((e) => e.type === 'remove')).toBe(true);
    expect(t.map((e) => e.position.userId).sort()).toEqual(['sim_a', 'sim_b']);
  });

  it('degrades gracefully when loading fails (emits nothing, does not throw)', async () => {
    const p = createRecordedPlaybackProgram(async () => { throw new Error('404'); });
    p.init(CTX);
    await flush();
    expect(() => p.tick(120, 50)).not.toThrow();
    expect(p.tick(120, 50)).toEqual([]);
  });
});

describe('isRecordingAvailable', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is true when the asset fetch succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => FIXTURE })));
    expect(await isRecordingAvailable()).toBe(true);
  });

  it('is false when the asset is missing or fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await isRecordingAvailable()).toBe(false);
  });
});
