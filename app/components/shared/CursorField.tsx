import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../../utils/voteRegion";
import { makeImageCoordTransform } from "../../utils/imageCanvasCoords";
import { useRoomSocket, useMessageSubscription } from "../../contexts/RoomSocketContext";
import type { ReactionAnchors } from "../../utils/voteRegion";
import type { GreeterConfig } from "../../../plugins/greeter/types";

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
  userId: string;
  colorCursorsByVote?: boolean; // Optional prop to enable reaction-based coloring
  hideActualCursors?: boolean; // When true, raw cursor dots are not rendered (labels/anchors still sync; use when smooth cursors replace them)
  currentReactionState?: ReactionState; // Current reaction state for background color
  heightOffset?: number; // Pixels to subtract from window.innerHeight (default: statement panel height)
  autoSize?: boolean; // When true, size to the parent element (ResizeObserver) instead of the window. Used for embedding in constrained containers (e.g. demo phone frames). Ignores heightOffset.
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
  disableCursorValence?: boolean;
  disableBackgroundValence?: boolean;
  onRoomAvatarStyleChange?: (style: string | null) => void;
  onActivityTriggered?: (activityName: string) => void;
  onInterfacePushed?: (interfaceName: string) => void;
  onPushedInterfacesCleared?: () => void;
  onHapticPushed?: () => void;
  onRoomImageUrlChange?: (url: string) => void;
  onSocialConfigChange?: (config: { default: string; twitter: string; bluesky: string; mastodon: string; instagram: string } | null) => void;
  onGreeterConfigChange?: (config: GreeterConfig | null) => void;
  onConnected?: (initialInviteEdges?: Record<string, string>, currentActivity?: string) => void;
  onNowLabelChange?: (label: string) => void;
  onInviteEdges?: (edges: Record<string, string>) => void;
  onOwnValenceDisplayChange?: (mode: 'background' | 'labels' | 'none') => void;
  onValenceInputModeChange?: (mode: 'touch' | 'orientation-horizontal' | 'orientation-vertical') => void;
  onStrokeSegment?: (userId: string, strokeId: string, points: Array<{ x: number; y: number }>, isFinal: boolean) => void;
  onSignatureCleared?: (userId: string) => void;
  onConnectedUsers?: (ids: string[]) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
  cursorSmoothingConfig?: CursorSmoothingConfig;
}

