import React, { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoidsCanvas, type BoidTuning, type PairingMode } from './boids-shared';
import { useRawCoordStream } from '../app/hooks/useCoordStream';
import { getPersistentUserId } from '../app/utils/userId';

/**
 * Live-room boids: connects to a real PartyKit room via useRawCoordStream
 * and runs the boids sim over live human cursor positions.
 *
 * useRawCoordStream uses a native WebSocket (explicit wss:// URL) rather than
 * partysocket/react, so Storybook's mock alias doesn't intercept it.
 *
 * Badge shows ws status (connecting/connected/error) and live human count so
 * you can confirm data is flowing before boids start reacting.
 *
 * To see boids respond: open the deployed app in another tab and move your
 * cursor — e.g. https://whispering-gallery.patcon.partykit.dev/
 */

function BoidLiveRoom({
  roomUrl,
  boidCount,
  mode,
  showHumans,
  humanAttraction,
  personalSpace,
  separation,
  alignment,
  cohesion,
  maxSpeed,
}: { roomUrl: string; boidCount: number; mode: PairingMode; showHumans: boolean } & BoidTuning) {
  // Stable userId so we're excluded from our own position stream.
  const userId = useRef(getPersistentUserId()).current;
  const stream = useRawCoordStream(roomUrl || null, userId);
  return (
    <BoidsCanvas
      stream={stream}
      boidCount={boidCount}
      mode={mode}
      showHumans={showHumans}
      tuning={{ humanAttraction, personalSpace, separation, alignment, cohesion, maxSpeed }}
    />
  );
}

const meta = {
  title: 'Spikes/BoidsSpikeLive',
  component: BoidLiveRoom,
  parameters: { layout: 'padded' },
  argTypes: {
    roomUrl: { control: 'text' },
    mode: { control: 'radio', options: ['dynamic', 'strict'] },
    boidCount: { control: { type: 'range', min: 0, max: 400, step: 10 } },
    humanAttraction: { control: { type: 'range', min: 0, max: 0.4, step: 0.01 } },
    personalSpace: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    separation: { control: { type: 'range', min: 0, max: 0.2, step: 0.01 } },
    alignment: { control: { type: 'range', min: 0, max: 0.2, step: 0.01 } },
    cohesion: { control: { type: 'range', min: 0, max: 0.05, step: 0.002 } },
    maxSpeed: { control: { type: 'range', min: 0.2, max: 4, step: 0.1 } },
  },
} satisfies Meta<typeof BoidLiveRoom>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Aloof: boids loosely orbit the crowd rather than clinging to each person. */
export const Aloof: Story = {
  args: {
    roomUrl: 'https://whispering-gallery.patcon.partykit.dev/default',
    boidCount: 200,
    mode: 'dynamic',
    showHumans: true,
    humanAttraction: 0.03,
    personalSpace: 22,
    separation: 0.08,
    alignment: 0.08,
    cohesion: 0.012,
    maxSpeed: 1.6,
  },
};

/** Clingy: boids pile directly onto each human cursor. */
export const Clingy: Story = {
  args: {
    roomUrl: 'https://whispering-gallery.patcon.partykit.dev/default',
    boidCount: 200,
    mode: 'dynamic',
    showHumans: true,
    humanAttraction: 0.12,
    personalSpace: 0,
    separation: 0.06,
    alignment: 0.05,
    cohesion: 0.008,
    maxSpeed: 1.6,
  },
};
