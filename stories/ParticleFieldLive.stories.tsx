import React, { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ParticleFieldCanvas from '../plugins/particleField/ParticleFieldCanvas';
import type { ParticleFieldStream } from '../plugins/particleField/ParticleFieldCanvas';
import { useRawCoordStream } from '../app/hooks/useCoordStream';
import { useSmoothedCoordStream } from '../app/hooks/useSmoothedCoordStream';
import { SMOOTH_CURSOR_CONFIG } from '../app/utils/cursor';
import { getPersistentUserId } from '../app/utils/userId';
import { createWanderField } from '../app/lib/simulation/programs/_easing';
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

/**
 * Merges `wanderCount` simulated cursors (ids `sim_wander_N`) that ease
 * toward random targets — via the same createWanderField used by the
 * drift/region-hopper sim programs — into the real cursor stream, so the
 * particle field has something to react to even when the room is empty.
 */
function useMergedWanderStream(raw: ParticleFieldStream, wanderCount: number): ParticleFieldStream {
  const mergedRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const fieldRef = useRef(createWanderField({
    count: wanderCount,
    seed: 42,
    initial: (_, rnd) => ({ x: rnd() * 100, y: rnd() * 100 }),
    pickTarget: (_, rnd) => ({ x: rnd() * 100, y: rnd() * 100 }),
    dwell: 30,
  }));

  // Rebuild the field whenever the slider changes the wanderer count.
  useEffect(() => {
    fieldRef.current = createWanderField({
      count: wanderCount,
      seed: 42,
      initial: (_, rnd) => ({ x: rnd() * 100, y: rnd() * 100 }),
      pickTarget: (_, rnd) => ({ x: rnd() * 100, y: rnd() * 100 }),
      dwell: 30,
    });
  }, [wanderCount]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      fieldRef.current.step();
      const merged = mergedRef.current;
      merged.clear();
      for (const [id, p] of raw.positionsRef.current) merged.set(id, p);
      fieldRef.current.users.forEach((u, i) => merged.set(`sim_wander_${i}`, { x: u.x, y: u.y }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [raw.positionsRef]);

  return { positionsRef: mergedRef, status: raw.status };
}

function ParticleFieldLiveRoom({
  roomUrl,
  showCursors,
  wanderCount,
  ...params
}: { roomUrl: string; showCursors: boolean; wanderCount: number } & Params) {
  const userId = useRef(getPersistentUserId()).current;
  const raw = useRawCoordStream(roomUrl || null, userId, { includeSelf: true });
  const smoothed = useSmoothedCoordStream(raw, SMOOTH_CURSOR_CONFIG);
  const stream = useMergedWanderStream(smoothed, wanderCount);
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
    wanderCount: { control: { type: 'range', min: 0, max: 10, step: 1 } },
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
    wanderCount: 0,
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
