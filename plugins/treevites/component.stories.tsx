import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import TreevitesPanel from './component';
import { PanelContextProvider } from '../../app/context/PanelContext';

const meta = {
  title: 'Panels/TreevitesPanel',
  component: TreevitesPanel,
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

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No participants yet')).toBeInTheDocument();
  },
};

export const WithTree: Story = {
  args: {
    inviteEdges: { 'user-2': 'user-1', 'user-3': 'user-1', 'user-4': 'user-2' },
  },
};
