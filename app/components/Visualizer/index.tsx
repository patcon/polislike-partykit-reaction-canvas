import { useRef, useEffect } from 'react';
import usePartySocket from 'partysocket/react';
import { createVisualizerScene, DEFAULT_VIZ_CONFIG } from './createVisualizerScene';
import type { VisualizerScene } from './createVisualizerScene';
import type { VizConfig, VizCameraState } from '../../types';

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
      }
      if (msg.type === 'visualizerConfigChanged') sceneRef.current?.applyConfig(msg.config as VizConfig);
      if (msg.type === 'cameraStateChanged') sceneRef.current?.applyCamera(msg.state as VizCameraState);
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
