import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React, { useEffect } from 'react';
import ArrivalCanvasPanel from '../app/components/panels/ArrivalCanvasPanel';
import { PanelContextProvider } from '../app/context/PanelContext';
import { emitToRoom } from '../.storybook/mocks/partysocket-react';

const meta = {
  title: 'Panels/ArrivalCanvasPanel',
  component: ArrivalCanvasPanel,
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

function CapacityDriver({ room, capacity }: { room: string; capacity: number }) {
  useEffect(() => {
    emitToRoom(room, { type: 'arrivalCapacityChanged', capacity });
    emitToRoom(room, { type: 'presenceCount', count: 0 });
  }, [room, capacity]);
  return null;
}

export const Default: Story = {
  render: (args) => (
    <>
      <CapacityDriver room={(args as any).room ?? 'storybook'} capacity={20} />
      <ArrivalCanvasPanel />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('0')).toBeInTheDocument();
    await expect(canvas.getByText('/ 20')).toBeInTheDocument();
  },
};

function ArrivalsDriver({ room, capacity }: { room: string; capacity: number }) {
  useEffect(() => {
    emitToRoom(room, { type: 'arrivalCapacityChanged', capacity });
    emitToRoom(room, { type: 'presenceCount', count: 0 });

    const STEPS = 20;
    let step = 0;
    const id = setInterval(() => {
      step++;
      const count = Math.min(Math.round((step / STEPS) * capacity), capacity);
      emitToRoom(room, { type: 'presenceCount', count });
      if (step >= STEPS) clearInterval(id);
    }, 500);

    return () => clearInterval(id);
  }, [room, capacity]);
  return null;
}

export const SimulatingArrivals: Story = {
  name: 'Simulating Arrivals',
  render: (args) => (
    <>
      <ArrivalsDriver room={(args as any).room ?? 'storybook'} capacity={20} />
      <ArrivalCanvasPanel />
    </>
  ),
};
