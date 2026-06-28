import { useState, useEffect, useRef } from 'react';
import { useMessageSubscription } from '../../app/contexts/RoomSocketContext';
import * as d3 from 'd3';
import { expandCursorEvents } from '../../app/utils/cursor';
import { usePanelContext } from '../../app/context/PanelContext';
import { useMapViewerConfig } from './useMapViewerConfig';
import { idbGet } from '../../app/utils/idbStorage';
import { computeReactionRegion, DEFAULT_ANCHORS } from '../../app/utils/voteRegion';
import type { ReactionAnchors } from '../../app/utils/voteRegion';
import type { MapProjection, MapViewerConfig } from '../../app/types';
import type { MomentSnapshot } from '../../app/components/panels/AdminPanelNoDB/types';
import { VOTE_COLORS, USER_STATUS_COLORS, USER_STATUS_LABELS, MISSING_COLOR } from '../../app/constants/userStatus';

const DEFAULT_COLOR = '#4a8';


function ScatterPlot({ data, selfId, colorById, flipX, flipY }: { data: [string, [number, number]][]; selfId: string; colorById?: Record<string, string>; flipX?: boolean; flipY?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    const g = d3.select(gRef.current!);
    const { width, height } = svgRef.current!.getBoundingClientRect();

    const xs = data.map(([, [x]]) => x);
    const ys = data.map(([, [, y]]) => y);
    const xRange: [number, number] = flipX ? [width - 20, 20] : [20, width - 20];
    const yRange: [number, number] = flipY ? [height - 20, 20] : [20, height - 20];
    const xScale = d3.scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range(xRange);
    const yScale = d3.scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).range(yRange);

    const TRANSITION_MS = 400;

    const others = data
      .filter(([id]) => id !== selfId)
      .sort(([a], [b]) => {
        const priority = (id: string) => {
          const c = colorById?.[id];
          if (!c || c === USER_STATUS_COLORS.offline) return 0;
          if (c === USER_STATUS_COLORS.idle) return 1;
          return 2;
        };
        return priority(a) - priority(b);
      });
    const self = data.find(([id]) => id === selfId);

    const peerColor = ([id]: [string, [number, number]]) =>
      colorById ? (colorById[id] ?? MISSING_COLOR) : DEFAULT_COLOR;
    const peerStroke = (d: [string, [number, number]]) => {
      const c = peerColor(d);
      return d3.color(c)?.darker(0.5)?.toString() ?? c;
    };

    g.selectAll<SVGCircleElement, [string, [number, number]]>('circle.peer')
      .data(others, ([id]) => id)
      .join(
        enter => enter.append('circle')
          .attr('class', 'peer')
          .attr('cx', ([, [x]]) => xScale(x))
          .attr('cy', ([, [, y]]) => yScale(y))
          .attr('r', 5)
          .attr('fill', peerColor)
          .attr('fill-opacity', 0.7)
          .attr('stroke', peerStroke)
          .attr('stroke-width', 0.5),
        update => {
          update
            .attr('fill', peerColor)
            .attr('stroke', peerStroke);
          update.transition().duration(TRANSITION_MS)
            .attr('cx', ([, [x]]) => xScale(x))
            .attr('cy', ([, [, y]]) => yScale(y));
          return update;
        }
      );

    // GPS dot: pulsing halo + solid blue dot
    if (self) {
      const [, [sx, sy]] = self;
      const cx = xScale(sx);
      const cy = yScale(sy);

      const halo = g.selectAll('circle.self-halo').data([null]);
      halo.enter().append('circle')
        .attr('class', 'self-halo')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 12)
        .attr('fill', '#4a90e2')
        .attr('fill-opacity', 0.2)
        .attr('stroke', 'none');
      halo.transition().duration(TRANSITION_MS).attr('cx', cx).attr('cy', cy);

      const ring = g.selectAll('circle.self-ring').data([null]);
      ring.enter().append('circle')
        .attr('class', 'self-ring')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
      ring.transition().duration(TRANSITION_MS).attr('cx', cx).attr('cy', cy);

      const dot = g.selectAll('circle.self-dot').data([null]);
      dot.enter().append('circle')
        .attr('class', 'self-dot')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 6)
        .attr('fill', '#4a90e2')
        .attr('stroke', 'none');
      dot.transition().duration(TRANSITION_MS).attr('cx', cx).attr('cy', cy);
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    return () => { svg.on('.zoom', null); };
  }, [data, selfId, colorById, flipX, flipY]);

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%', display: 'block', background: '#0e1a12', cursor: 'grab' }}
    >
      <g ref={gRef} />
    </svg>
  );
}

type HistoryEntry = { projection: MapProjection; flipX: boolean; flipY: boolean };
type ProjState = { history: HistoryEntry[]; idx: number };

const MAX_HISTORY = 5;
const PROJ_HISTORY_KEY = 'map-viewer-proj-history';

