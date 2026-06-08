import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import HelloWorldPanel from './component';
import { PanelContextProvider } from '../../app/context/PanelContext';

const meta = {
  title: 'Panels/HelloWorldPanel',
  component: HelloWorldPanel,
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
    await expect(canvas.getByText('Hello, world!')).toBeInTheDocument();
  },
};
