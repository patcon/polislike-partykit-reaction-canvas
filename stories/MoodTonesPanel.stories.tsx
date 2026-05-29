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
    // Emit a few fake cursors moving in a slow sine wave across the canvas.
    // audienceSync is on by default so the mood slider follows the aggregate position.
    let tick = 0;
    const USERS = ['ghost-1', 'ghost-2', 'ghost-3'];
    const interval = setInterval(() => {
      const t = tick++ / 20; // ~0-1 over 5 seconds at 250ms
      USERS.forEach((userId, i) => {
        const phase = (i / USERS.length) * Math.PI * 2;
        // Coordinates in 0-100 scale (computeRegion/cursorMoodValue divide by 100 internally)
        const x = 50 + 40 * Math.sin(t * Math.PI * 2 + phase);
        const y = 50 + 20 * Math.cos(t * Math.PI * 2 + phase);
        emitToRoom('storybook', { type: 'move', position: { userId, x, y } });
      });
      if (tick % 4 === 0) {
        emitToRoom('storybook', { type: 'presenceCount', count: USERS.length });
      }
    }, 250);

    // Run for 10 seconds then clean up
    await new Promise(resolve => setTimeout(resolve, 10000));
    clearInterval(interval);
    USERS.forEach(userId =>
      emitToRoom('storybook', { type: 'remove', position: { userId, x: 0, y: 0 } })
    );
  },
};
