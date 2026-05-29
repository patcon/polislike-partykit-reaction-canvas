import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import TreevitesPanel from '../app/components/panels/TreevitesPanel';
import { PanelContextProvider } from '../app/context/PanelContext';

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

export const EmptyState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Leaderboard')).toBeInTheDocument();
    await expect(canvas.getByText(/No invite chains recorded yet/)).toBeInTheDocument();
  },
};

export const WithInviteTree: Story = {
  args: {
    inviteEdges: {
      'user-2': 'user-1',
      'user-3': 'user-1',
      'user-4': 'user-2',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Leaderboard')).toBeInTheDocument();
    // user-1 is the root with 3 descendants and is the current user
    await expect(canvas.getByText('(you)')).toBeInTheDocument();
    // All four users should appear
    await expect(canvas.getByText('user-1')).toBeInTheDocument();
    await expect(canvas.getByText('user-2')).toBeInTheDocument();
    await expect(canvas.getByText('user-3')).toBeInTheDocument();
    await expect(canvas.getByText('user-4')).toBeInTheDocument();
  },
};
