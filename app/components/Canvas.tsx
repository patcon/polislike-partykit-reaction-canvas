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
  readOnly?: boolean; // When true, connects as admin (excluded from presence count, no cursor sent)
  colorCursorsByVote?: boolean; // Optional prop to enable reaction-based coloring
  hideCursors?: boolean; // When true, other users' cursors are not rendered (labels/anchors still sync)
  currentReactionState?: ReactionState; // Current reaction state for background color
  heightOffset?: number; // Pixels to subtract from window.innerHeight (default: statement panel height)
  onPresenceCount?: (count: number) => void;
  onActiveCursorCountChange?: (count: number) => void;
  onSimulatedCursorCountChange?: (count: number) => void;
  onTimecodeUpdate?: (timecode: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
  onRoomLabelsChange?: (labels: { positive: string; negative: string; neutral: string } | null) => void;
  onRoomAnchorsChange?: (anchors: ReactionAnchors | null) => void;
  onViewerCount?: (count: number) => void;
  onConnectedAsViewer?: (isViewer: boolean, userCap: number | null) => void;
  onUserCapChanged?: (cap: number | null) => void;
  onJoinApproved?: () => void;
  onSocketReady?: (send: (msg: string) => void) => void;
  debug?: boolean;
  onRoomAvatarStyleChange?: (style: string | null) => void;
  onActivityTriggered?: (activityName: string) => void;
}

// Clip an infinite line (defined by two points) to the rectangle [0,w]×[0,h].
// Returns [x1,y1,x2,y2] pixel endpoints, or null if the line misses the rect.
function clipLineToRect(
  px: number, py: number, // a point on the line
  qx: number, qy: number, // another point on the line
  w: number, h: number
): [number, number, number, number] | null {
  const dx = qx - px, dy = qy - py;
  let tMin = -Infinity, tMax = Infinity;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) tMin = Math.max(tMin, t); else tMax = Math.min(tMax, t);
    return true;
  };
  if (!clip(-dx, px) || !clip(dx, w - px)) return null;
  if (!clip(-dy, py) || !clip(dy, h - py)) return null;
  if (tMin > tMax) return null;
  return [px + tMin * dx, py + tMin * dy, px + tMax * dx, py + tMax * dy];
}

