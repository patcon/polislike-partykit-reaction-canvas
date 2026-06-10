import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect, useRef } from 'react';
import ScreenLightPanel from './ScreenLight';
import { PanelContextProvider } from '../../app/context/PanelContext';
import { emitToRoom } from '../../.storybook/mocks/partysocket-react';

const ROOM = 'storybook-screen-light';
const USER_ID = 'story-user';

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
  argTypes: {
    color:      { control: 'color', description: 'Light color' },
    brightness: { control: { type: 'range', min: 0, max: 100, step: 1 }, description: 'Brightness (0–100%)' },
  },
  args: {
    room: ROOM,
    userId: USER_ID,
    inviteEdges: {},
    color: '#ff0000',
    brightness: 100,
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ===== Drivers =====

function DefaultDriver({ room, color, brightness }: { room: string; color: string; brightness: number }) {
  const mounted = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      emitToRoom(room, { type: 'setBatchScreenLight', mode: 'global', color, brightness });
      mounted.current = true;
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useEffect(() => {
    if (!mounted.current) return;
    emitToRoom(room, { type: 'setBatchScreenLight', mode: 'global', color, brightness });
  }, [room, color, brightness]);

  return null;
}

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
    emitToRoom(room, { type: 'setBatchScreenLight', mode: 'global', color: '#ff0000', brightness: 100 });
    const start = performance.now();
    const id = setInterval(() => {
      const hue = ((performance.now() - start) / periodMs * 360) % 360;
      emitToRoom(room, { type: 'setBatchScreenLight', mode: 'global', color: hueToHex(hue), brightness: 100 });
    }, 50);
    return () => clearInterval(id);
  }, [room, periodMs]);
  return null;
}

function BrightnessPulseDriver({ room, periodMs = 3000 }: { room: string; periodMs?: number }) {
  useEffect(() => {
    emitToRoom(room, { type: 'setBatchScreenLight', mode: 'global', color: '#ffffff', brightness: 100 });
    const start = performance.now();
    const id = setInterval(() => {
      const brightness = Math.round(50 + 50 * Math.sin(((performance.now() - start) / periodMs) * Math.PI * 2));
      emitToRoom(room, { type: 'setBatchScreenLight', mode: 'global', color: '#ffffff', brightness });
    }, 50);
    return () => clearInterval(id);
  }, [room, periodMs]);
  return null;
}

function ForestDriver({ room, periodMs = 100 }: { room: string; periodMs?: number }) {
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const ts = (performance.now() - start) / 1000;
      // Simple green drift for story preview — not full greensRandom, just a hue walk
      const hue = (ts * 20) % 60 + 80; // drift 80–140
      const h = hue / 60, s = 0.55, l = 0.32;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h) % 12;
        const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(255 * v).toString(16).padStart(2, '0');
      };
      const color = `#${f(0)}${f(8)}${f(4)}`;
      emitToRoom(room, { type: 'setBatchScreenLight', mode: 'perParticipant', colors: { [USER_ID]: { color, brightness: 100 } } });
    }, periodMs);
    return () => clearInterval(id);
  }, [room, periodMs]);
  return null;
}

// ===== Stories =====

export const Default: Story = {
  name: 'Default (color + brightness controls)',
  render: (args) => {
    const a = args as any;
    return (
      <>
        <DefaultDriver room={a.room ?? ROOM} color={a.color} brightness={a.brightness} />
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

export const ForestProgram: Story = {
  name: 'Forest program (per-participant drift)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <ForestDriver room={room} />
        <ScreenLightPanel />
      </>
    );
  },
};
