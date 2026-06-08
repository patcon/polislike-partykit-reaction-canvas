import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React, { useEffect } from 'react';
import NeighborPanel from './component';
import { PanelContextProvider } from '../../app/context/PanelContext';
import { emitToRoom } from '../../.storybook/mocks/partysocket-react';

const ROOM = 'storybook-neighbor';

type Strategy = 'cardinal' | 'all' | 'front-right';

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
    neighbors: { name: 'avg neighbors connected', control: { type: 'number', min: 0, max: 8, step: 0.5 }, description: 'Neighbours per person — integer = exact count, fraction = probability of one more (e.g. 2.7 = always 2, 70% chance of 3)' },
    strategy:  { name: 'neighbor selection strategy', control: { type: 'select' }, options: ['cardinal', 'all', 'front-right'] as Strategy[], description: '"cardinal" picks randomly from up/down/left/right; "all" also includes diagonals; "front-right" prioritizes front then right, falls back randomly' },
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

function shuffle<T>(arr: T[]): T[] {
  return arr.sort(() => Math.random() - 0.5);
}

function getAdjacent(seat: Seat, seats: Seat[], strategy: Strategy): Seat[] {
  const { row, col, rows, cols } = seat;
  const at = (r: number, c: number) => (r >= 0 && r < rows && c >= 0 && c < cols) ? seats[r * cols + c] : null;

  if (strategy === 'front-right') {
    const priority = [at(row - 1, col), at(row, col + 1)].filter(Boolean) as Seat[];
    const rest = shuffle([at(row + 1, col), at(row, col - 1)].filter(Boolean) as Seat[]);
    return [...priority, ...rest];
  }

  const cardinal = [at(row - 1, col), at(row + 1, col), at(row, col - 1), at(row, col + 1)];
  const diagonals = strategy === 'all' ? [
    at(row - 1, col - 1), at(row - 1, col + 1), at(row + 1, col - 1), at(row + 1, col + 1),
  ] : [];
  return shuffle([...cardinal, ...diagonals].filter(Boolean) as Seat[]);
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
      const adjacent = getAdjacent(seat, seats, strategy);
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

export const FrontRightScan: Story = {
  name: 'Front-right priority — 2 neighbours (graph view)',
  args: { totalMs: 8000, neighbors: 2, strategy: 'front-right' } as any,
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