interface CursorSmoothingConfig {
  stiffness: number;
  damping: number;
  mass: number;
  showSmoothCursor: boolean;
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

export default function CursorField({ userId, colorCursorsByVote: colorCursorsByVoteProp = false, disableCursorValence = false, disableBackgroundValence = false, hideActualCursors = false, currentReactionState, heightOffset, autoSize = false, onPresenceCount, onActiveCursorCountChange, onSimulatedCursorCountChange, onTimecodeUpdate, onRecordingStateChange, onRoomLabelsChange, onRoomAnchorsChange, onRoomAvatarStyleChange, onViewerCount, onConnectedAsViewer, onUserCapChanged, onJoinApproved, onSocketReady, onActivityTriggered, onInterfacePushed, onPushedInterfacesCleared, onHapticPushed, onRoomImageUrlChange, onSocialConfigChange, onGreeterConfigChange, onConnected, onNowLabelChange, onInviteEdges, onOwnValenceDisplayChange, onValenceInputModeChange, onStrokeSegment, onSignatureCleared, onConnectedUsers, onUserJoined, onUserLeft, debug = false, cursorSmoothingConfig }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const smoothCursorLayerRef = useRef<SVGSVGElement>(null);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [anchors, setAnchors] = useState<ReactionAnchors>(DEFAULT_ANCHORS);
  const [avatarStyle, setAvatarStyle] = useState<string | null>(null);
  const [customAvatars, setCustomAvatars] = useState<Record<string, string>>({}); // userId → photoUrl
  const [colorCursorsByVote, setColorCursorsByVote] = useState(colorCursorsByVoteProp);
  const [defaultCursorColor, setDefaultCursorColor] = useState('#d4d4d4');
  const [ownValenceDisplay, setOwnValenceDisplay] = useState<'background' | 'labels' | 'none'>('labels');
  const [screenPanel, setScreenPanel] = useState<string>('canvas');
  const [imageUrl, setImageUrl] = useState('');
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [soccerScore, setSoccerScore] = useState({ left: 0, right: 0 });
  const [nowLabel, setNowLabel] = useState('');

  useEffect(() => {
    onActiveCursorCountChange?.(cursors.size);
    const simulatedCount = Array.from(cursors.keys()).filter(id => id.startsWith('replay_')).length;
    onSimulatedCursorCountChange?.(simulatedCount);
  }, [cursors.size]);

  // Keep a ref-copy of cursors for the spring RAF loop (avoids RAF closure over stale state)
  const cursorTargetRef = useRef<Map<string, CursorPosition>>(new Map());
  useEffect(() => { cursorTargetRef.current = cursors; }, [cursors]);
  useEffect(() => { avatarStyleRef.current = avatarStyle; }, [avatarStyle]);
  useEffect(() => { customAvatarsRef.current = customAvatars; }, [customAvatars]);

  const smoothCursorStateRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const dimensionsRef = useRef({ width: window.innerWidth, height: window.innerHeight });
  const toScreenCoordsRef = useRef<(x: number, y: number) => { x: number; y: number }>(
    (x, y) => ({ x: (x / 100) * dimensionsRef.current.width, y: (y / 100) * dimensionsRef.current.height })
  );

  const smoothCursorStyleRef = useRef<Map<string, { color: string; radius: number; stroke: string; strokeDasharray: string; avatarUrl: string | null; needsClip: boolean }>>(new Map());
  const avatarStyleRef = useRef<string | null>(null);
  const customAvatarsRef = useRef<Record<string, string>>({});

  // Smooth cursor RAF loop — runs only when cursorSmoothingConfig is provided
  useEffect(() => {
    if (!cursorSmoothingConfig) {
      // Clear overlay when disabled
      if (smoothCursorLayerRef.current) d3.select(smoothCursorLayerRef.current).selectAll('*').remove();
      return;
    }
    let rafId: number;
    const tick = () => {
      const layer = smoothCursorLayerRef.current;
      if (!layer) { rafId = requestAnimationFrame(tick); return; }

      const { stiffness, damping, mass, showSmoothCursor } = cursorSmoothingConfig;
      const targets = cursorTargetRef.current;
      const state = smoothCursorStateRef.current;

      // Remove smooth cursor state for cursors that have left
      for (const id of state.keys()) {
        if (!targets.has(id)) state.delete(id);
      }

      // Step physics for each target cursor
      for (const [id, cursor] of targets) {
        const { x: tx, y: ty } = toScreenCoordsRef.current(cursor.x, cursor.y);
        let s = state.get(id);
        if (!s) {
          s = { x: tx, y: ty, vx: 0, vy: 0 };
          state.set(id, s);
        }
        const dx = tx - s.x;
        const dy = ty - s.y;
        s.vx = s.vx * damping + (dx * stiffness) / mass;
        s.vy = s.vy * damping + (dy * stiffness) / mass;
        s.x += s.vx;
        s.y += s.vy;
      }

      // D3 data join for enter/exit
      const layerSel = d3.select(layer);

      // Ensure defs element exists for clip paths
      let defs = layerSel.select<SVGDefsElement>('defs');
      if (defs.empty()) defs = layerSel.insert('defs', ':first-child');

      const data = [...state.entries()].map(([id, s]) => ({ id, x: s.x, y: s.y }));
      const groups = layerSel
        .selectAll<SVGGElement, { id: string; x: number; y: number }>('.smooth-cursor')
        .data(data, d => d.id);

      const entered = groups.enter()
        .append('g')
        .attr('class', 'smooth-cursor');
      entered.append('circle');
      entered.append('image').attr('class', 'sc-avatar').style('display', 'none');

      groups.exit<{ id: string; x: number; y: number }>().each(function(d) {
        const clipId = `sc-clip-${d.id.replace(/\W/g, '_')}`;
        defs.select(`#${clipId}`).remove();
      }).remove();

      // Update position and style for all smooth cursors
      layerSel.selectAll<SVGGElement, { id: string; x: number; y: number }>('.smooth-cursor')
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .each(function(d) {
          const style = smoothCursorStyleRef.current.get(d.id);
          if (!style) return;
          const g = d3.select(this);
          const clipId = `sc-clip-${d.id.replace(/\W/g, '_')}`;

          // Clip path only needed for custom photos; DiceBear uses ?radius=50 instead
          if (style.needsClip) {
            let clipPath = defs.select<SVGClipPathElement>(`#${clipId}`);
            if (clipPath.empty()) {
              clipPath = defs.append('clipPath').attr('id', clipId) as d3.Selection<SVGClipPathElement, unknown, null, undefined>;
              clipPath.append('circle');
            }
            clipPath.select('circle').attr('r', style.radius).attr('cx', 0).attr('cy', 0);
          } else {
            defs.select(`#${clipId}`).remove();
          }

          // Background/fallback circle
          g.select('circle')
            .attr('r', style.radius)
            .attr('fill', style.color)
            .attr('stroke', style.stroke)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', style.strokeDasharray);

          // Avatar image (shown only when avatarUrl is set)
          const avatarSize = style.radius * 2;
          const avatarSel = g.select('.sc-avatar');
          if (style.avatarUrl) {
            avatarSel
              .style('display', 'block')
              .attr('href', style.avatarUrl)
              .attr('x', -style.radius)
              .attr('y', -style.radius)
              .attr('width', avatarSize)
              .attr('height', avatarSize)
              .attr('clip-path', style.needsClip ? `url(#${clipId})` : null);
          } else {
            avatarSel.style('display', 'none');
          }
        });

      layer.style.visibility = showSmoothCursor ? 'visible' : 'hidden';

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [cursorSmoothingConfig]);

  useEffect(() => {
    if (!imageUrl) { setImageNaturalSize(null); return; }
    const img = new Image();
    img.onload = () => setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setImageNaturalSize(null);
    img.src = imageUrl;
  }, [imageUrl]);

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - (heightOffset ?? 140)
  });
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);
  useEffect(() => {
    const size = (screenPanel === 'image-canvas' && imageUrl) ? imageNaturalSize : null;
    toScreenCoordsRef.current = makeImageCoordTransform(dimensions, size);
  }, [screenPanel, imageUrl, imageNaturalSize, dimensions]);

