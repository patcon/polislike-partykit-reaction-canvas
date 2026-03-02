import { useRef, useEffect, useState } from "react";
import usePartySocket from "partysocket/react";
import * as d3 from "d3";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../utils/voteRegion";
import type { ReactionAnchors } from "../utils/voteRegion";

interface CursorPosition {
  x: number; // Normalized coordinates (0-100)
  y: number; // Normalized coordinates (0-100)
  timestamp: number;
  userId: string;
}

interface CursorEvent {
  type: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

interface CanvasProps {
  room: string;
  userId: string;
  colorCursorsByVote?: boolean; // Optional prop to enable reaction-based coloring
  currentReactionState?: ReactionState; // Current reaction state for background color
  heightOffset?: number; // Pixels to subtract from window.innerHeight (default: statement panel height)
  onPresenceCount?: (count: number) => void;
  onActiveCursorCountChange?: (count: number) => void;
  onTimecodeUpdate?: (timecode: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
  onRoomLabelsChange?: (labels: { positive: string; negative: string; neutral: string } | null) => void;
  onRoomAnchorsChange?: (anchors: ReactionAnchors | null) => void;
}

export default function Canvas({ room, userId, colorCursorsByVote = false, currentReactionState, heightOffset, onPresenceCount, onActiveCursorCountChange, onTimecodeUpdate, onRecordingStateChange, onRoomLabelsChange, onRoomAnchorsChange }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [anchors, setAnchors] = useState<ReactionAnchors>(DEFAULT_ANCHORS);

  useEffect(() => {
    onActiveCursorCountChange?.(cursors.size);
  }, [cursors.size]);

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - (heightOffset ?? 140)
  });

  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    query: { userId },
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'presenceCount') {
          onPresenceCount?.(data.count);
          return;
        }

        if (data.type === 'connected') {
          if (data.timecode !== undefined) onTimecodeUpdate?.(data.timecode);
          if (data.recordingState !== undefined) onRecordingStateChange?.(data.recordingState);
          if ('roomLabels' in data) onRoomLabelsChange?.(data.roomLabels);
          if ('roomAnchors' in data) {
            const incoming = data.roomAnchors ?? null;
            setAnchors(incoming ?? DEFAULT_ANCHORS);
            onRoomAnchorsChange?.(incoming);
          }
          return;
        }

        if (data.type === 'timecodeUpdate') {
          onTimecodeUpdate?.(data.timecode);
          return;
        }

        if (data.type === 'recordingStateChanged') {
          onRecordingStateChange?.(data.recording);
          return;
        }

        if (data.type === 'roomLabelsChanged') {
          onRoomLabelsChange?.(data.labels ?? null);
          return;
        }

        if (data.type === 'roomAnchorsChanged') {
          const incoming = data.anchors ?? null;
          setAnchors(incoming ?? DEFAULT_ANCHORS);
          onRoomAnchorsChange?.(incoming);
          return;
        }

        // Handle cursor events only
        if (data.position) {
          const event: CursorEvent = data;
          if (event && event.position && event.position.userId !== userId) {
            if (event.type === 'remove') {
              // Remove cursor when user leaves or touch ends
              setCursors(prev => {
                const newCursors = new Map(prev);
                newCursors.delete(event.position.userId);
                return newCursors;
              });
            } else {
              // Add or update cursor position
              setCursors(prev => {
                const newCursors = new Map(prev);
                newCursors.set(event.position.userId, event.position);
                return newCursors;
              });

              // Remove old cursor positions after 3 seconds of inactivity
              setTimeout(() => {
                setCursors(prev => {
                  const newCursors = new Map(prev);
                  const cursor = newCursors.get(event.position.userId);
                  if (cursor && cursor.timestamp === event.position.timestamp) {
                    newCursors.delete(event.position.userId);
                  }
                  return newCursors;
                });
              }, 3000);
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
  });

  // Update background color based on current reaction state
  const updateBackgroundColor = (reactionState: ReactionState) => {
    const svg = d3.select(svgRef.current);
    const backgroundRect = svg.select('rect');

    let backgroundColor = 'rgba(255, 255, 255, 0.1)';
    if (reactionState === 'positive') {
      backgroundColor = 'rgba(0, 255, 0, 0.2)';
    } else if (reactionState === 'negative') {
      backgroundColor = 'rgba(255, 0, 0, 0.2)';
    } else if (reactionState === 'neutral') {
      backgroundColor = 'rgba(255, 255, 0, 0.2)';
    }

    backgroundRect.attr('fill', backgroundColor);
  };

  // Update background color when currentReactionState changes
  useEffect(() => {
    updateBackgroundColor(currentReactionState || null);
  }, [currentReactionState]);

  // Render with D3 SVG
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Add background rectangle with default color
    svg.append('rect')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('fill', 'rgba(255, 255, 255, 0.1)'); // Default transparent white

    // Apply current reaction state color if any
    if (currentReactionState) {
      updateBackgroundColor(currentReactionState);
    }

    // Add cursor positions as colored dots - convert normalized coordinates to pixels
    const cursorData = Array.from(cursors.entries()).map(([cursorUserId, cursor]) => ({
      cursorUserId,
      x: (cursor.x / 100) * dimensions.width, // Convert from 0-100 to pixel coordinates
      y: (cursor.y / 100) * dimensions.height, // Convert from 0-100 to pixel coordinates
      timestamp: cursor.timestamp,
      userId: cursor.userId,
      // Calculate reaction state on client side for coloring
      reactionState: colorCursorsByVote ? computeReactionRegion(cursor.x, cursor.y, anchors) : null
    }));

    const cursorGroups = svg.selectAll('.cursor-group')
      .data(cursorData, (d: any) => d.cursorUserId)
      .enter()
      .append('g')
      .attr('class', 'cursor-group');

    // Add cursor circles with responsive radius
    const cursorRadius = Math.min(dimensions.width, dimensions.height) * 0.01; // 1% of smaller dimension
    cursorGroups.append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', cursorRadius)
      .attr('fill', (d: any) => {
        // Use region-based colors if enabled and reaction state is available (for ghost cursors)
        if (colorCursorsByVote && d.reactionState) {
          switch (d.reactionState) {
            case 'positive':
              return 'rgba(0, 255, 0, 0.8)';
            case 'negative':
              return 'rgba(255, 0, 0, 0.8)';
            case 'neutral':
              return 'rgba(255, 255, 0, 0.8)';
            default:
              return 'rgba(128, 128, 128, 0.8)';
          }
        }

        // Generate a consistent color for each user (for real user cursors or when reaction coloring is disabled)
        const hue = d.cursorUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 360;
        return `hsl(${hue}, 70%, 50%)`;
      })
      .attr('stroke', '#000000') // Black border
      .attr('stroke-width', 2); // 2px border width

    // Add user ID labels with responsive font size and positioning
    const cursorLabelFontSize = Math.min(dimensions.width, dimensions.height) * 0.015; // 1.5% of smaller dimension
    const labelOffset = Math.min(dimensions.width, dimensions.height) * 0.015; // Responsive offset
    cursorGroups.append('text')
      .attr('x', (d: any) => d.x + labelOffset)
      .attr('y', (d: any) => d.y - labelOffset * 0.5)
      .attr('font-family', 'sans-serif')
      .attr('font-size', `${cursorLabelFontSize}px`)
      .attr('fill', '#000')
      .text((d: any) => d.cursorUserId.substring(0, 6));

  }, [cursors, dimensions, anchors]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const offset = heightOffset ?? (window.innerWidth <= 768 ? 120 : 140);
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - offset
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, [heightOffset]);

  return (
    <svg
      ref={svgRef}
      width={dimensions.width}
      height={dimensions.height}
      style={{
        width: '100%',
        height: '100%',
        zIndex: 1, // Lower z-index for rendering layer
        pointerEvents: 'none' // Don't capture events, let TouchLayer handle them
      }}
    />
  );
}
