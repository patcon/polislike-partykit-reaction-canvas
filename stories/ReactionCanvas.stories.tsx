import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState, useCallback, useRef } from 'react';
import Canvas from '../app/components/shared/Canvas';
import TouchLayer from '../app/components/shared/TouchLayer';
import { REACTION_LABEL_PRESETS } from '../app/voteLabels';

type ReactionState = 'positive' | 'negative' | 'neutral' | null;
type CursorEventType = 'move' | 'touch' | 'remove';

interface RecordedEvent {
  type: CursorEventType;
  x: number;
  y: number;
  t: number; // ms offset from first event
}

interface CanvasCompositionProps {
  room: string;
  userId: string;
  labels?: { positive: string; negative: string; neutral: string };
  onCursorEvent?: (type: CursorEventType, pos: { x: number; y: number }) => void;
}

function LabelOverlay({ labels }: { labels: { positive: string; negative: string; neutral: string } }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    fontFamily: 'sans-serif',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    pointerEvents: 'none',
    zIndex: 20,
    color: '#fff',
    textShadow: '0 1px 4px rgba(0,0,0,0.7)',
    userSelect: 'none',
  };
  return (
    <>
      <div style={{ ...base, top: '5%', right: '5%' }}>{labels.positive}</div>
      <div style={{ ...base, bottom: '5%', left: '5%' }}>{labels.negative}</div>
      <div style={{ ...base, bottom: '5%', right: '5%' }}>{labels.neutral}</div>
    </>
  );
}

function CanvasComposition({ room, userId, labels, onCursorEvent }: CanvasCompositionProps) {
  const [reactionState, setReactionState] = useState<ReactionState>(null);
  const effectiveLabels = labels ?? REACTION_LABEL_PRESETS['default'];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#1a1a2e' }}>
      <LabelOverlay labels={effectiveLabels} />
      <Canvas
        room={room}
        userId={userId}
        currentReactionState={reactionState}
        heightOffset={0}
        colorCursorsByVote
      />
      <TouchLayer
        room={room}
        userId={userId}
        onActiveStatementChange={() => {}}
        onReactionStateChange={setReactionState}
        onBackgroundColorChange={() => {}}
        heightOffset={0}
        onCursorEvent={onCursorEvent}
      />
    </div>
  );
}

const meta = {
  title: 'Canvas/ReactionCanvas',
  component: CanvasComposition,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    room: 'storybook-canvas',
    userId: 'story-user-1',
    labels: REACTION_LABEL_PRESETS['default'],
  },
} satisfies Meta<typeof CanvasComposition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};

const btnStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: '11px',
  fontFamily: 'monospace',
  cursor: 'pointer',
  background: '#333',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: '3px',
};

export const Recorder: Story = {
  render: (args) => {
    const [events, setEvents] = useState<RecordedEvent[]>([]);
    const [copied, setCopied] = useState(false);
    const startTimeRef = useRef<number | null>(null);

    const handleCursorEvent = useCallback((type: CursorEventType, pos: { x: number; y: number }) => {
      const now = Date.now();
      if (startTimeRef.current === null) startTimeRef.current = now;
      const t = now - startTimeRef.current;
      setEvents(prev => [...prev, {
        type,
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        t,
      }]);
    }, []);

    const handleClear = () => {
      setEvents([]);
      startTimeRef.current = null;
    };

    const handleCopy = () => {
      const fixture = JSON.stringify({ userId: args.userId, events }, null, 2);
      navigator.clipboard.writeText(fixture);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const fixture = JSON.stringify({ userId: args.userId, events }, null, 2);

    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <CanvasComposition {...args} onCursorEvent={handleCursorEvent} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.88)',
          color: '#ccc',
          fontFamily: 'monospace',
          fontSize: '11px',
          padding: '8px 12px',
          height: '220px',
          overflowY: 'auto',
          zIndex: 100,
          borderTop: '1px solid #444',
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
            <span style={{ flex: 1, color: '#888' }}>{events.length} events recorded — move or touch the canvas above</span>
            <button style={btnStyle} onClick={handleClear}>Clear</button>
            <button style={{ ...btnStyle, color: copied ? '#7fc97f' : '#ccc' }} onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
          </div>
          <pre style={{ margin: 0, overflowX: 'auto', color: '#aaa' }}>{fixture}</pre>
        </div>
      </div>
    );
  },
};