  // Precompute per-cursor style (color + radius) so the RAF tick can read it without closure staleness.
  useEffect(() => {
    const smallerDim = Math.min(dimensions.width, dimensions.height);
    const radius = avatarStyle ? smallerDim * 0.03 : smallerDim * 0.01;
    const styleMap = new Map<string, { color: string; radius: number; stroke: string; strokeDasharray: string; avatarUrl: string | null; needsClip: boolean }>();
    for (const [cursorUserId, cursor] of cursors) {
      const isPlayback = cursorUserId.startsWith('replay_');
      let color: string;
      if (isPlayback) {
        color = 'hsl(270, 70%, 65%)';
      } else if (colorCursorsByVote && !disableCursorValence) {
        switch (computeReactionRegion(cursor.x, cursor.y, anchors)) {
          case 'positive': color = 'rgba(0, 255, 0, 0.8)'; break;
          case 'negative': color = 'rgba(255, 0, 0, 0.8)'; break;
          case 'neutral':  color = 'rgba(255, 255, 0, 0.8)'; break;
          default:         color = 'rgba(128, 128, 128, 0.8)';
        }
      } else if (!colorCursorsByVote || disableCursorValence) {
        color = defaultCursorColor;
      } else {
        const hue = cursorUserId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
        color = `hsl(${hue}, 70%, 50%)`;
      }
      const stroke = isPlayback ? 'hsl(270, 70%, 80%)' : '#000000';
      const strokeDasharray = isPlayback ? `${radius * 0.8} ${radius * 0.5}` : 'none';

      let avatarUrl: string | null = null;
      let needsClip = false;
      if (avatarStyle && !isPlayback) {
        const isCustomMode = avatarStyle === 'custom' || avatarStyle.startsWith('custom+');
        if (isCustomMode) {
          avatarUrl = customAvatars[cursorUserId] ?? null;
          if (avatarUrl) {
            needsClip = true; // custom photos are not self-clipping
          } else {
            const fallbackStyle = avatarStyle !== 'custom' ? avatarStyle.slice(7) : null;
            if (fallbackStyle) avatarUrl = `https://api.dicebear.com/9.x/${fallbackStyle}/svg?seed=${encodeURIComponent(cursorUserId)}&radius=50`;
          }
        } else {
          avatarUrl = `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${encodeURIComponent(cursorUserId)}&radius=50`;
        }
      }

      styleMap.set(cursorUserId, { color, radius, stroke, strokeDasharray, avatarUrl, needsClip });
    }
    smoothCursorStyleRef.current = styleMap;
  }, [cursors, dimensions, anchors, colorCursorsByVote, disableCursorValence, defaultCursorColor, avatarStyle, customAvatars]);

  const { send } = useRoomSocket();

