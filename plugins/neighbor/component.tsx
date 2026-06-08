import { useState, useEffect, useRef, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import * as d3 from 'd3';
import { usePanelContext } from '../../app/context/PanelContext';
import { getPartySocketConfig } from '../../app/utils/partyHost';
import { expandCursorEvents } from '../../app/utils/cursor';
import { generateUUID } from '../../app/utils/userId';
import { computeReactionRegion, DEFAULT_ANCHORS } from '../../app/utils/voteRegion';
import type { ReactionAnchors } from '../../app/utils/voteRegion';
import { VOTE_COLORS, USER_STATUS_COLORS, EDGE_COLOR, EDGE_FLASH_COLOR, EDGE_FLASH_MS } from '../../app/constants/userStatus';

type View = 'entry' | 'graph';
type EdgeError = 'not_found' | 'self' | 'duplicate';

interface Edge { userA: string; userB: string }
interface D3Node extends d3.SimulationNodeDatum { id: string; offline?: boolean }
interface D3Link extends d3.SimulationLinkDatum<D3Node> { id: string }

const KEYPAD_KEYS = ['1','2','3','4','5','6','7','8','9','←','0','✕'];

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
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showOffline, setShowOffline] = useState(true);
  const showOfflineRef = useRef(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const nodesRef = useRef<D3Node[]>([]);
  const linksRef = useRef<D3Link[]>([]);
  const transformGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const linkGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodeGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const paddingRef = useRef(20);
  const sizeRef = useRef({ width: 320, height: 280 });
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveCursorsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const anchorsRef = useRef<ReactionAnchors>(DEFAULT_ANCHORS);

  // D3 mutates link source/target from string IDs to node objects; normalize back and drop any links
  // whose endpoints are missing from nodesRef (server/timing inconsistency guard)
  function freshLinks(): D3Link[] {
    const nodeIds = new Set(nodesRef.current.map(n => n.id));
    return linksRef.current.flatMap(l => {
      const src = typeof l.source === 'object' ? (l.source as D3Node).id : l.source as string;
      const tgt = typeof l.target === 'object' ? (l.target as D3Node).id : l.target as string;
      if (!nodeIds.has(src) || !nodeIds.has(tgt)) return [];
      return [{ id: l.id, source: src, target: tgt }];
    });
  }

  function getNodeColor(node: D3Node): string {
    if (node.offline) return USER_STATUS_COLORS.offline;
    const pos = liveCursorsRef.current.get(node.id);
    if (!pos) return USER_STATUS_COLORS.idle;
    const region = computeReactionRegion(pos.x, pos.y, anchorsRef.current);
    return region ? VOTE_COLORS[region] : USER_STATUS_COLORS.idle;
  }

  function getLinkDisplay(d: D3Link): string | null {
    if (showOfflineRef.current) return null;
    const srcId = typeof d.source === 'object' ? (d.source as D3Node).id : d.source as string;
    const tgtId = typeof d.target === 'object' ? (d.target as D3Node).id : d.target as string;
    const srcOffline = nodesRef.current.find(n => n.id === srcId)?.offline;
    const tgtOffline = nodesRef.current.find(n => n.id === tgtId)?.offline;
    return (srcOffline || tgtOffline) ? 'none' : null;
  }

  function updateNodeColors() {
    nodeGroupRef.current?.selectAll<SVGCircleElement, D3Node>('circle')
      .attr('fill', d => getNodeColor(d));
  }

  function updateVisibility() {
    const show = showOfflineRef.current;
    nodeGroupRef.current?.selectAll<SVGCircleElement, D3Node>('circle')
      .attr('display', d => (!show && d.offline) ? 'none' : null);
    linkGroupRef.current?.selectAll<SVGLineElement, D3Link>('line')
      .attr('display', d => getLinkDisplay(d));
  }

  function addNodeLive(uid: string) {
    const sim = simRef.current;
    const nodeGroup = nodeGroupRef.current;
    if (!sim || !nodeGroup) return;
    sim.nodes(nodesRef.current);
    nodeGroup.selectAll<SVGCircleElement, D3Node>('circle')
      .data(nodesRef.current, d => d.id)
      .join(enter => enter.append('circle')
        .attr('r', 8).attr('fill', d => getNodeColor(d))
        .attr('stroke', '#fff').attr('stroke-width', 1.5)
        .attr('display', d => (!showOfflineRef.current && d.offline) ? 'none' : null)
        .call(makeDrag(sim))
      );
    sim.alpha(0.3).restart();
  }

  const addEdgeLive = useCallback((link: D3Link) => {
    const sim = simRef.current;
    const linkGroup = linkGroupRef.current;
    const nodeGroup = nodeGroupRef.current;
    if (!sim || !linkGroup || !nodeGroup) return;

    // Add any new nodes to the simulation
    let nodesChanged = false;
    for (const uid of [link.source as string, link.target as string]) {
      if (!nodesRef.current.find(n => n.id === uid)) {
        const { width, height } = sizeRef.current;
        nodesRef.current = [...nodesRef.current, { id: uid, x: width / 2, y: height / 2 }];
        nodesChanged = true;
      }
    }
    if (nodesChanged) {
      sim.nodes(nodesRef.current);
      nodeGroup
        .selectAll<SVGCircleElement, D3Node>('circle')
        .data(nodesRef.current, d => d.id)
        .join(enter => enter.append('circle')
          .attr('r', 8)
          .attr('fill', d => getNodeColor(d))
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .attr('display', d => (!showOfflineRef.current && d.offline) ? 'none' : null)
          .call(makeDrag(sim))
        );
    }

    // Add the new link and flash its color
    linksRef.current = [...freshLinks(), link];
    (sim.force('link') as d3.ForceLink<D3Node, D3Link>).links(linksRef.current);

    linkGroup
      .selectAll<SVGLineElement, D3Link>('line')
      .data(linksRef.current, d => d.id)
      .join(enter => enter.append('line')
        .attr('stroke', EDGE_FLASH_COLOR)
        .attr('stroke-width', 1.5)
        .attr('display', d => getLinkDisplay(d))
        .transition().duration(EDGE_FLASH_MS)
        .attr('stroke', EDGE_COLOR)
      );

    sim.alpha(0.3).restart();
  }, []);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId: socketUserId.current },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'neighborCode') {
        setMyCode(msg.code);
      } else if (msg.type === 'connected') {
        if (msg.roomAnchors) anchorsRef.current = msg.roomAnchors;
      } else if (msg.type === 'roomAnchorsChanged') {
        anchorsRef.current = msg.anchors ?? DEFAULT_ANCHORS;
        updateNodeColors();
      } else if (msg.type === 'move' || msg.type === 'touch' || msg.type === 'remove' || msg.type === 'cursorBatch') {
        let changed = false;
        for (const e of expandCursorEvents(msg)) {
          if (e.type === 'move' || e.type === 'touch') {
            liveCursorsRef.current.set(e.position.userId, { x: e.position.x, y: e.position.y });
            changed = true;
          } else if (e.type === 'remove') {
            liveCursorsRef.current.delete(e.position.userId);
            changed = true;
          }
        }
        if (changed) updateNodeColors();
      } else if (msg.type === 'userJoined') {
        const uid: string = msg.userId;
        const existing = nodesRef.current.find(n => n.id === uid);
        if (existing) {
          existing.offline = false;
          nodeGroupRef.current?.selectAll<SVGCircleElement, D3Node>('circle')
            .filter(d => d.id === uid)
            .attr('fill', getNodeColor(existing))
            .attr('display', null);
          updateVisibility();
        } else {
          const { width, height } = sizeRef.current;
          nodesRef.current = [...nodesRef.current, { id: uid, x: width / 2, y: height / 2 }];
          addNodeLive(uid);
        }
        socket.send(JSON.stringify({ type: 'requestNeighborEdges' }));
      } else if (msg.type === 'userLeft') {
        const uid: string = msg.userId;
        liveCursorsRef.current.delete(uid);
        const node = nodesRef.current.find(n => n.id === uid);
        if (node) {
          node.offline = true;
          nodeGroupRef.current?.selectAll<SVGCircleElement, D3Node>('circle')
            .filter(d => d.id === uid)
            .attr('fill', USER_STATUS_COLORS.offline)
            .attr('display', showOfflineRef.current ? null : 'none');
          updateVisibility();
        }
      } else if (msg.type === 'neighborEdgesSnapshot') {
        setEdges(msg.edges ?? []);
        const edgeUserIds = (msg.edges ?? []).flatMap((e: Edge) => [e.userA, e.userB]);
        const allIds = [...new Set([...Object.keys(msg.allCodes ?? {}), ...edgeUserIds])];
        const { width, height } = sizeRef.current;
        const cx = width / 2, cy = height / 2;
        const sim = simRef.current;
        const nodeGroup = nodeGroupRef.current;
        const linkGroup = linkGroupRef.current;
        if (sim && nodeGroup && linkGroup) {
          // Live sim running — merge incrementally, no restart
          let nodesChanged = false;
          for (const id of allIds) {
            if (!nodesRef.current.find(n => n.id === id)) {
              nodesRef.current = [...nodesRef.current, { id, x: cx, y: cy }];
              nodesChanged = true;
            }
          }
          if (nodesChanged) {
            sim.nodes(nodesRef.current);
            nodeGroup.selectAll<SVGCircleElement, D3Node>('circle')
              .data(nodesRef.current, d => d.id)
              .join(enter => enter.append('circle')
                .attr('r', 8).attr('fill', d => getNodeColor(d))
                .attr('stroke', '#fff').attr('stroke-width', 1.5)
                .attr('display', d => (!showOfflineRef.current && d.offline) ? 'none' : null)
                .call(makeDrag(sim))
              );
          }
          const newLinks = (msg.edges ?? [])
            .filter((e: Edge) => !linksRef.current.find(l => l.id === `${e.userA}|${e.userB}`))
            .map((e: Edge) => ({ id: `${e.userA}|${e.userB}`, source: e.userA, target: e.userB }));
          if (newLinks.length > 0) {
            linksRef.current = [...freshLinks(), ...newLinks];
            (sim.force('link') as d3.ForceLink<D3Node, D3Link>).links(linksRef.current);
            linkGroup.selectAll<SVGLineElement, D3Link>('line')
              .data(linksRef.current, d => d.id)
              .join(enter => enter.append('line')
                .attr('stroke', EDGE_COLOR).attr('stroke-width', 1.5)
                .attr('display', d => getLinkDisplay(d))
              );
            sim.alpha(0.3).restart();
          }
        } else {
          // No live sim — update refs so restartSim picks them up
          nodesRef.current = allIds.map(id => ({ id, x: cx, y: cy, ...(nodesRef.current.find(n => n.id === id) ?? {}) }));
          linksRef.current = (msg.edges ?? []).map((e: Edge) => ({
            id: `${e.userA}|${e.userB}`, source: e.userA, target: e.userB,
          }));
          restartSim();
        }
      } else if (msg.type === 'neighborEdgeAdded') {
        const edge: Edge = { userA: msg.userA, userB: msg.userB };
        setEdges(prev => [...prev, edge]);
        const id = `${msg.userA}|${msg.userB}`;
        if (!linksRef.current.find(l => l.id === id)) {
          addEdgeLive({ id, source: msg.userA, target: msg.userB });
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
    if (key === '✕') {
      setDigits('');
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
  function makeDrag(sim: d3.Simulation<D3Node, D3Link>) {
    return d3.drag<SVGCircleElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
  }

  const restartSim = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 320;
    const height = svgRef.current.clientHeight || 280;
    const padding = 20;
    sizeRef.current = { width, height };
    paddingRef.current = padding;

    svg.selectAll('*').remove();

    linksRef.current = freshLinks();
    const sim = d3.forceSimulation<D3Node>(nodesRef.current)
      .force('link', d3.forceLink<D3Node, D3Link>(linksRef.current).id(d => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('x', d3.forceX(width / 2).strength(0.07))
      .force('y', d3.forceY(height / 2).strength(0.07))
      .force('collide', d3.forceCollide(14));
    simRef.current = sim;

    const tg = svg.append('g');
    transformGroupRef.current = tg;
    linkGroupRef.current = tg.append('g');
    nodeGroupRef.current = tg.append('g');

    linkGroupRef.current
      .selectAll<SVGLineElement, D3Link>('line')
      .data(linksRef.current, d => d.id)
      .join('line')
      .attr('stroke', EDGE_COLOR)
      .attr('stroke-width', 1.5)
      .attr('display', d => getLinkDisplay(d));

    nodeGroupRef.current
      .selectAll<SVGCircleElement, D3Node>('circle')
      .data(nodesRef.current, d => d.id)
      .join('circle')
      .attr('r', 8)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('display', d => (!showOfflineRef.current && d.offline) ? 'none' : null)
      .call(makeDrag(sim));

    sim.on('tick', () => {
      linkGroupRef.current?.selectAll<SVGLineElement, D3Link>('line')
        .attr('x1', d => (d.source as D3Node).x ?? 0)
        .attr('y1', d => (d.source as D3Node).y ?? 0)
        .attr('x2', d => (d.target as D3Node).x ?? 0)
        .attr('y2', d => (d.target as D3Node).y ?? 0);
      nodeGroupRef.current?.selectAll<SVGCircleElement, D3Node>('circle')
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0);
    });
  }, []);

  useEffect(() => {
    if (view === 'graph') restartSim();
    return () => { simRef.current?.stop(); };
  }, [view, restartSim]);

  useEffect(() => {
    if (!transformGroupRef.current) return;
    const { width, height } = sizeRef.current;
    const cx = width / 2, cy = height / 2;
    const scaleX = flipH ? -1 : 1;
    const scaleY = flipV ? -1 : 1;
    transformGroupRef.current.attr('transform',
      `translate(${cx},${cy}) rotate(${rotation}) scale(${scaleX},${scaleY}) translate(${-cx},${-cy})`
    );
  }, [flipH, flipV, rotation]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#ccc', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showOffline}
                onChange={e => {
                  const val = e.target.checked;
                  setShowOffline(val);
                  showOfflineRef.current = val;
                  updateVisibility();
                }}
                style={{ cursor: 'pointer' }}
              />
              show offline
            </label>
            <button
              onClick={() => socket.send(JSON.stringify({ type: 'clearNeighborEdges' }))}
              style={{ background: 'none', border: '1px solid #888', borderRadius: 4, cursor: 'pointer', color: '#ccc', fontSize: 12, padding: '2px 8px' }}
            >
              Clear all connections
            </button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg ref={svgRef} style={{ width: '100%', height: '100%', background: '#1a1a1a', borderRadius: 8 }} />
          <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="range"
              min={-180}
              max={180}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              style={{ width: 120, maxWidth: 200, cursor: 'pointer', accentColor: '#4f9cf9' }}
            />
            <button
              onClick={() => setFlipH(f => !f)}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #444', background: 'rgba(20,20,20,0.8)', color: '#ccc', cursor: 'pointer' }}
            >
              ↔
            </button>
            <button
              onClick={() => setFlipV(f => !f)}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #444', background: 'rgba(20,20,20,0.8)', color: '#ccc', cursor: 'pointer' }}
            >
              ↕
            </button>
            <button
              onClick={() => restartSim()}
              title="Refresh layout"
              style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: 'rgba(20,20,20,0.8)', color: '#ccc', cursor: 'pointer' }}
            >
              ↺
            </button>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 6 }}>
          {edges.length === 0 ? 'No connections yet' : `${edges.length} connection${edges.length === 1 ? '' : 's'}`}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', height: '100%', position: 'relative' }}>
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
              fontSize: key === '←' || key === '✕' ? 18 : 22,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid #444',
              background: '#2a2a2a',
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
        style={{ position: 'absolute', bottom: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#444', fontSize: 11, textDecoration: 'underline', opacity: 0.5 }}
      >
        map
      </button>
    </div>
  );
}
