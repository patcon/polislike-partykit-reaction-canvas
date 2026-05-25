import { useState, useEffect, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import * as d3 from 'd3';
import { getPartySocketConfig } from '../../../utils/partyHost';
import { idbGet } from '../../../utils/idbStorage';
import type { MapProjection, MapViewerConfig } from '../../../types';
import type { MomentSnapshot } from '../AdminPanelNoDB/types';

const VOTE_COLORS: Record<string, string> = {
  positive: '#2ecc71',
  negative: '#e74c3c',
  neutral:  '#f1c40f',
};
const MISSING_COLOR = '#b0b0b0';
const DEFAULT_COLOR = '#4a8';

interface MapViewerPanelProps {
  room: string;
  userId: string;
  config?: MapViewerConfig | null;
}

function ScatterPlot({ data, selfId, colorById }: { data: [string, [number, number]][]; selfId: string; colorById?: Record<string, string> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    const g = d3.select(gRef.current!);
    const { width, height } = svgRef.current!.getBoundingClientRect();

    const xs = data.map(([, [x]]) => x);
    const ys = data.map(([, [, y]]) => y);
    const xScale = d3.scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([20, width - 20]);
    const yScale = d3.scaleLinear().domain([Math.min(...ys), Math.max(...ys)]).range([20, height - 20]);

    const others = data.filter(([id]) => id !== selfId);
    const self = data.find(([id]) => id === selfId);

    g.selectAll<SVGCircleElement, [string, [number, number]]>('circle.peer')
      .data(others, ([id]) => id)
      .join('circle')
      .attr('class', 'peer')
      .attr('cx', ([, [x]]) => xScale(x))
      .attr('cy', ([, [, y]]) => yScale(y))
      .attr('r', 5)
      .attr('fill', ([id]) => colorById ? (colorById[id] ?? MISSING_COLOR) : DEFAULT_COLOR)
      .attr('fill-opacity', 0.7)
      .attr('stroke', ([id]) => {
        const c = colorById ? (colorById[id] ?? MISSING_COLOR) : DEFAULT_COLOR;
        return d3.color(c)?.darker(0.5)?.toString() ?? c;
      })
      .attr('stroke-width', 0.5);

    // GPS dot: pulsing halo + solid blue dot
    if (self) {
      const [, [sx, sy]] = self;
      const cx = xScale(sx);
      const cy = yScale(sy);

      g.selectAll('circle.self-halo').data([null]).join('circle')
        .attr('class', 'self-halo')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 12)
        .attr('fill', '#4a90e2')
        .attr('fill-opacity', 0.2)
        .attr('stroke', 'none');

      g.selectAll('circle.self-ring').data([null]).join('circle')
        .attr('class', 'self-ring')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);

      g.selectAll('circle.self-dot').data([null]).join('circle')
        .attr('class', 'self-dot')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', 6)
        .attr('fill', '#4a90e2')
        .attr('stroke', 'none');
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    return () => { svg.on('.zoom', null); };
  }, [data, selfId, colorById]);

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%', display: 'block', background: '#0e1a12', cursor: 'grab' }}
    >
      <g ref={gRef} />
    </svg>
  );
}

export default function MapViewerPanel({ room, userId, config }: MapViewerPanelProps) {
  const [mapProjection, setMapProjection] = useState<MapProjection | null>(null);
  const [moments, setMoments] = useState<MomentSnapshot[]>([]);

  useEffect(() => {
    idbGet<MomentSnapshot[]>(`v4-moments-${room}`).then(stored => {
      if (stored) setMoments(stored);
    });
  }, [room]);

  const colorById: Record<string, string> | undefined = (() => {
    if (!config || config.colorMode !== 'moment' || !config.momentId) return undefined;
    const moment = moments.find(m => m.id === config.momentId);
    if (!moment) return undefined;
    const map: Record<string, string> = {};
    for (const [uid, region] of Object.entries(moment.regions)) {
      map[uid] = region ? (VOTE_COLORS[region] ?? MISSING_COLOR) : MISSING_COLOR;
    }
    return map;
  })();

  usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage(evt) {
      const data = JSON.parse(evt.data);
      if (data.type === 'connected') {
        setMapProjection(data.mapProjection ?? null);
        return;
      }
      if (data.type === 'mapProjectionChanged') {
        setMapProjection(data.projection ?? null);
      }
    },
  });

  if (!mapProjection) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: 14 }}>
        No projection computed yet. Use Map Maker to generate one.
      </div>
    );
  }

  const activeMoment = config?.colorMode === 'moment' && config.momentId
    ? moments.find(m => m.id === config.momentId)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 16px', fontSize: 11, color: '#555', background: '#111', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{mapProjection.algorithm.toUpperCase()} · {mapProjection.coords.length} participants · {new Date(mapProjection.computedAt).toLocaleString()}</span>
        {activeMoment && (
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: '#777' }}>{activeMoment.label || 'moment'}</span>
            {([['positive', '#2ecc71', 'agree'], ['negative', '#e74c3c', 'disagree'], ['neutral', '#f1c40f', 'pass'], ['missing', '#b0b0b0', 'missing']] as [string, string, string][]).map(([, color, label]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                <span>{label}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ScatterPlot data={mapProjection.coords} selfId={userId} colorById={colorById} />
      </div>
    </div>
  );
}
