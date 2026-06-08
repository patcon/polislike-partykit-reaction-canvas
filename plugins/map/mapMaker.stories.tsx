import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import MapMakerPanel from './mapMaker';
import { PanelContextProvider } from '../../app/context/PanelContext';

const meta = {
  title: 'Panels/MapMakerPanel',
  component: MapMakerPanel,
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

export const EmptyState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Map Maker')).toBeInTheDocument();
    await expect(canvas.getByText(/No moments found/)).toBeInTheDocument();
  },
};