export default function Canvas({ room, userId, readOnly = false, colorCursorsByVote = false, hideCursors = false, currentReactionState, heightOffset, onPresenceCount, onActiveCursorCountChange, onSimulatedCursorCountChange, onTimecodeUpdate, onRecordingStateChange, onRoomLabelsChange, onRoomAnchorsChange, onRoomAvatarStyleChange, onViewerCount, onConnectedAsViewer, onUserCapChanged, onJoinApproved, onSocketReady, onActivityTriggered, debug = false }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [anchors, setAnchors] = useState<ReactionAnchors>(DEFAULT_ANCHORS);
  const [avatarStyle, setAvatarStyle] = useState<string | null>(null);
  const [activity, setActivity] = useState<'canvas' | 'soccer'>('canvas');
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [soccerScore, setSoccerScore] = useState({ left: 0, right: 0 });

  useEffect(() => {
    onActiveCursorCountChange?.(cursors.size);
    const simulatedCount = Array.from(cursors.keys()).filter(id => id.startsWith('replay_')).length;
    onSimulatedCursorCountChange?.(simulatedCount);
  }, [cursors.size]);

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - (heightOffset ?? 140)
  });

  const socket = usePartySocket({
    host: window.location.port === '1999' ? `${window.location.hostname}:1999` : process.env.PARTYKIT_HOST,
    room: room,
    query: readOnly ? { isAdmin: 'true' } : { userId },
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'presenceCount') {
          onPresenceCount?.(data.count);
          onViewerCount?.(data.viewerCount ?? 0);
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
          if ('roomAvatarStyle' in data) {
            setAvatarStyle(data.roomAvatarStyle ?? null);
            onRoomAvatarStyleChange?.(data.roomAvatarStyle ?? null);
          }
          if ('currentActivity' in data) setActivity(data.currentActivity ?? 'canvas');
          if ('ballState' in data && data.ballState) setBallPos({ x: data.ballState.x, y: data.ballState.y });
          if ('soccerScore' in data && data.soccerScore) setSoccerScore(data.soccerScore);
          onConnectedAsViewer?.(data.isViewer ?? false, data.userCap ?? null);
          onViewerCount?.(data.viewerCount ?? 0);
          return;
        }

        if (data.type === 'userCapChanged') {
          onUserCapChanged?.(data.cap);
          return;
        }

        if (data.type === 'joinApproved') {
          onJoinApproved?.();
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

        if (data.type === 'roomAvatarStyleChanged') {
          setAvatarStyle(data.avatarStyle ?? null);
          onRoomAvatarStyleChange?.(data.avatarStyle ?? null);
          return;
        }

        if (data.type === 'activityChanged') {
          setActivity(data.activity ?? 'canvas');
          if (data.ball) setBallPos({ x: data.ball.x, y: data.ball.y });
          if (data.score) setSoccerScore(data.score);
          if (data.activity !== 'soccer') setBallPos(null);
          return;
        }

        if (data.type === 'activityTriggered') {
          onActivityTriggered?.(data.activityName);
          return;
        }

        if (data.type === 'ballUpdate') {
          setBallPos({ x: data.x, y: data.y });
          return;
        }

        if (data.type === 'goalScored') {
          setSoccerScore(data.score);
          return;
        }

        if (data.type === 'ballHidden') {
          setBallPos(null);
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

  // Expose socket.send to parent via onSocketReady
  useEffect(() => {
    onSocketReady?.((msg) => socket.send(msg));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Debug: draw region boundary lines and anchor markers
    if (debug) {
      const { positive: pos, negative: neg, neutral: neu } = anchors;
      const centroid = {
        x: (pos.x + neg.x + neu.x) / 3,
        y: (pos.y + neg.y + neu.y) / 3,
      };
      // Each boundary line passes through the centroid AND the midpoint of the
      // opposite edge — this is where two barycentric weights are equal.
      const edgeMidpoints = [
        { x: (pos.x + neg.x) / 2, y: (pos.y + neg.y) / 2 }, // pos–neg boundary
        { x: (pos.x + neu.x) / 2, y: (pos.y + neu.y) / 2 }, // pos–neu boundary
        { x: (neg.x + neu.x) / 2, y: (neg.y + neu.y) / 2 }, // neg–neu boundary
      ];
      const toX = (n: number) => (n / 100) * dimensions.width;
      const toY = (n: number) => (n / 100) * dimensions.height;
      const cG = { x: toX(centroid.x), y: toY(centroid.y) };

      edgeMidpoints.forEach(mid => {
        const line = clipLineToRect(
          toX(mid.x), toY(mid.y), cG.x, cG.y,
          dimensions.width, dimensions.height
        );
        if (!line) return;
        svg.append('line')
          .attr('x1', line[0]).attr('y1', line[1])
          .attr('x2', line[2]).attr('y2', line[3])
          .attr('stroke', 'rgba(128,128,128,0.6)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '6 4');
      });

      // Anchor markers
      [pos, neg, neu].forEach(anchor => {
        svg.append('circle')
          .attr('cx', toX(anchor.x)).attr('cy', toY(anchor.y))
          .attr('r', 5)
          .attr('fill', 'none')
          .attr('stroke', 'rgba(128,128,128,0.8)')
          .attr('stroke-width', 1.5);
      });
    }

    // ===== SOCCER FIELD RENDERING =====
    if (activity === 'soccer') {
      const W = dimensions.width;
      const H = dimensions.height;
      const goalTopPx = (33 / 100) * H;
      const goalBotPx = (67 / 100) * H;
      const goalDepthPx = 18; // pixel depth of goal boxes

      // Green pitch background
      svg.select('rect').attr('fill', 'rgba(34, 120, 40, 0.85)');

      // Centre line
      svg.append('line')
        .attr('x1', W / 2).attr('y1', 0).attr('x2', W / 2).attr('y2', H)
        .attr('stroke', 'rgba(255,255,255,0.5)').attr('stroke-width', 2).attr('stroke-dasharray', '8 6');

      // Centre circle
      const centreR = Math.min(W, H) * 0.12;
      svg.append('circle')
        .attr('cx', W / 2).attr('cy', H / 2).attr('r', centreR)
        .attr('fill', 'none').attr('stroke', 'rgba(255,255,255,0.4)').attr('stroke-width', 2);

      // Centre dot
      svg.append('circle')
        .attr('cx', W / 2).attr('cy', H / 2).attr('r', 4)
        .attr('fill', 'rgba(255,255,255,0.6)');

      // Left goal box
      svg.append('rect')
        .attr('x', 0).attr('y', goalTopPx)
        .attr('width', goalDepthPx).attr('height', goalBotPx - goalTopPx)
        .attr('fill', 'rgba(255,255,100,0.25)').attr('stroke', 'rgba(255,255,255,0.8)').attr('stroke-width', 2);

      // Right goal box
      svg.append('rect')
        .attr('x', W - goalDepthPx).attr('y', goalTopPx)
        .attr('width', goalDepthPx).attr('height', goalBotPx - goalTopPx)
        .attr('fill', 'rgba(255,255,100,0.25)').attr('stroke', 'rgba(255,255,255,0.8)').attr('stroke-width', 2);

      // Scores
      const scoreFontSize = Math.max(20, Math.min(W, H) * 0.06);
      svg.append('text')
        .attr('x', goalDepthPx + 10).attr('y', goalTopPx - 10)
        .attr('font-family', 'monospace').attr('font-size', scoreFontSize)
        .attr('fill', 'white').attr('font-weight', 'bold')
        .text(String(soccerScore.left));

      svg.append('text')
        .attr('x', W - goalDepthPx - 10).attr('y', goalTopPx - 10)
        .attr('text-anchor', 'end')
        .attr('font-family', 'monospace').attr('font-size', scoreFontSize)
        .attr('fill', 'white').attr('font-weight', 'bold')
        .text(String(soccerScore.right));

      // Ball
      if (ballPos) {
        const bx = (ballPos.x / 100) * W;
        const by = (ballPos.y / 100) * H;
        const br = Math.min(W, H) * 0.025;
        svg.append('circle')
          .attr('cx', bx).attr('cy', by).attr('r', br)
          .attr('fill', 'white').attr('stroke', '#222').attr('stroke-width', 2);
        // Simple pentagon pattern hint
        svg.append('circle')
          .attr('cx', bx).attr('cy', by).attr('r', br * 0.35)
          .attr('fill', '#333');
      }
    }

    // Add cursor positions as colored dots - convert normalized coordinates to pixels
    if (hideCursors) return;
    const cursorData = Array.from(cursors.entries()).map(([cursorUserId, cursor]) => ({
      cursorUserId,
      x: (cursor.x / 100) * dimensions.width, // Convert from 0-100 to pixel coordinates
      y: (cursor.y / 100) * dimensions.height, // Convert from 0-100 to pixel coordinates
      timestamp: cursor.timestamp,
      userId: cursor.userId,
      // Calculate reaction state on client side for coloring
      reactionState: colorCursorsByVote ? computeReactionRegion(cursor.x, cursor.y, anchors) : null
    }));

    // Add cursor circles with responsive radius
    const smallerDim = Math.min(dimensions.width, dimensions.height);
    const cursorRadius = avatarStyle
      ? smallerDim * 0.03  // 3% when showing avatars (needs to be recognizable)
      : smallerDim * 0.01; // 1% for default colored dots (original size)

    const isPlaybackCursor = (d: any): boolean => d.cursorUserId.startsWith('replay_');

    const cursorColor = (d: any): string => {
      if (isPlaybackCursor(d)) return 'hsl(270, 70%, 65%)';
      if (colorCursorsByVote && d.reactionState) {
        switch (d.reactionState) {
          case 'positive': return 'rgba(0, 255, 0, 0.8)';
          case 'negative': return 'rgba(255, 0, 0, 0.8)';
          case 'neutral': return 'rgba(255, 255, 0, 0.8)';
          default: return 'rgba(128, 128, 128, 0.8)';
        }
      }
      const hue = d.cursorUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 360;
      return `hsl(${hue}, 70%, 50%)`;
    };

    const cursorGroups = svg.selectAll('.cursor-group')
      .data(cursorData, (d: any) => d.cursorUserId)
      .enter()
      .append('g')
      .attr('class', 'cursor-group')
      .attr('opacity', (d: any) => isPlaybackCursor(d) ? 0.7 : 1.0);

    if (avatarStyle) {
      // Add clip paths to defs for circular avatar masking
      const defs = svg.append('defs');
      cursorData.forEach(d => {
        defs.append('clipPath')
          .attr('id', `avatar-clip-${d.cursorUserId}`)
          .append('circle')
          .attr('cx', d.x)
          .attr('cy', d.y)
          .attr('r', cursorRadius);
      });

      // Colored border ring
      cursorGroups.append('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', cursorRadius + 2)
        .attr('fill', cursorColor)
        .attr('stroke', '#000000')
        .attr('stroke-width', 1.5);

      // DiceBear avatar image clipped to circle
      const avatarSize = cursorRadius * 2;
      cursorGroups.append('image')
        .attr('href', (d: any) => `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${encodeURIComponent(d.cursorUserId)}`)
        .attr('x', (d: any) => d.x - cursorRadius)
        .attr('y', (d: any) => d.y - cursorRadius)
        .attr('width', avatarSize)
        .attr('height', avatarSize)
        .attr('clip-path', (d: any) => `url(#avatar-clip-${d.cursorUserId})`);
    } else {
      cursorGroups.append('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', cursorRadius)
        .attr('fill', cursorColor)
        .attr('stroke', (d: any) => isPlaybackCursor(d) ? 'hsl(270, 70%, 80%)' : '#000000')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', (d: any) => isPlaybackCursor(d) ? `${cursorRadius * 0.8} ${cursorRadius * 0.5}` : 'none');

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
    }

  }, [cursors, dimensions, anchors, debug, hideCursors, avatarStyle, activity, ballPos, soccerScore]);

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