function loadProjState(): ProjState {
  try {
    const saved = JSON.parse(localStorage.getItem(PROJ_HISTORY_KEY) ?? 'null');
    if (saved && Array.isArray(saved.history)) return saved as ProjState;
  } catch { /* ignore */ }
  return { history: [], idx: -1 };
}

const btnStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
  background: active ? '#2a4a3a' : '#1a1a1a',
  border: `1px solid ${active ? '#2ecc71' : '#333'}`,
  color: disabled ? '#333' : active ? '#2ecc71' : '#666',
  borderRadius: 4,
  width: 26,
  height: 26,
  fontSize: 14,
  cursor: disabled ? 'default' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
});

export default function MapViewerPanel() {
  const { room, userId } = usePanelContext();
  const { config } = useMapViewerConfig();
  const [projState, setProjState] = useState<ProjState>(loadProjState);
  const [moments, setMoments] = useState<MomentSnapshot[]>([]);
  const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
  const [liveCursors, setLiveCursors] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [anchors, setAnchors] = useState<ReactionAnchors | null>(null);
  const [momentPageIdx, setMomentPageIdx] = useState<number | null>(null);
  const cursorTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const mapProjection = projState.history[projState.idx]?.projection ?? null;
  const flipX = projState.history[projState.idx]?.flipX ?? false;
  const flipY = projState.history[projState.idx]?.flipY ?? false;
  const canGoBack = projState.idx > 0;
  const canGoForward = projState.idx < projState.history.length - 1;

  const pushProjection = (proj: MapProjection) => {
    setProjState(prev => {
      // Skip duplicate (e.g. reconnect with same projection still active)
      if (prev.history[prev.history.length - 1]?.projection.computedAt === proj.computedAt) return prev;
      const history = [...prev.history, { projection: proj, flipX: false, flipY: false }].slice(-MAX_HISTORY);
      return { history, idx: history.length - 1 };
    });
  };

  const goBack = () => setProjState(prev =>
    prev.idx > 0 ? { ...prev, idx: prev.idx - 1 } : prev
  );
  const goForward = () => setProjState(prev =>
    prev.idx < prev.history.length - 1 ? { ...prev, idx: prev.idx + 1 } : prev
  );
  const toggleFlipX = () => setProjState(prev => {
    if (prev.idx < 0) return prev;
    const history = [...prev.history];
    history[prev.idx] = { ...history[prev.idx], flipX: !history[prev.idx].flipX };
    return { ...prev, history };
  });
  const toggleFlipY = () => setProjState(prev => {
    if (prev.idx < 0) return prev;
    const history = [...prev.history];
    history[prev.idx] = { ...history[prev.idx], flipY: !history[prev.idx].flipY };
    return { ...prev, history };
  });
  const deleteCurrent = () => setProjState(prev => {
    if (prev.idx < 0) return prev;
    const history = prev.history.filter((_, i) => i !== prev.idx);
    if (history.length === 0) return { history: [], idx: -1 };
    const idx = Math.min(prev.idx, history.length - 1);
    return { history, idx };
  });

  useEffect(() => {
    return () => {
      cursorTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    idbGet<MomentSnapshot[]>(`v4-moments-${room}`).then(stored => {
      if (stored) setMoments(stored);
    });
  }, [room]);

  useEffect(() => {
    localStorage.setItem(PROJ_HISTORY_KEY, JSON.stringify(projState));
  }, [projState]);

  useEffect(() => {
    setMomentPageIdx(null);
  }, [config?.momentId, config?.colorMode]);

  const activeMomentIdx = config?.colorMode === 'moment' && moments.length > 0
    ? (momentPageIdx !== null ? momentPageIdx : Math.max(0, moments.findIndex(m => m.id === config.momentId)))
    : -1;
  const activeMoment = activeMomentIdx >= 0 ? (moments[activeMomentIdx] ?? null) : null;

  const colorById: Record<string, string> | undefined = (() => {
    if (!config) return undefined;
    if (config.colorMode === 'moment') {
      if (!activeMoment) return undefined;
      const map: Record<string, string> = {};
      for (const [uid, region] of Object.entries(activeMoment.regions)) {
        map[uid] = region ? (VOTE_COLORS[region] ?? MISSING_COLOR) : MISSING_COLOR;
      }
      return map;
    }
    if (config.colorMode === 'now' && mapProjection) {
      const effectiveAnchors = anchors ?? DEFAULT_ANCHORS;
      const map: Record<string, string> = {};
      for (const [id] of mapProjection.coords) {
        const cursor = liveCursors.get(id);
        if (cursor) {
          const region = computeReactionRegion(cursor.x, cursor.y, effectiveAnchors);
          map[id] = region ? (VOTE_COLORS[region] ?? USER_STATUS_COLORS.idle) : USER_STATUS_COLORS.idle;
        } else if (connectedUserIds.includes(id)) {
          map[id] = USER_STATUS_COLORS.idle;
        } else {
          map[id] = USER_STATUS_COLORS.offline;
        }
      }
      return map;
    }
    return undefined;
  })();

  useMessageSubscription((evt) => {
    const data = JSON.parse(evt.data);
    if (data.type === 'connected') {
      if (data.mapProjection) pushProjection(data.mapProjection);
      if (data.connectedUserIds) setConnectedUserIds(data.connectedUserIds);
      if (data.roomAnchors) setAnchors(data.roomAnchors);
      return;
    }
    if (data.type === 'mapProjectionChanged') {
      if (data.projection) pushProjection(data.projection);
      return;
    }
    if (data.type === 'roomAnchorsChanged') {
      setAnchors(data.anchors ?? null);
      return;
    }
    if (data.type === 'userJoined') {
      setConnectedUserIds(prev => prev.includes(data.userId) ? prev : [...prev, data.userId]);
      return;
    }
    if (data.type === 'userLeft') {
      setConnectedUserIds(prev => prev.filter(id => id !== data.userId));
      setLiveCursors(prev => { const next = new Map(prev); next.delete(data.userId); return next; });
      return;
    }
    for (const e of expandCursorEvents(data)) {
      if (e.type === 'move' || e.type === 'touch') {
        const { userId: uid, x, y } = e.position;
        setLiveCursors(prev => new Map(prev).set(uid, { x, y }));
        const existing = cursorTimers.current.get(uid);
        if (existing) clearTimeout(existing);
        cursorTimers.current.set(uid, setTimeout(() => {
          setLiveCursors(prev => { const next = new Map(prev); next.delete(uid); return next; });
          cursorTimers.current.delete(uid);
        }, 3000));
      } else if (e.type === 'remove') {
        const { userId: uid } = e.position;
        setLiveCursors(prev => { const next = new Map(prev); next.delete(uid); return next; });
        const t = cursorTimers.current.get(uid);
        if (t) { clearTimeout(t); cursorTimers.current.delete(uid); }
      }
    }
  });

  if (!mapProjection) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 24px' }}>
        <p style={{ color: '#555', fontSize: 14, textAlign: 'center', margin: 0 }}>
          No projection computed yet. Use Map Maker to generate one.
        </p>
      </div>
    );
  }

  const showNowLegend = config?.colorMode === 'now';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ padding: '8px 16px', fontSize: 11, color: '#555', background: '#111', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{mapProjection.algorithm.toUpperCase()} · {mapProjection.coords.length} participants · {new Date(mapProjection.computedAt).toLocaleString()}</span>
        {activeMoment && (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#777' }}>{activeMoment.label || 'moment'}</span>
            <span style={{ fontSize: 10, color: '#555', minWidth: 28, textAlign: 'center' }}>{activeMomentIdx + 1}/{moments.length}</span>
            <button onClick={() => setMomentPageIdx(Math.max(0, activeMomentIdx - 1))} disabled={activeMomentIdx <= 0} title="Previous moment" style={btnStyle(false, activeMomentIdx <= 0)}>‹</button>
            <button onClick={() => setMomentPageIdx(Math.min(moments.length - 1, activeMomentIdx + 1))} disabled={activeMomentIdx >= moments.length - 1} title="Next moment" style={btnStyle(false, activeMomentIdx >= moments.length - 1)}>›</button>
            {([
                [VOTE_COLORS.positive, 'agree'],
                [VOTE_COLORS.negative, 'disagree'],
                [VOTE_COLORS.neutral,  'pass'],
                [MISSING_COLOR,        'missing'],
              ] as [string, string][]).map(([color, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                <span>{label}</span>
              </span>
            ))}
          </span>
        )}
        {showNowLegend && (
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: '#777' }}>live</span>
            {([
              [VOTE_COLORS.positive, 'agree'],
              [VOTE_COLORS.negative, 'disagree'],
              [VOTE_COLORS.neutral,  'pass'],
              [USER_STATUS_COLORS.idle,    USER_STATUS_LABELS.idle],
              [USER_STATUS_COLORS.offline, USER_STATUS_LABELS.offline],
            ] as [string, string][]).map(([color, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                <span>{label}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ScatterPlot data={mapProjection.coords} selfId={userId} colorById={colorById} flipX={flipX} flipY={flipY} />
      </div>
      <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={deleteCurrent} disabled={projState.idx < 0} title="Delete this projection" style={btnStyle(false, projState.idx < 0)}>×</button>
        <span style={{ fontSize: 10, color: '#444', minWidth: 28, textAlign: 'center' }}>
          {projState.idx + 1}/{projState.history.length}
        </span>
        <button onClick={goBack} disabled={!canGoBack} title="Previous projection" style={btnStyle(false, !canGoBack)}>‹</button>
        <button onClick={goForward} disabled={!canGoForward} title="Next projection" style={btnStyle(false, !canGoForward)}>›</button>
        <span style={{ width: 6 }} />
        <button onClick={toggleFlipX} title="Flip horizontal" style={btnStyle(flipX)}>↔</button>
        <button onClick={toggleFlipY} title="Flip vertical" style={btnStyle(flipY)}>↕</button>
      </div>
    </div>
  );
}
