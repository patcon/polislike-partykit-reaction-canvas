import { useRef, useEffect } from 'react';
import usePartySocket from 'partysocket/react';
import { createVisualizerScene, DEFAULT_VIZ_CONFIG } from './createVisualizerScene';
import type { VisualizerScene } from './createVisualizerScene';
import type { VizConfig, VizCameraState } from '../../types';

type Anchors = { positive: { x: number; y: number }; negative: { x: number; y: number }; neutral: { x: number; y: number } };
const DEFAULT_ANCHORS: Anchors = { positive: { x: 95, y: 5 }, negative: { x: 5, y: 95 }, neutral: { x: 95, y: 95 } };

function cursorToValue(nx: number, ny: number, anchors: Anchors): number {
  const x = nx / 100, y = ny / 100;
  const pos = { x: anchors.positive.x / 100, y: anchors.positive.y / 100 };
  const neg = { x: anchors.negative.x / 100, y: anchors.negative.y / 100 };
  const neu = { x: anchors.neutral.x / 100, y: anchors.neutral.y / 100 };
  const denom = (neg.y - neu.y) * (pos.x - neu.x) + (neu.x - neg.x) * (pos.y - neu.y);
  let wPos: number, wNeg: number;
  if (Math.abs(denom) < 1e-10) {
    const dp = Math.hypot(x - pos.x, y - pos.y), dn = Math.hypot(x - neg.x, y - neg.y), dz = Math.hypot(x - neu.x, y - neu.y);
    const s = (1 / (dp || 1e-9)) + (1 / (dn || 1e-9)) + (1 / (dz || 1e-9));
    wPos = (1 / (dp || 1e-9)) / s; wNeg = (1 / (dn || 1e-9)) / s;
  } else {
    wPos = ((neg.y - neu.y) * (x - neu.x) + (neu.x - neg.x) * (y - neu.y)) / denom;
    wNeg = ((neu.y - pos.y) * (x - neu.x) + (pos.x - neu.x) * (y - neu.y)) / denom;
  }
  return (Math.max(0, Math.min(100, wPos * 100 + (1 - wPos - wNeg) * 50)) - 50) / 50;
}

const PARTYKIT_HOST = window.location.port === '1999'
  ? `${window.location.hostname}:1999`
  : window.location.hostname;

interface VisualizerProps {
  room: string;
  isEmcee: boolean;
}

export default function Visualizer({ room, isEmcee }: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VisualizerScene | null>(null);
  const isEmceeRef = useRef(isEmcee);
  isEmceeRef.current = isEmcee;
  const anchorsRef = useRef<Anchors>(DEFAULT_ANCHORS);

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room,
    query: { isAdmin: isEmcee ? 'true' : 'false' },
  });

  useEffect(() => {
    if (!containerRef.current) return;
    sceneRef.current = createVisualizerScene(containerRef.current, {
      onCameraChange: (state: VizCameraState) => {
        if (isEmceeRef.current) {
          socket.send(JSON.stringify({ type: 'setCameraState', state }));
        }
      },
    });
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'connected') {
        if (msg.vizConfig) sceneRef.current?.applyConfig(msg.vizConfig as VizConfig);
        else sceneRef.current?.applyConfig(DEFAULT_VIZ_CONFIG);
        if (msg.vizCameraState) sceneRef.current?.applyCamera(msg.vizCameraState as VizCameraState);
        if (msg.roomAnchors) anchorsRef.current = msg.roomAnchors as Anchors;
      }
      if (msg.type === 'visualizerConfigChanged') sceneRef.current?.applyConfig(msg.config as VizConfig);
      if (msg.type === 'cameraStateChanged') sceneRef.current?.applyCamera(msg.state as VizCameraState);
      if (msg.type === 'roomAnchorsChanged') anchorsRef.current = (msg.anchors as Anchors) ?? DEFAULT_ANCHORS;
      if (msg.type === 'userJoined') sceneRef.current?.addLiveCursor(msg.userId as string);
      if (msg.type === 'userLeft') sceneRef.current?.removeLiveCursor(msg.userId as string);
      if (msg.type === 'move' || msg.type === 'touch') {
        const pos = msg.position as { x: number; y: number; userId: string } | undefined;
        if (pos) sceneRef.current?.updateLiveCursor(pos.userId, cursorToValue(pos.x, pos.y, anchorsRef.current), false);
      }
      if (msg.type === 'remove') {
        const uid = (msg.userId ?? (msg.position as { userId?: string } | undefined)?.userId) as string | undefined;
        if (uid) sceneRef.current?.removeLiveCursor(uid);
      }
    };
    socket.addEventListener('message', handler);
    return () => socket.removeEventListener('message', handler);
  }, [socket]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#0f0f0e' }}
    />
  );
}
