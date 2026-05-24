import { useState, useEffect, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import * as d3 from 'd3';
import { getPartySocketConfig } from '../../../utils/partyHost';
import type { MapProjection } from '../../../types';

interface MapViewerPanelProps {
  room: string;
  userId: string;
}

function ScatterPlot({ data }: { data: [string, [number, number]][] }) {
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

    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', ([, [x]]) => xScale(x))
      .attr('cy', ([, [, y]]) => yScale(y))
      .attr('r', 5)
      .attr('fill', '#4a8')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#2a6')
      .attr('stroke-width', 0.5);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    return () => { svg.on('.zoom', null); };
  }, [data]);

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%', display: 'block', background: '#0e1a12', cursor: 'grab' }}
    >
      <g ref={gRef} />
    </svg>
  );
}

export default function MapViewerPanel({ room, userId }: MapViewerPanelProps) {
  const [mapProjection, setMapProjection] = useState<MapProjection | null>(null);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 16px', fontSize: 11, color: '#555', background: '#111', flexShrink: 0 }}>
        {mapProjection.algorithm.toUpperCase()} · {mapProjection.coords.length} participants · {new Date(mapProjection.computedAt).toLocaleString()}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ScatterPlot data={mapProjection.coords} />
      </div>
    </div>
  );
}
