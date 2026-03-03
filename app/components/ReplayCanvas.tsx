import { useMemo, useState, useEffect } from 'react';
import type { ReactionEvent } from '../lib/supabase';

interface ReplayCanvasProps {
  events: ReactionEvent[];
  currentTimecode: number;
  heightOffset: number;
}

export default function ReplayCanvas({ events, currentTimecode, heightOffset }: ReplayCanvasProps) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - heightOffset,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight - heightOffset });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [heightOffset]);

  const { width, height } = dimensions;

  const dots = useMemo(() => {
    // Group events by session_id
    const bySession = new Map<string, ReactionEvent[]>();
    for (const evt of events) {
      const arr = bySession.get(evt.session_id) ?? [];
      arr.push(evt);
      bySession.set(evt.session_id, arr);
    }

    const result: Array<{ x: number; y: number; opacity: number; key: string }> = [];

    for (const [sessionId, sessionEvents] of bySession) {
      // Sort by timecode
      const sorted = [...sessionEvents].sort((a, b) => a.timecode - b.timecode);

      // Find prevEvent (latest event with timecode <= currentTimecode)
      let prevIdx = -1;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].timecode <= currentTimecode) {
          prevIdx = i;
          break;
        }
      }

      if (prevIdx < 0) continue;
      const prevEvent = sorted[prevIdx];

      const staleness = currentTimecode - prevEvent.timecode;
      if (staleness > 0.5 || prevEvent.type === 'lift') continue;

      const nextEvent = prevIdx < sorted.length - 1 ? sorted[prevIdx + 1] : null;

      let x = prevEvent.x ?? 0;
      let y = prevEvent.y ?? 0;

      // Lerp to next event if available
      if (
        nextEvent &&
        nextEvent.x !== null && nextEvent.y !== null &&
        prevEvent.x !== null && prevEvent.y !== null
      ) {
        const span = nextEvent.timecode - prevEvent.timecode;
        if (span > 0) {
          const t = Math.min((currentTimecode - prevEvent.timecode) / span, 1);
          x = prevEvent.x + (nextEvent.x - prevEvent.x) * t;
          y = prevEvent.y + (nextEvent.y - prevEvent.y) * t;
        }
      }

      // Fade opacity from 1.0 → 0 between 0.25s and 0.5s of staleness
      let opacity = 1.0;
      if (staleness > 0.25) {
        opacity = 1.0 - (staleness - 0.25) / 0.25;
      }

      result.push({
        x: (x / 100) * width,
        y: (y / 100) * height,
        opacity,
        key: sessionId,
      });
    }

    return result;
  }, [events, currentTimecode, width, height]);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
      width={width}
      height={height}
    >
      {dots.map(dot => (
        <circle
          key={dot.key}
          cx={dot.x}
          cy={dot.y}
          r={8}
          fill={`rgba(128, 64, 255, ${(dot.opacity * 0.75).toFixed(3)})`}
          stroke={`rgba(128, 64, 255, ${dot.opacity.toFixed(3)})`}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
