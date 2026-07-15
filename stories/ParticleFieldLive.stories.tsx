import React, { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ParticleFieldCanvas from '../plugins/particleField/ParticleFieldCanvas';
import { useRawCoordStream } from '../app/hooks/useCoordStream';
import { getPersistentUserId } from '../app/utils/userId';
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

function ParticleFieldLiveRoom({
  roomUrl,
  showCursors,
  ...params
}: { roomUrl: string; showCursors: boolean } & Params) {
  const userId = useRef(getPersistentUserId()).current;
  const stream = useRawCoordStream(roomUrl || null, userId, { includeSelf: true });
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
