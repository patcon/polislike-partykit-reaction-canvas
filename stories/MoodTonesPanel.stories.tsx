import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React, { useEffect } from 'react';
import MoodTonesPanel from '../app/components/panels/MoodTonesPanel';
import { PanelContextProvider } from '../app/context/PanelContext';
import { emitToRoom } from '../.storybook/mocks/partysocket-react';

const meta = {
  title: 'Panels/MoodTonesPanel',
  component: MoodTonesPanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story, ctx) => (
      <div className="v2-app-container" style={{ height: '100vh' }}>
        <PanelContextProvider value={ctx.args as never}>
          <Story />
        </PanelContextProvider>
      </div>
    ),
  ],
  args: {
    room: 'storybook',
    userId: 'user-1',
    inviteEdges: {},
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('mood tones')).toBeInTheDocument();
    await expect(canvas.getByText('sad → happy')).toBeInTheDocument();
  },
};

function OscillatingMoodDriver({ room }: { room: string }) {
  useEffect(() => {
    const CYCLE = 5000;
    emitToRoom(room, { type: 'presenceCount', count: 1 });
    const start = performance.now();
    let frameId: number;
    const frame = (now: number) => {
      const t = (now - start) / CYCLE;
      // Coordinates in 0-100 scale (computeRegion/cursorMoodValue divide by 100 internally)
      const x = 50 + 45 * Math.sin(t * Math.PI * 2);
      const y = 50 + 40 * Math.cos(t * Math.PI * 2);
      emitToRoom(room, { type: 'move', position: { userId: 'ghost-1', x, y } });
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameId);
      emitToRoom(room, { type: 'remove', position: { userId: 'ghost-1', x: 0, y: 0 } });
    };
  }, [room]);
  return null;
}

export const OscillatingAudienceMood: Story = {
  name: 'Oscillating Audience Mood',
  render: (args) => (
    <>
      <OscillatingMoodDriver room={(args as any).room ?? 'storybook'} />
      <MoodTonesPanel />
    </>
  ),
};
