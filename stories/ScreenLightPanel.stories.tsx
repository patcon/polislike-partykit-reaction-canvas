import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import ScreenLightPanel from '../app/components/panels/ScreenLightPanel';
import { PanelContextProvider } from '../app/context/PanelContext';
import { emitToRoom } from '../.storybook/mocks/partysocket-react';

const ROOM = 'storybook-screen-light';

const meta = {
  title: 'Panels/ScreenLightPanel',
  component: ScreenLightPanel,
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

// ===== Drivers =====

function IdleDriver({ room }: { room: string }) {
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      emitToRoom(room, { type: 'connected', lightColor: { color: '#000000', brightness: 100 } });
    });
    return () => cancelAnimationFrame(raf);
  }, [room]);
  return null;
}

// Converts HSL hue (0–360) to a hex colour string at full saturation and 50% lightness.
function hueToHex(hue: number): string {
  const h = hue / 60;
  const s = 1;
  const l = 0.5;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h) % 12;
    const val = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * val).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function ColorCycleDriver({ room, periodMs = 4000 }: { room: string; periodMs?: number }) {
  useEffect(() => {
    emitToRoom(room, { type: 'connected', lightColor: { color: '#ff0000', brightness: 100 } });
    const start = performance.now();
    const id = setInterval(() => {
      const hue = ((performance.now() - start) / periodMs * 360) % 360;
      emitToRoom(room, { type: 'lightColor', color: hueToHex(hue), brightness: 100 });
    }, 50);
    return () => clearInterval(id);
  }, [room, periodMs]);
  return null;
}

function BrightnessPulseDriver({ room, periodMs = 3000 }: { room: string; periodMs?: number }) {
  useEffect(() => {
    emitToRoom(room, { type: 'connected', lightColor: { color: '#ffffff', brightness: 100 } });
    const start = performance.now();
    const id = setInterval(() => {
      const brightness = Math.round(50 + 50 * Math.sin(((performance.now() - start) / periodMs) * Math.PI * 2));
      emitToRoom(room, { type: 'lightColor', color: '#ffffff', brightness });
    }, 50);
    return () => clearInterval(id);
  }, [room, periodMs]);
  return null;
}

// ===== Stories =====

export const Idle: Story = {
  name: 'Idle (black, no incoming messages)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <IdleDriver room={room} />
        <ScreenLightPanel />
      </>
    );
  },
};

export const ColorCycle: Story = {
  name: 'Oscillating colors (full brightness)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <ColorCycleDriver room={room} periodMs={4000} />
        <ScreenLightPanel />
      </>
    );
  },
};

export const BrightnessPulse: Story = {
  name: 'Oscillating brightness (white)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <BrightnessPulseDriver room={room} periodMs={3000} />
        <ScreenLightPanel />
      </>
    );
  },
};
