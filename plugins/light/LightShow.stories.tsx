import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import LightShowPanel from './LightShow';
import { PanelContextProvider } from '../../app/context/PanelContext';
import { emitToRoom } from '../../.storybook/mocks/partysocket-react';

const ROOM = 'storybook-light-show';

const meta = {
  title: 'Panels/LightShowPanel',
  component: LightShowPanel,
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
    room: ROOM,
    userId: 'story-user',
    inviteEdges: {},
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function DefaultDriver({ room }: { room: string }) {
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      emitToRoom(room, { type: 'setBatchScreenLight', mode: 'global', color: '#ffffff', brightness: 100 });
    });
    return () => cancelAnimationFrame(raf);
  }, [room]);
  return null;
}

export const Default: Story = {
  name: 'Default (white, full brightness)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <DefaultDriver room={room} />
        <LightShowPanel />
      </>
    );
  },
};
