import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within, userEvent } from 'storybook/test';
import React from 'react';
import ParticleFieldPanel from './component';
import { PanelContextProvider } from '../../app/context/PanelContext';

const meta = {
  title: 'Panels/ParticleFieldPanel',
  component: ParticleFieldPanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="v2-app-container" style={{ height: '100vh' }}>
        <PanelContextProvider value={{ room: 'test-room', userId: 'user-1' } as never}>
          <Story />
        </PanelContextProvider>
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector('canvas')).toBeInTheDocument();
    await expect(canvas.getByText('Particle Field settings')).toBeInTheDocument();
  },
};

export const DrawerCollapsed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByText('Particle Field settings');
    await userEvent.click(toggle);
    await expect(canvas.queryByText('Force scale')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(canvas.getByText('Force scale')).toBeInTheDocument();
  },
};
