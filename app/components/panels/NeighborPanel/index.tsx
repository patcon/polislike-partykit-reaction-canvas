import { useState, useEffect, useRef, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import * as d3 from 'd3';
import { usePanelContext } from '../../../context/PanelContext';
import { getPartySocketConfig } from '../../../utils/partyHost';
import { generateUUID } from '../../../utils/userId';

type View = 'entry' | 'graph';
type EdgeError = 'not_found' | 'self' | 'duplicate';

interface Edge { userA: string; userB: string }
interface D3Node extends d3.SimulationNodeDatum { id: string }
interface D3Link extends d3.SimulationLinkDatum<D3Node> { id: string }

const KEYPAD_KEYS = ['1','2','3','4','5','6','7','8','9','←','0','✓'];

const ERROR_MESSAGES: Record<EdgeError, string> = {
  not_found: 'Code not found — try again',
  self: "That's your own code",
  duplicate: 'Already connected',
};

export default function NeighborPanel({ initialView = 'entry' as View }: { initialView?: View }) {
  const { room, userId } = usePanelContext();
  const socketUserId = useRef(userId ?? generateUUID());

  const [view, setView] = useState<View>(initialView);
  const [digits, setDigits] = useState('');
  const [myCode, setMyCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorReason, setErrorReason] = useState<EdgeError | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [allCodes, setAllCodes] = useState<Record<string, string>>({});

  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodesRef = useRef<D3Node[]>([]);
  const linksRef = useRef<D3Link[]>([]);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId: socketUserId.current },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'connected') {
        if (msg.myNeighborCode) setMyCode(msg.myNeighborCode);
      } else if (msg.type === 'neighborEdgesSnapshot') {
        setEdges(msg.edges ?? []);
        setAllCodes(msg.allCodes ?? {});
        const userIds = Object.keys(msg.allCodes ?? {});
        nodesRef.current = userIds.map(id => ({ id, ...(nodesRef.current.find(n => n.id === id) ?? {}) }));
        linksRef.current = (msg.edges ?? []).map((e: Edge) => ({
          id: `${e.userA}|${e.userB}`,
          source: e.userA,
          target: e.userB,
        }));
        restartSim();
      } else if (msg.type === 'neighborEdgeAdded') {
        const edge: Edge = { userA: msg.userA, userB: msg.userB };
        setEdges(prev => [...prev, edge]);
        const id = `${msg.userA}|${msg.userB}`;
        if (!linksRef.current.find(l => l.id === id)) {
          linksRef.current = [...linksRef.current, { id, source: msg.userA, target: msg.userB }];
          for (const uid of [msg.userA, msg.userB]) {
            if (!nodesRef.current.find(n => n.id === uid)) {
              nodesRef.current = [...nodesRef.current, { id: uid }];
            }
          }
          restartSim();
        }
      } else if (msg.type === 'neighborEdgesCleared') {
        setEdges([]);
        linksRef.current = [];
        restartSim();
      } else if (msg.type === 'neighborEdgeError') {
        setErrorReason(msg.reason as EdgeError);
        setStatus('error');
        clearStatusTimer();
        statusTimerRef.current = setTimeout(() => setStatus('idle'), 3000);
      }
    },
  });

  function clearStatusTimer() {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
  }

  function submitCode(code: string) {
    if (code.length !== 4) return;
    socket.send(JSON.stringify({ type: 'neighborEdge', from: socketUserId.current, toCode: code }));
    setDigits('');
    clearStatusTimer();
    setStatus('success');
    statusTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
  }

  function handleKey(key: string) {
    if (key === '←') {
      setDigits(d => d.slice(0, -1));
      return;
    }
    if (key === '✓') {
      submitCode(digits);
      return;
    }
    if (digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);
    if (next.length === 4) submitCode(next);
  }

  function openGraph() {
    socket.send(JSON.stringify({ type: 'requestNeighborEdges' }));
    setView('graph');
  }

  // ===== D3 graph =====
  const restartSim = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 320;
    const height = svgRef.current.clientHeight || 280;

    svg.selectAll('*').remove();

    const padding = 20;

    const sim = d3.forceSimulation<D3Node>(nodesRef.current)
      .force('link', d3.forceLink<D3Node, D3Link>(linksRef.current).id(d => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('x', d3.forceX(width / 2).strength(0.07))
      .force('y', d3.forceY(height / 2).strength(0.07))
      .force('collide', d3.forceCollide(14));
    simRef.current = sim;

    const linkSel = svg.append('g')
      .selectAll<SVGLineElement, D3Link>('line')
      .data(linksRef.current)
      .join('line')
      .attr('stroke', '#888')
      .attr('stroke-width', 1.5)
      .style('opacity', 0)
      .transition().duration(400)
      .style('opacity', 1);

    const nodeSel = svg.append('g')
      .selectAll<SVGCircleElement, D3Node>('circle')
      .data(nodesRef.current)
      .join('circle')
      .attr('r', 8)
      .attr('fill', d => d.id === socketUserId.current ? '#4f9cf9' : '#aaa')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .call(
        d3.drag<SVGCircleElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    sim.on('tick', () => {
      for (const n of nodesRef.current) {
        n.x = Math.max(padding, Math.min(width - padding, n.x ?? width / 2));
        n.y = Math.max(padding, Math.min(height - padding, n.y ?? height / 2));
      }
      svg.selectAll<SVGLineElement, D3Link>('line')
        .attr('x1', d => (d.source as D3Node).x ?? 0)
        .attr('y1', d => (d.source as D3Node).y ?? 0)
        .attr('x2', d => (d.target as D3Node).x ?? 0)
        .attr('y2', d => (d.target as D3Node).y ?? 0);
      svg.selectAll<SVGCircleElement, D3Node>('circle')
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0);
    });

    // suppress unused var warnings — selections are used imperatively
    void linkSel; void nodeSel;
  }, []);

  useEffect(() => {
    if (view === 'graph') restartSim();
    return () => { simRef.current?.stop(); };
  }, [view, restartSim]);

  useEffect(() => () => clearStatusTimer(), []);

  if (view === 'graph') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button
            onClick={() => setView('entry')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f9cf9', fontSize: 14 }}
          >
            ← Back
          </button>
          <button
            onClick={() => socket.send(JSON.stringify({ type: 'clearNeighborEdges' }))}
            style={{ background: 'none', border: '1px solid #888', borderRadius: 4, cursor: 'pointer', color: '#ccc', fontSize: 12, padding: '2px 8px' }}
          >
            Clear all connections
          </button>
        </div>
        <svg ref={svgRef} style={{ flex: 1, width: '100%', background: '#1a1a1a', borderRadius: 8 }} />
        <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 6 }}>
          {edges.length === 0 ? 'No connections yet' : `${edges.length} connection${edges.length === 1 ? '' : 's'}`}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', height: '100%' }}>
      <div style={{ marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>Your code</div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '0.15em', fontVariantNumeric: 'tabular-nums' }}>
          {myCode ?? '····'}
        </div>
      </div>

      <div style={{ fontSize: 13, color: '#ccc', marginBottom: 8 }}>Enter a neighbour's code</div>

      <div style={{
        fontSize: 28,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.2em',
        minHeight: 40,
        marginBottom: 10,
        color: digits.length === 4 ? '#fff' : '#888',
      }}>
        {digits.padEnd(4, '·')}
      </div>

      {status === 'success' && (
        <div style={{ color: '#4ade80', fontSize: 13, marginBottom: 8 }}>Got it!</div>
      )}
      {status === 'error' && errorReason && (
        <div style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{ERROR_MESSAGES[errorReason]}</div>
      )}
      {status === 'idle' && <div style={{ height: 29, marginBottom: 8 }} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 8 }}>
        {KEYPAD_KEYS.map(key => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            style={{
              height: 52,
              fontSize: key === '←' || key === '✓' ? 18 : 22,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid #444',
              background: key === '✓' ? '#2563eb' : '#2a2a2a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {key}
          </button>
        ))}
      </div>

      <button
        onClick={openGraph}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 12, marginTop: 16, textDecoration: 'underline' }}
      >
        See the map →
      </button>
    </div>
  );
}
