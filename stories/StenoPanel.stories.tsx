import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import StenoPanel from '../app/components/panels/StenoPanel';
import { PanelContextProvider } from '../app/context/PanelContext';

const meta = {
  title: 'Panels/StenoPanel',
  component: StenoPanel,
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
    await expect(canvas.getByText('VTT')).toBeInTheDocument();
    await expect(canvas.getByText('Plaintext')).toBeInTheDocument();
    await expect(canvas.getByText('Transcribe')).toBeInTheDocument();
  },
};