  useMessageSubscription((evt) => {
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
          if ('customAvatars' in data && data.customAvatars) {
            setCustomAvatars(Object.fromEntries(Object.entries(data.customAvatars).map(([uid, v]: [string, any]) => [uid, v.photoUrl ?? v])));
          }
          if ('colorCursorsByVote' in data) setColorCursorsByVote(data.colorCursorsByVote as boolean ?? colorCursorsByVoteProp);
          if ('defaultCursorColor' in data && data.defaultCursorColor) setDefaultCursorColor(data.defaultCursorColor as string);
          if ('ownValenceDisplay' in data && data.ownValenceDisplay) {
            const mode = data.ownValenceDisplay as 'background' | 'labels' | 'none';
            setOwnValenceDisplay(mode);
            onOwnValenceDisplayChange?.(mode);
          }
          if ('valenceInputMode' in data && data.valenceInputMode) {
            onValenceInputModeChange?.(data.valenceInputMode as 'touch' | 'orientation-horizontal' | 'orientation-vertical');
          }
          if ('currentScreenPanel' in data) {
            const act = data.currentScreenPanel ?? 'canvas';
            setScreenPanel(act);
          }
          if ('roomImageUrl' in data) {
            const url = data.roomImageUrl ?? '';
            setImageUrl(url);
            onRoomImageUrlChange?.(url);
          }
          if ('nowLabel' in data) {
            const lbl = (data.nowLabel as string) ?? '';
            setNowLabel(lbl);
            onNowLabelChange?.(lbl);
          }
          if ('ballState' in data && data.ballState) setBallPos({ x: data.ballState.x, y: data.ballState.y });
          if ('soccerScore' in data && data.soccerScore) setSoccerScore(data.soccerScore);
          if ('roomSocialConfig' in data) onSocialConfigChange?.(data.roomSocialConfig ?? null);
          if ('connectedUserIds' in data) onConnectedUsers?.(data.connectedUserIds ?? []);
          onConnectedAsViewer?.(data.isViewer ?? false, data.userCap ?? null);
          onViewerCount?.(data.viewerCount ?? 0);
          onConnected?.(data.inviteEdges ?? undefined, 'currentScreenPanel' in data ? (data.currentScreenPanel ?? 'canvas') : undefined);
          return;
        }

        if (data.type === 'inviteEdges') {
          if (data.edges && Array.isArray(data.edges)) {
            const edgeMap: Record<string, string> = {};
            for (const [inviterId, inviteeId] of data.edges as Array<[string, string]>) {
              edgeMap[inviteeId] = inviterId;
            }
            onInviteEdges?.(edgeMap);
          }
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

        if (data.type === 'customAvatarsChanged') {
          setCustomAvatars(data.customAvatars ?? {});
          return;
        }

        if (data.type === 'colorCursorsByVoteChanged') {
          setColorCursorsByVote(data.colorCursorsByVote as boolean);
          return;
        }

        if (data.type === 'defaultCursorColorChanged') {
          setDefaultCursorColor(data.defaultCursorColor as string);
          return;
        }

        if (data.type === 'ownValenceDisplayChanged') {
          const mode = data.ownValenceDisplay as 'background' | 'labels' | 'none';
          setOwnValenceDisplay(mode);
          onOwnValenceDisplayChange?.(mode);
          return;
        }

        if (data.type === 'valenceInputModeChanged') {
          onValenceInputModeChange?.(data.valenceInputMode as 'touch' | 'orientation-horizontal' | 'orientation-vertical');
          return;
        }

        if (data.type === 'imageUrlChanged') {
          const url = data.url ?? '';
          setImageUrl(url);
          onRoomImageUrlChange?.(url);
          return;
        }

        if (data.type === 'nowLabelChanged') {
          const lbl = (data.label as string) ?? '';
          setNowLabel(lbl);
          onNowLabelChange?.(lbl);
          return;
        }

        if (data.type === 'screenPanelChanged') {
          const act = data.screenPanel ?? 'canvas';
          setScreenPanel(act);
          if (data.ball) setBallPos({ x: data.ball.x, y: data.ball.y });
          if (data.score) setSoccerScore(data.score);
          if (data.screenPanel !== 'soccer') setBallPos(null);
          return;
        }

        if (data.type === 'socialConfigChanged') {
          onSocialConfigChange?.(data.config ?? null);
          return;
        }

        if (data.type === 'greeterConfigChanged') {
          onGreeterConfigChange?.(data.config ?? null);
          return;
        }

        if (data.type === 'activityTriggered') {
          onActivityTriggered?.(data.activityName);
          return;
        }

        if (data.type === 'interfacePushed') {
          onInterfacePushed?.(data.interfaceName);
          return;
        }

        if (data.type === 'pushedInterfacesCleared') {
          onPushedInterfacesCleared?.();
          return;
        }

        if (data.type === 'hapticPushed') {
          onHapticPushed?.();
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

        if (data.type === 'strokeSegment') {
          onStrokeSegment?.(data.userId, data.strokeId, data.points, data.isFinal);
          return;
        }

        if (data.type === 'signatureCleared') {
          onSignatureCleared?.(data.userId);
          return;
        }

        if (data.type === 'userJoined') {
          onUserJoined?.(data.userId);
          return;
        }

        if (data.type === 'userLeft') {
          onUserLeft?.(data.userId);
          return;
        }

        // Handle batched cursor events from perf-server
        if (data.type === 'cursorBatch' && Array.isArray(data.cursors)) {
          const events: CursorEvent[] = data.cursors;
          setCursors(prev => {
            const newCursors = new Map(prev);
            for (const event of events) {
              if (!event.position || event.position.userId === userId) continue;
              if (event.type === 'remove') {
                newCursors.delete(event.position.userId);
              } else {
                newCursors.set(event.position.userId, event.position);
              }
            }
            return newCursors;
          });
          for (const event of events) {
            if (event.type !== 'remove' && event.position && event.position.userId !== userId) {
              const { userId: cursorUserId, timestamp } = event.position;
              setTimeout(() => {
                setCursors(prev => {
                  const newCursors = new Map(prev);
                  const cursor = newCursors.get(cursorUserId);
                  if (cursor && cursor.timestamp === timestamp) newCursors.delete(cursorUserId);
                  return newCursors;
                });
              }, 3000);
            }
          }
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
  });

  // Expose send to parent via onSocketReady
  useEffect(() => {
    onSocketReady?.(send);
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
    const suppressed = disableBackgroundValence || ownValenceDisplay !== 'background';
    updateBackgroundColor(suppressed ? null : (currentReactionState || null));
  }, [currentReactionState, disableBackgroundValence, ownValenceDisplay]);

  // Render with D3 SVG
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Add background rectangle with default color (transparent in image-canvas mode)
    svg.append('rect')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('fill', imageUrl ? 'transparent' : 'rgba(255, 255, 255, 0.1)');

    // Apply current reaction state color if any (skip in image-canvas mode or when disabled)
    if (currentReactionState && !imageUrl && !disableBackgroundValence && ownValenceDisplay === 'background') {
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
    if (screenPanel === 'soccer') {
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
    if (hideActualCursors) return;

    // When an image is active, map image-relative 0-100 coords to screen pixels
    const imgSize = (screenPanel === 'image-canvas' && imageUrl) ? imageNaturalSize : null;
    const toScreenCoords = makeImageCoordTransform(dimensions, imgSize);
    const toScreenX = (n: number) => toScreenCoords(n, 0).x;
    const toScreenY = (n: number) => toScreenCoords(0, n).y;

    const cursorData = Array.from(cursors.entries()).map(([cursorUserId, cursor]) => ({
      cursorUserId,
      x: toScreenX(cursor.x),
      y: toScreenY(cursor.y),
      timestamp: cursor.timestamp,
      userId: cursor.userId,
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
      if (colorCursorsByVote && !disableCursorValence && d.reactionState) {
        switch (d.reactionState) {
          case 'positive': return 'rgba(0, 255, 0, 0.8)';
          case 'negative': return 'rgba(255, 0, 0, 0.8)';
          case 'neutral': return 'rgba(255, 255, 0, 0.8)';
          default: return 'rgba(128, 128, 128, 0.8)';
        }
      }
      if (!colorCursorsByVote || disableCursorValence) return defaultCursorColor;
      const hue = d.cursorUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 360;
      return `hsl(${hue}, 70%, 50%)`;
    };

    const cursorGroups = svg.selectAll('.cursor-group')
      .data(cursorData, (d: any) => d.cursorUserId)
      .enter()
      .append('g')
      .attr('class', 'cursor-group')
      .attr('opacity', (d: any) => isPlaybackCursor(d) ? 0.7 : 1.0);

    const isCustomMode = avatarStyle === 'custom' || (typeof avatarStyle === 'string' && avatarStyle.startsWith('custom+'));
    const customFallbackStyle = isCustomMode && avatarStyle !== 'custom' ? avatarStyle!.slice(7) : null;

    if (isCustomMode) {
      const defs = svg.append('defs');
      // Clip paths for users with custom photos
      cursorData.filter(d => customAvatars[d.cursorUserId]).forEach(d => {
        defs.append('clipPath')
          .attr('id', `avatar-clip-${d.cursorUserId}`)
          .append('circle')
          .attr('cx', d.x)
          .attr('cy', d.y)
          .attr('r', cursorRadius);
      });
      // Clip paths for fallback DiceBear (users without custom photos, when a base style is set)
      const avatarSize = cursorRadius * 2;
      const noPhotoGroups = cursorGroups.filter((d: any) => !customAvatars[d.cursorUserId]);
      const photoGroups = cursorGroups.filter((d: any) => !!customAvatars[d.cursorUserId]);

      if (customFallbackStyle) {
        // DiceBear fallback for unregistered users — ?radius=50 makes it circular natively
        noPhotoGroups.append('circle')
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y)
          .attr('r', cursorRadius + 2)
          .attr('fill', cursorColor)
          .attr('stroke', '#000000')
          .attr('stroke-width', 1.5);

        noPhotoGroups.append('image')
          .attr('href', (d: any) => `https://api.dicebear.com/9.x/${customFallbackStyle}/svg?seed=${encodeURIComponent(d.cursorUserId)}&radius=50`)
          .attr('x', (d: any) => d.x - cursorRadius)
          .attr('y', (d: any) => d.y - cursorRadius)
          .attr('width', avatarSize)
          .attr('height', avatarSize);
      } else {
        // Dot fallback for unregistered users
        noPhotoGroups.append('circle')
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y)
          .attr('r', cursorRadius)
          .attr('fill', cursorColor)
          .attr('stroke', (d: any) => isPlaybackCursor(d) ? 'hsl(270, 70%, 80%)' : '#000000')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', (d: any) => isPlaybackCursor(d) ? `${cursorRadius * 0.8} ${cursorRadius * 0.5}` : 'none');
      }

      // Custom photo for users with a registered avatar
      photoGroups.append('circle')
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)
        .attr('r', cursorRadius + 2)
        .attr('fill', cursorColor)
        .attr('stroke', '#000000')
        .attr('stroke-width', 1.5);

      photoGroups.append('image')
        .attr('href', (d: any) => customAvatars[d.cursorUserId])
        .attr('x', (d: any) => d.x - cursorRadius)
        .attr('y', (d: any) => d.y - cursorRadius)
        .attr('width', avatarSize)
        .attr('height', avatarSize)
        .attr('clip-path', (d: any) => `url(#avatar-clip-${d.cursorUserId})`);
    } else if (avatarStyle) {
      // Colored border ring
      cursorGroups.append('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', cursorRadius + 2)
        .attr('fill', cursorColor)
        .attr('stroke', '#000000')
        .attr('stroke-width', 1.5);

      // DiceBear avatar — ?radius=50 makes it circular natively, no clip path needed
      const avatarSize = cursorRadius * 2;
      cursorGroups.append('image')
        .attr('href', (d: any) => `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${encodeURIComponent(d.cursorUserId)}&radius=50`)
        .attr('x', (d: any) => d.x - cursorRadius)
        .attr('y', (d: any) => d.y - cursorRadius)
        .attr('width', avatarSize)
        .attr('height', avatarSize);
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

  }, [cursors, dimensions, anchors, debug, hideActualCursors, avatarStyle, customAvatars, colorCursorsByVote, defaultCursorColor, ownValenceDisplay, screenPanel, ballPos, soccerScore, imageUrl, imageNaturalSize]);

  // Handle resize. In autoSize mode, track the parent element's box (for embedding in
  // constrained containers like the demo phone frames); otherwise track the window.
  useEffect(() => {
    if (autoSize) {
      const parent = svgRef.current?.parentElement;
      if (!parent) return;
      const measure = () => {
        setDimensions({ width: parent.clientWidth, height: parent.clientHeight });
      };
      const observer = new ResizeObserver(measure);
      observer.observe(parent);
      measure(); // Initial call
      return () => observer.disconnect();
    }

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
  }, [heightOffset, autoSize]);

  return (
    <>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />
      <svg
        ref={smoothCursorLayerRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
      />
    </>
  );
}
