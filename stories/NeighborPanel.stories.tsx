import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React, { useEffect } from 'react';
import NeighborPanel from '../app/components/panels/NeighborPanel';
import { PanelContextProvider } from '../app/context/PanelContext';
import { emitToRoom } from '../.storybook/mocks/partysocket-react';

const ROOM = 'storybook-neighbor';

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

function generateGrid(rows: number, cols: number) {
  return Array.from({ length: rows * cols }, (_, i) => ({
    userId: `user-${Math.floor(i / cols)}-${i % cols}`,
    code: makeCode(i + 1),
    row: Math.floor(i / cols),
    col: i % cols,
    rows,
    cols,
  }));
}

// Ease-in-out cubic
function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easedDelay(index: number, total: number, totalMs: number) {
  const t = index / Math.max(total - 1, 1);
  return easeInOut(t) * totalMs;
}

// ===== 2-neighbour driver =====
function TwoNeighbourDriver({ room, rows, cols }: { room: string; rows: number; cols: number }) {
  useEffect(() => {
    const seats = generateGrid(rows, cols);
    const allCodes = Object.fromEntries(seats.map(s => [s.userId, s.code]));

    const edges: Array<{ userA: string; userB: string }> = [];
    const edgeSet = new Set<string>();

    for (const seat of seats) {
      const candidates: Array<{ userId: string }> = [];
      // left or right (one of them, random)
      const lr = [
        seat.col > 0 ? seats[seat.row * cols + seat.col - 1] : null,
        seat.col < cols - 1 ? seats[seat.row * cols + seat.col + 1] : null,
      ].filter(Boolean) as typeof seats;
      if (lr.length) candidates.push(lr[Math.floor(Math.random() * lr.length)]);
      // front or back (one of them, random)
      const fb = [
        seat.row > 0 ? seats[(seat.row - 1) * cols + seat.col] : null,
        seat.row < rows - 1 ? seats[(seat.row + 1) * cols + seat.col] : null,
      ].filter(Boolean) as typeof seats;
      if (fb.length) candidates.push(fb[Math.floor(Math.random() * fb.length)]);

      for (const target of candidates) {
        const key = [seat.userId, target.userId].sort().join('|');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          const [userA, userB] = key.split('|');
          edges.push({ userA, userB });
        }
      }
    }

    const TOTAL_MS = 8000;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const raf = requestAnimationFrame(() => {
      emitToRoom(room, { type: 'connected', myNeighborCode: '0001' });
      emitToRoom(room, { type: 'neighborEdgesSnapshot', edges: [], allCodes });

      edges.forEach((edge, i) => {
        const delay = easedDelay(i, edges.length, TOTAL_MS) + Math.random() * 200;
        timers.push(setTimeout(() => {
          emitToRoom(room, { type: 'neighborEdgeAdded', userA: edge.userA, userB: edge.userB });
        }, delay));
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [room, rows, cols]);
  return null;
}

// ===== 3-neighbour driver =====
function ThreeNeighbourDriver({ room, rows, cols }: { room: string; rows: number; cols: number }) {
  useEffect(() => {
    const seats = generateGrid(rows, cols);
    const allCodes = Object.fromEntries(seats.map(s => [s.userId, s.code]));

    const edges: Array<{ userA: string; userB: string }> = [];
    const edgeSet = new Set<string>();

    for (const seat of seats) {
      const allAdjacent = [
        // cardinal
        seat.col > 0 ? seats[seat.row * cols + seat.col - 1] : null,
        seat.col < cols - 1 ? seats[seat.row * cols + seat.col + 1] : null,
        seat.row > 0 ? seats[(seat.row - 1) * cols + seat.col] : null,
        seat.row < rows - 1 ? seats[(seat.row + 1) * cols + seat.col] : null,
        // diagonals
        seat.row > 0 && seat.col > 0 ? seats[(seat.row - 1) * cols + seat.col - 1] : null,
        seat.row > 0 && seat.col < cols - 1 ? seats[(seat.row - 1) * cols + seat.col + 1] : null,
        seat.row < rows - 1 && seat.col > 0 ? seats[(seat.row + 1) * cols + seat.col - 1] : null,
        seat.row < rows - 1 && seat.col < cols - 1 ? seats[(seat.row + 1) * cols + seat.col + 1] : null,
      ].filter(Boolean) as typeof seats;

      // shuffle and take up to 3
      const shuffled = allAdjacent.sort(() => Math.random() - 0.5).slice(0, 3);
      for (const target of shuffled) {
        const key = [seat.userId, target.userId].sort().join('|');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          const [userA, userB] = key.split('|');
          edges.push({ userA, userB });
        }
      }
    }

    const TOTAL_MS = 8000;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const raf = requestAnimationFrame(() => {
      emitToRoom(room, { type: 'connected', myNeighborCode: '0001' });
      emitToRoom(room, { type: 'neighborEdgesSnapshot', edges: [], allCodes });

      edges.forEach((edge, i) => {
        const delay = easedDelay(i, edges.length, TOTAL_MS) + Math.random() * 200;
        timers.push(setTimeout(() => {
          emitToRoom(room, { type: 'neighborEdgeAdded', userA: edge.userA, userB: edge.userB });
        }, delay));
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [room, rows, cols]);
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

export const TwoNeighbourScan: Story = {
  name: '2-neighbour scan (graph view)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <TwoNeighbourDriver room={room} rows={5} cols={6} />
        <NeighborPanel initialView="graph" />
      </>
    );
  },
};

export const ThreeNeighbourScan: Story = {
  name: '3-neighbour scan (graph view)',
  render: (args) => {
    const room = (args as any).room ?? ROOM;
    return (
      <>
        <ThreeNeighbourDriver room={room} rows={5} cols={6} />
        <NeighborPanel initialView="graph" />
      </>
    );
  },
};
