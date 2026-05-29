import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState, useCallback, useRef, useEffect } from 'react';
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

interface UserPath {
  userId: string;
  events: RecordedEvent[];
}

// Distinct hues that avoid the reaction-zone colors (green/red/yellow)
const replayCursorColor = (i: number) => `hsl(${(210 + i * 137) % 360}, 70%, 65%)`;

export const Recorder: Story = {
  render: (args) => {
    const [isRecording, setIsRecording] = useState(false);
    const [completedPaths, setCompletedPaths] = useState<UserPath[]>([]);
    const [replayCursors, setReplayCursors] = useState<Array<{ x: number; y: number } | null>>([]);
    const [hovered, setHovered] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Use a ref for the in-progress buffer so the end-click handler reads current data
    const currentEventsRef = useRef<RecordedEvent[]>([]);
    // Display copy of currentEventsRef for rendering
    const [currentEventsDisplay, setCurrentEventsDisplay] = useState<RecordedEvent[]>([]);
    const startTimeRef = useRef<number | null>(null);
    const replayStartTimesRef = useRef<number[]>([]);
    const userCountRef = useRef(0);

    const handleCursorEvent = useCallback((type: CursorEventType, pos: { x: number; y: number }) => {
      if (startTimeRef.current === null) return;
      const event: RecordedEvent = {
        type,
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        t: Date.now() - startTimeRef.current,
      };
      currentEventsRef.current = [...currentEventsRef.current, event];
      setCurrentEventsDisplay(currentEventsRef.current);
    }, []);

    const handleCanvasClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;

      if (!isRecording) {
        // Start recording — reset ALL replay start times to now so every path starts at t=0
        const now = Date.now();
        replayStartTimesRef.current = Array.from({ length: userCountRef.current }, () => now);
        startTimeRef.current = now;
        currentEventsRef.current = [];
        setCurrentEventsDisplay([]);
        setIsRecording(true);
      } else {
        // End recording — append a remove event to close the stream
        const removeEvent: RecordedEvent = {
          type: 'remove', x: 0, y: 0,
          t: Date.now() - (startTimeRef.current ?? Date.now()),
        };
        const finalEvents = [...currentEventsRef.current, removeEvent];
        const newPath: UserPath = { userId: `user-${userCountRef.current + 1}`, events: finalEvents };

        userCountRef.current += 1;

        setCompletedPaths(prev => [...prev, newPath]);
        setReplayCursors([]);
        currentEventsRef.current = [];
        setCurrentEventsDisplay([]);
        startTimeRef.current = null;
        setIsRecording(false);
      }
    };

    // Animate replay cursors at ~20fps — while recording or previewing (mouse-out)
    useEffect(() => {
      if (completedPaths.length === 0 || (!isRecording && !isPreviewing)) return;
      const interval = setInterval(() => {
        const now = Date.now();
        setReplayCursors(completedPaths.map((path, i) => {
          const duration = path.events[path.events.length - 1].t;
          const elapsed = (now - replayStartTimesRef.current[i]) % (duration + 2000);
          let last: RecordedEvent | null = null;
          for (const e of path.events) {
            if (e.t <= elapsed) last = e;
            else break;
          }
          return (!last || last.type === 'remove') ? null : { x: last.x, y: last.y };
        }));
      }, 50);
      return () => clearInterval(interval);
    }, [completedPaths, isRecording, isPreviewing]);

    const handleMouseLeave = () => {
      if (isRecording || completedPaths.length === 0) return;
      const now = Date.now();
      replayStartTimesRef.current = completedPaths.map(() => now);
      setIsPreviewing(true);
    };

    const handleMouseEnter = () => {
      if (!isPreviewing) return;
      setIsPreviewing(false);
      setReplayCursors([]);
    };

    const handleClear = () => {
      setCompletedPaths([]);
      setReplayCursors([]);
      setCurrentEventsDisplay([]);
      setIsPreviewing(false);
      currentEventsRef.current = [];
      replayStartTimesRef.current = [];
      userCountRef.current = 0;
      startTimeRef.current = null;
      setIsRecording(false);
    };

    const handleCopy = () => {
      navigator.clipboard.writeText(JSON.stringify(completedPaths, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const nextUser = `user-${userCountRef.current + 1}`;
    const statusMsg = isRecording
      ? `Recording ${nextUser}… click to stop`
      : `Click to record ${nextUser}`;
    const totalEvents = completedPaths.reduce((s, p) => s + p.events.length, 0) + currentEventsDisplay.length;

    return (
      <div
        style={{ position: 'relative', width: '100%', height: '100vh' }}
        onClick={handleCanvasClick}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
      >
        <CanvasComposition {...args} onCursorEvent={isRecording ? handleCursorEvent : undefined} />

        {/* Replay cursor dots for completed paths */}
        {completedPaths.map((path, i) => {
          const cursor = replayCursors[i];
          if (!cursor) return null;
          return (
            <div key={path.userId} style={{
              position: 'absolute',
              left: `${cursor.x}%`,
              top: `${cursor.y}%`,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: replayCursorColor(i),
              border: '2px solid rgba(0,0,0,0.5)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 15,
            }} />
          );
        })}

        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(0,0,0,0.88)',
            color: '#ccc',
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '8px 12px',
            height: hovered ? '220px' : 'auto',
            overflowY: 'auto',
            zIndex: 100,
            borderTop: '1px solid #444',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: hovered ? '6px' : 0, alignItems: 'center' }}>
            <span style={{ flex: 1, color: isRecording ? '#f4a460' : '#888' }}>
              {statusMsg}{totalEvents > 0 ? ` · ${totalEvents} events` : ''}
            </span>
            <button style={btnStyle} onClick={(e) => { e.stopPropagation(); handleClear(); }}>Clear</button>
            <button style={{ ...btnStyle, color: copied ? '#7fc97f' : '#ccc' }} onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
          </div>
          {hovered && <pre style={{ margin: 0, overflowX: 'auto', color: '#aaa' }}>{JSON.stringify(completedPaths, null, 2)}</pre>}
        </div>
      </div>
    );
  },
};
