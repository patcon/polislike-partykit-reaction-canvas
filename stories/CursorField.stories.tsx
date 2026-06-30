import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import CursorField from '../app/components/shared/CursorField';
import { RoomSocketProvider } from '../app/contexts/RoomSocketContext';
import { emitToRoom } from '../.storybook/mocks/partysocket-react';

// Canvas uses RoomSocketContext for its WebSocket connection (mocked in Storybook).
// Socket-driven states are exercised via emitToRoom() in play functions, which feeds
// messages through the same socketMessageBus the real server uses.

const meta = {
  title: 'App/CursorField',
  component: CursorField,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  argTypes: {
    currentReactionState: {
      control: 'select',
      options: ['positive', 'negative', 'neutral'],
    },
  },
  decorators: [
    (Story) => (
      <RoomSocketProvider room="storybook" userId="story-user">
        <Story />
      </RoomSocketProvider>
    ),
  ],
} satisfies Meta<typeof CursorField>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  userId: 'story-user',
  colorCursorsByVote: true,
};

// No reaction selected — neutral transparent background.
export const Default: Story = {
  args: { ...baseArgs },
};

// Cursor is in the POSITIVE region — green background tint.
export const PositiveBackground: Story = {
  args: { ...baseArgs, currentReactionState: 'positive' },
  play: async () => {
    emitToRoom('storybook', { type: 'ownValenceDisplayChanged', ownValenceDisplay: 'background' });
  },
};

// Cursor is in the NEGATIVE region — red background tint.
export const NegativeBackground: Story = {
  args: { ...baseArgs, currentReactionState: 'negative' },
  play: async () => {
    emitToRoom('storybook', { type: 'ownValenceDisplayChanged', ownValenceDisplay: 'background' });
  },
};

// Cursor is in the NEUTRAL region — yellow background tint.
export const NeutralBackground: Story = {
  args: { ...baseArgs, currentReactionState: 'neutral' },
  play: async () => {
    emitToRoom('storybook', { type: 'ownValenceDisplayChanged', ownValenceDisplay: 'background' });
  },
};

// Multiple cursors scattered across the canvas, coloured by reaction region.
export const CursorBatchColored: Story = {
  args: { ...baseArgs, colorCursorsByVote: true },
  play: async () => {
    emitToRoom('storybook', {
      type: 'cursorBatch',
      cursors: [
        { type: 'move', position: { userId: 'user-a', x: 80, y: 10,  timestamp: Date.now() } },
        { type: 'move', position: { userId: 'user-b', x: 10, y: 80,  timestamp: Date.now() } },
        { type: 'move', position: { userId: 'user-c', x: 85, y: 85,  timestamp: Date.now() } },
        { type: 'move', position: { userId: 'user-d', x: 50, y: 50,  timestamp: Date.now() } },
        { type: 'move', position: { userId: 'user-e', x: 30, y: 30,  timestamp: Date.now() } },
      ],
    });
  },
};

// Custom anchor positions — horizontal layout with NEGATIVE on the left,
// POSITIVE on the right, NEUTRAL at the top centre.
export const CustomAnchors: Story = {
  args: { ...baseArgs, debug: true },
  play: async () => {
    emitToRoom('storybook', {
      type: 'roomAnchorsChanged',
      anchors: {
        negative: { x: 5,  y: 50 },
        positive: { x: 95, y: 50 },
        neutral:  { x: 50, y: 5  },
      },
    });
  },
};

// Custom labels and image-canvas mode live in ReactionCanvas.stories.tsx — Canvas alone
// does not render labels (fired via onRoomLabelsChange callback to parent) or the background
// image (rendered by the ImageCanvasBackground plugin component outside Canvas).

// Soccer activity mode — shows the pitch and hides the reaction regions.
export const SoccerActivity: Story = {
  args: { ...baseArgs },
  play: async () => {
    emitToRoom('storybook', { type: 'screenPanelChanged', screenPanel: 'soccer' });
  },
};

// Debug overlay — draws region boundary lines and anchor markers.
export const DebugOverlay: Story = {
  args: { ...baseArgs, debug: true },
};

// Cursor coloring disabled — all cursors render in the default colour regardless of region.
export const CursorBatchUncolored: Story = {
  args: { ...baseArgs, colorCursorsByVote: false },
  play: async () => {
    emitToRoom('storybook', {
      type: 'cursorBatch',
      cursors: [
        { type: 'move', position: { userId: 'user-a', x: 80, y: 10,  timestamp: Date.now() } },
        { type: 'move', position: { userId: 'user-b', x: 10, y: 80,  timestamp: Date.now() } },
        { type: 'move', position: { userId: 'user-c', x: 85, y: 85,  timestamp: Date.now() } },
        { type: 'move', position: { userId: 'user-d', x: 50, y: 50,  timestamp: Date.now() } },
      ],
    });
  },
};
