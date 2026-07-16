import React, { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ParticleFieldCanvas from '../plugins/particleField/ParticleFieldCanvas';
import type { ParticleFieldStream } from '../plugins/particleField/ParticleFieldCanvas';
import { useRawCoordStream } from '../app/hooks/useCoordStream';
import { useSmoothedCoordStream } from '../app/hooks/useSmoothedCoordStream';
import { SMOOTH_CURSOR_CONFIG } from '../app/utils/cursor';
import { getPersistentUserId } from '../app/utils/userId';
import { SimulationEngine } from '../app/lib/simulation/engine';
import { PROGRAMS } from '../app/lib/simulation/programs';
import { DEFAULT_ANCHORS } from '../app/utils/voteRegion';
import type { CursorEvent, SimSink } from '../app/lib/simulation/types';
import type { Params } from '../plugins/particleField/types';

/**
 * Live-room particle field: connects to a real PartyKit room via
 * useRawCoordStream and runs the particle-field sim over live human cursor
 * positions (bypasses the Storybook partysocket/react mock, same as
 * BoidsSpikeLive.stories.tsx).
 *
 * To see particles respond: open the deployed app in another tab and move
 * your cursor — e.g. https://whispering-gallery.patcon.partykit.dev/
 */

/** Simulated-program choices offered by this story (subset of `PROGRAMS`). */
const SIM_PROGRAM_IDS = ['drift', 'valence-shift'] as const;
const SIM_SEED = 42;

/**
 * Runs a `SimulationProgram` (see app/lib/simulation) locally — via the same
 * `SimulationEngine` the demo pages' `SimControlBar` uses, just fed a local
 * sink instead of a socket — and merges its cursor events into the real
 * cursor stream, so the particle field has something to react to even when
 * the room is empty. Sim ids keep the engine's `sim_<i>` prefix, which is how
 * the badge in ParticleFieldCanvas splits "cursors" from "humans".
 */
function useMergedSimulatedStream(
  raw: ParticleFieldStream,
  programId: string,
  count: number,
  groupCount: number,
): ParticleFieldStream {
  const mergedRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const connectedRef = useRef<Set<string>>(new Set());
  const simPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const simConnectedRef = useRef<Set<string>>(new Set());

  // (Re)start the engine whenever the chosen program, count, or group count changes.
  useEffect(() => {
    if (count <= 0) {
      simPositionsRef.current.clear();
      simConnectedRef.current.clear();
      return;
    }
    const entry = PROGRAMS.find((p) => p.id === programId) ?? PROGRAMS[0];
    const sink: SimSink = {
      emit(events: CursorEvent[]) {
        for (const e of events) {
          if (e.type === 'remove') {
            simPositionsRef.current.delete(e.position.userId);
            simConnectedRef.current.delete(e.position.userId);
          } else {
            simPositionsRef.current.set(e.position.userId, { x: e.position.x, y: e.position.y });
            simConnectedRef.current.add(e.position.userId);
          }
        }
      },
    };
    const engine = new SimulationEngine(entry.create(), sink, {
      userCount: count,
      seed: SIM_SEED,
      regionAnchors: DEFAULT_ANCHORS,
      groupCount,
    });
    engine.play();
    return () => engine.stop();
  }, [programId, count, groupCount]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const merged = mergedRef.current;
      merged.clear();
      for (const [id, p] of raw.positionsRef.current) merged.set(id, p);
      for (const [id, p] of simPositionsRef.current) merged.set(id, p);

      // Simulated users are always "connected" — they never lift a finger.
      const connected = connectedRef.current;
      connected.clear();
      for (const id of raw.connectedRef.current) connected.add(id);
      for (const id of simConnectedRef.current) connected.add(id);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [raw.positionsRef, raw.connectedRef]);

  return { positionsRef: mergedRef, connectedRef, status: raw.status };
}

function ParticleFieldLiveRoom({
  roomUrl,
  showCursors,
  simulatedProgram,
  simulatedCount,
  simulatedGroupCount,
  ...params
}: {
  roomUrl: string;
  showCursors: boolean;
  simulatedProgram: string;
  simulatedCount: number;
  simulatedGroupCount: number;
} & Params) {
  const userId = useRef(getPersistentUserId()).current;
  const raw = useRawCoordStream(roomUrl || null, userId, { includeSelf: true });
  const smoothed = useSmoothedCoordStream(raw, SMOOTH_CURSOR_CONFIG);
  const stream = useMergedSimulatedStream(smoothed, simulatedProgram, simulatedCount, simulatedGroupCount);
  return (
    <div style={{ width: '100%', height: 480, borderRadius: 8, overflow: 'hidden' }}>
      <ParticleFieldCanvas stream={stream} params={params} showCursors={showCursors} />
    </div>
  );
}

const meta = {
  title: 'Spikes/ParticleFieldLive',
  component: ParticleFieldLiveRoom,
  parameters: { layout: 'padded' },
  argTypes: {
    roomUrl: { control: 'text' },
    showCursors: { control: 'boolean' },
    simulatedProgram: {
      control: 'select',
      options: SIM_PROGRAM_IDS,
      table: { defaultValue: { summary: 'drift' } },
    },
    simulatedCount: { control: { type: 'range', min: 0, max: 10, step: 1 } },
    simulatedGroupCount: { control: { type: 'range', min: 1, max: 7, step: 1 } },
    forceScale: { control: { type: 'range', min: 0, max: 300, step: 5 } },
    proximityRange: { control: { type: 'range', min: 0.05, max: 1.4, step: 0.01 } },
    invert: { control: 'boolean' },
    coreRadius: { control: { type: 'range', min: 4, max: 60, step: 1 } },
    falloff: { control: { type: 'range', min: 40, max: 500, step: 5 } },
    friction: { control: { type: 'range', min: 0, max: 0.3, step: 0.005 } },
    maxSpeed: { control: { type: 'range', min: 50, max: 1000, step: 10 } },
    centerGravity: { control: { type: 'range', min: 0, max: 4, step: 0.05 } },
    multiplier: { control: { type: 'range', min: 1, max: 12, step: 1 } },
  },
} satisfies Meta<typeof ParticleFieldLiveRoom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    roomUrl: 'https://whispering-gallery.patcon.partykit.dev/default',
    showCursors: true,
    simulatedProgram: 'drift',
    simulatedCount: 0,
    simulatedGroupCount: 4,
    forceScale: 180,
    proximityRange: 0.4,
    invert: false,
    coreRadius: 22,
    falloff: 320,
    friction: 0.025,
    maxSpeed: 480,
    centerGravity: 0,
    multiplier: 10,
  },
};
