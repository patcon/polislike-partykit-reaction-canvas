import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React, { useEffect } from 'react';
import NeighborPanel from '../app/components/panels/NeighborPanel';
import { PanelContextProvider } from '../app/context/PanelContext';
import { emitToRoom } from '../.storybook/mocks/partysocket-react';

const ROOM = 'storybook-neighbor';

type Strategy = 'cardinal' | 'all';

const meta = {
  title: 'Panels/NeighborPanel',
  component: NeighborPanel,
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
    totalMs:   { control: { type: 'number', min: 1000, step: 1000 }, description: 'Total animation duration (ms)' },
    neighbors: { control: { type: 'number', min: 0, max: 8, step: 0.5 }, description: 'Neighbours per person — integer = exact count, fraction = probability of one more (e.g. 2.7 = always 2, 70% chance of 3)' },
    strategy:  { control: { type: 'select' }, options: ['cardinal', 'all'] as Strategy[], description: '"cardinal" scans only up/down/left/right; "all" also includes diagonals' },
  },
  args: {
    room: ROOM,
    userId: 'user-0-0',
    inviteEdges: {},
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ===== Grid helper =====
function makeCode(n: number) {
  return String(n).padStart(4, '0');
}

type Seat = { userId: string; code: string; row: number; col: number; rows: number; cols: number };

function generateGrid(rows: number, cols: number): Seat[] {
  return Array.from({ length: rows * cols }, (_, i) => ({
    userId: `user-${Math.floor(i / cols)}-${i % cols}`,
    code: makeCode(i + 1),
    row: Math.floor(i / cols),
    col: i % cols,
    rows,
    cols,
  }));
}

function getAdjacent(seat: Seat, seats: Seat[], strategy: Strategy): Seat[] {
  const { row, col, rows, cols } = seat;
  const cardinal = [
    row > 0             ? seats[(row - 1) * cols + col]     : null,
    row < rows - 1      ? seats[(row + 1) * cols + col]     : null,
    col > 0             ? seats[row * cols + col - 1]       : null,
    col < cols - 1      ? seats[row * cols + col + 1]       : null,
  ];
  const diagonals = strategy === 'all' ? [
    row > 0 && col > 0             ? seats[(row - 1) * cols + col - 1] : null,
    row > 0 && col < cols - 1      ? seats[(row - 1) * cols + col + 1] : null,
    row < rows - 1 && col > 0      ? seats[(row + 1) * cols + col - 1] : null,
    row < rows - 1 && col < cols - 1 ? seats[(row + 1) * cols + col + 1] : null,
  ] : [];
  return [...cardinal, ...diagonals].filter(Boolean) as Seat[];
}

// Ease-in-out cubic
function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easedDelay(index: number, total: number, totalMs: number) {
  const t = index / Math.max(total - 1, 1);
  return easeInOut(t) * totalMs;
}

// ===== Unified graph driver =====
function GraphDriver({
  room,
  rows,
  cols,
  neighbors = 2,
  strategy = 'cardinal',
  totalMs = 8000,
}: {
  room: string;
  rows: number;
  cols: number;
  neighbors?: number;
  strategy?: Strategy;
  totalMs?: number;
}) {
  useEffect(() => {
    const seats = generateGrid(rows, cols);
    const allCodes = Object.fromEntries(seats.map(s => [s.userId, s.code]));

    const edges: Array<{ userA: string; userB: string }> = [];
    const edgeSet = new Set<string>();

    const guaranteed = Math.floor(neighbors);
    const extraProb = neighbors - guaranteed;

    for (const seat of seats) {
      const adjacent = getAdjacent(seat, seats, strategy).sort(() => Math.random() - 0.5);
      const count = guaranteed + (Math.random() < extraProb ? 1 : 0);
      for (const target of adjacent.slice(0, count)) {
        const key = [seat.userId, target.userId].sort().join('|');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          const [userA, userB] = key.split('|');
          edges.push({ userA, userB });
        }
      }
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    const raf = requestAnimationFrame(() => {
      emitToRoom(room, { type: 'connected', myNeighborCode: '0001' });
      emitToRoom(room, { type: 'neighborEdgesSnapshot', edges: [], allCodes });

      edges.forEach((edge, i) => {
        const delay = easedDelay(i, edges.length, totalMs) + Math.random() * 200;
        timers.push(setTimeout(() => {
          emitToRoom(room, { type: 'neighborEdgeAdded', userA: edge.userA, userB: edge.userB });
        }, delay));
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [room, rows, cols, neighbors, strategy, totalMs]);
  return null;
}

// ===== Stories =====

export const EntryView: Story = {
  name: 'Entry view (default)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <EntryDriver room={room} />
        <NeighborPanel />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Your code')).toBeInTheDocument();
    await expect(canvas.getByText("Enter a neighbour's code")).toBeInTheDocument();
  },
};

function EntryDriver({ room }: { room: string }) {
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      emitToRoom(room, { type: 'connected', myNeighborCode: '4827' });
    });
    return () => cancelAnimationFrame(raf);
  }, [room]);
  return null;
}

export const CardinalScan: Story = {
  name: 'Cardinal scan — 2 neighbours (graph view)',
  args: { totalMs: 8000, neighbors: 2, strategy: 'cardinal' } as any,
  render: (args) => {
    const a = args as any;
    return (
      <>
        <GraphDriver room={a.room ?? ROOM} rows={5} cols={6} neighbors={a.neighbors} strategy={a.strategy} totalMs={a.totalMs} />
        <NeighborPanel initialView="graph" />
      </>
    );
  },
};

export const DiagonalScan: Story = {
  name: 'Diagonal scan — 2.5 neighbours (graph view)',
  args: { totalMs: 8000, neighbors: 2.5, strategy: 'all' } as any,
  render: (args) => {
    const a = args as any;
    return (
      <>
        <GraphDriver room={a.room ?? ROOM} rows={5} cols={6} neighbors={a.neighbors} strategy={a.strategy} totalMs={a.totalMs} />
        <NeighborPanel initialView="graph" />
      </>
    );
  },
};
