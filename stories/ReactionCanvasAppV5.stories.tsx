import type { Meta, StoryObj } from '@storybook/react-vite';
import ReactionCanvasAppV5 from '../app/components/apps/ReactionCanvasAppV5';
import React from 'react';

const EXAMPLE_VIDEO_ID = 'irc6creOFGs';

const meta = {
  title: 'App/ReactionCanvasAppV5',
  component: ReactionCanvasAppV5,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => React.createElement('div', { style: { height: '100vh', width: '100vw', overflow: 'hidden' } }, React.createElement(Story)),
  ],
  args: {
    room: EXAMPLE_VIDEO_ID,
    testConnectionFn: () => Promise.resolve(true),
  },
  beforeEach: () => {
    const url = new URL(window.location.href);
    url.searchParams.set('forceView', 'mobile');
    window.history.replaceState({}, '', url.toString());
    return () => {
      const reset = new URL(window.location.href);
      reset.searchParams.delete('forceView');
      window.history.replaceState({}, '', reset.toString());
    };
  },
} satisfies Meta<typeof ReactionCanvasAppV5>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoVideo: Story = {
  args: { room: 'default' },
};

export const DatabaseConnecting: Story = {
  args: {
    room: EXAMPLE_VIDEO_ID,
    testConnectionFn: () => new Promise(() => {}),
  },
};

export const DatabaseUnreachable: Story = {
  args: {
    room: EXAMPLE_VIDEO_ID,
    testConnectionFn: () => Promise.resolve(false),
  },
};
