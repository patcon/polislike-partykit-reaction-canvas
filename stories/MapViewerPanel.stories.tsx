import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import React from 'react';
import MapViewerPanel from '../app/components/panels/MapViewerPanel';
import { PanelContextProvider } from '../app/context/PanelContext';
import { MapViewerConfigProvider } from '../app/context/PanelConfigs';
import type { MapViewerConfig, MapProjection } from '../app/types';
import { emitToRoom } from '../.storybook/mocks/partysocket-react';

// Seeded LCG so the blob is deterministic across renders
function makeSeededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function gaussianBlob(n: number, seed: number): MapProjection {
  const rand = makeSeededRand(seed);
  const boxMuller = () => {
    const u = Math.max(rand(), 1e-10);
    const v = rand();
    const mag = Math.sqrt(-2 * Math.log(u));
    return [mag * Math.cos(2 * Math.PI * v), mag * Math.sin(2 * Math.PI * v)] as [number, number];
  };
  const coords: [string, [number, number]][] = Array.from({ length: n }, (_, i) => [
    `user-${i + 1}`,
    boxMuller(),
  ]);
  return { algorithm: 'umap', computedAt: new Date('2025-01-01T12:00:00Z').toISOString(), coords };
}

const GAUSSIAN_PROJECTION = gaussianBlob(30, 42);

const DEFAULT_CONFIG: MapViewerConfig = { colorMode: 'none', momentId: null };

const meta = {
  title: 'Panels/MapViewerPanel',
  component: MapViewerPanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story, ctx) => (
      <div className="v2-app-container" style={{ height: '100vh' }}>
        <PanelContextProvider value={ctx.args as never}>
          <MapViewerConfigProvider value={{ config: (ctx.args as { config: MapViewerConfig }).config }}>
            <Story />
          </MapViewerConfigProvider>
        </PanelContextProvider>
      </div>
    ),
  ],
  args: {
    room: 'storybook',
    userId: 'user-1',
    inviteEdges: {},
    config: DEFAULT_CONFIG,
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoProjection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/No projection computed yet/)).toBeInTheDocument();
  },
};

export const WithGaussianBlob: Story = {
  play: async ({ canvasElement }) => {
    // defer emit until after usePartySocket's useEffect has subscribed
    await new Promise(r => requestAnimationFrame(r));
    emitToRoom('storybook', { type: 'connected', mapProjection: GAUSSIAN_PROJECTION, connectedUserIds: [], roomAnchors: null });
    const canvas = within(canvasElement);
    await expect(canvas.findByText(/UMAP/)).resolves.toBeInTheDocument();
  },
};
