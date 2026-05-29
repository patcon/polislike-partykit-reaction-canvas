import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
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

export const OscillatingAudienceMood: Story = {
  name: 'Oscillating Audience Mood',
  play: async () => {
    // Single cursor sweeps across the canvas in a wide ellipse.
    // Using one cursor avoids the phase-cancellation problem: with N equally-spaced
    // phases, cursorMoodValue's linearity makes the average always equal cursorMoodValue(50,50).
    // audienceSync is on by default so the mood slider follows the cursor.
    emitToRoom('storybook', { type: 'presenceCount', count: 1 });
    const DURATION = 10000;
    const CYCLE = 5000; // one full mood cycle in ms
    const start = performance.now();
    await new Promise<void>(resolve => {
      const frame = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= DURATION) {
          emitToRoom('storybook', { type: 'remove', position: { userId: 'ghost-1', x: 0, y: 0 } });
          resolve();
          return;
        }
        const t = elapsed / CYCLE;
        // Coordinates in 0-100 scale (computeRegion/cursorMoodValue divide by 100 internally)
        const x = 50 + 45 * Math.sin(t * Math.PI * 2);
        const y = 50 + 40 * Math.cos(t * Math.PI * 2);
        emitToRoom('storybook', { type: 'move', position: { userId: 'ghost-1', x, y } });
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  },
};
