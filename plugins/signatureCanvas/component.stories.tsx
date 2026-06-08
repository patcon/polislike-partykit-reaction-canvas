import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within, userEvent } from 'storybook/test';
import React, { useEffect } from 'react';
import SignatureCanvasPanel from './component';
import { PanelContextProvider } from '../../app/context/PanelContext';
import { emitToRoom } from '../../.storybook/mocks/partysocket-react';

const meta = {
  title: 'Panels/SignatureCanvasPanel',
  component: SignatureCanvasPanel,
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

// Emits a simple diagonal stroke for a given user.
function emitStroke(room: string, userId: string, strokeId: string) {
  const points = Array.from({ length: 6 }, (_, i) => ({
    x: 10 + i * 14,
    y: 30 + i * 5,
  }));
  emitToRoom(room, { type: 'strokeSegment', userId, strokeId, points, isFinal: true });
}

function StrokesDriver({ room }: { room: string }) {
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      emitStroke(room, 'user-alice', 'stroke-a1');
      emitStroke(room, 'user-bob',   'stroke-b1');
      emitStroke(room, 'user-carol', 'stroke-c1');
    });
    return () => cancelAnimationFrame(raf);
  }, [room]);
  return null;
}

export const ParticipantView: Story = {
  name: 'Participant — drawing mode',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Sign here')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Show: Grid' })).toBeInTheDocument();
  },
};

export const PresenterView: Story = {
  name: 'Presenter — signature grid (no strokes yet)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show: Grid' }));
    await expect(canvas.getByRole('button', { name: 'Sign' })).toBeInTheDocument();
  },
};

export const PresenterWithStrokes: Story = {
  name: 'Presenter — grid with signatures',
  render: (args) => (
    <>
      <StrokesDriver room={(args as any).room ?? 'storybook'} />
      <SignatureCanvasPanel />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show: Grid' }));
    await expect(canvas.getByRole('button', { name: 'Sign' })).toBeInTheDocument();
  },
};

export const ClearSignature: Story = {
  name: 'Cleared signature disappears',
  render: (args) => {
    const room = (args as any).room ?? 'storybook';
    return (
      <>
        <StrokesDriver room={room} />
        <SignatureCanvasPanel />
      </>
    );
  },
  play: async ({ canvasElement, args }) => {
    const room = (args as any).room ?? 'storybook';
    const canvas = within(canvasElement);
    // Switch to presenter grid so strokes are visible
    await userEvent.click(canvas.getByRole('button', { name: 'Show: Grid' }));
    // Clear alice's signature
    emitToRoom(room, { type: 'signatureCleared', userId: 'user-alice' });
    await expect(canvas.getByRole('button', { name: 'Sign' })).toBeInTheDocument();
  },
};
