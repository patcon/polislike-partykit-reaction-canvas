import { useState, useRef, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import { usePanelContext } from '../../app/context/PanelContext';
import { getPartySocketConfig } from '../../app/utils/partyHost';
import { makePhoneState, greensRandom, lerpColor, rgbToHex, type PhoneState } from './programs';

const PRESETS = [
  { label: 'Red',     color: '#ff0000' },
  { label: 'Orange',  color: '#ff8800' },
  { label: 'Yellow',  color: '#ffee00' },
  { label: 'Green',   color: '#00cc44' },
  { label: 'Cyan',    color: '#00ccff' },
  { label: 'Blue',    color: '#0044ff' },
  { label: 'Magenta', color: '#cc00ff' },
  { label: 'White',   color: '#ffffff' },
  { label: 'Black',   color: '#000000' },
];

export default function LightShow() {
  const { room, userId } = usePanelContext();
  const [color, setColor] = useState('#ffffff');
  const [brightness, setBrightness] = useState(100);
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [activeProgram, setActiveProgram] = useState<'pulse' | 'forest' | null>(null);
  const [pulseColorA, setPulseColorA] = useState('#000000');
  const [pulseColorB, setPulseColorB] = useState('#ffffff');

  const socketRef = useRef<ReturnType<typeof usePartySocket> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const programStartRef = useRef<number>(0);
  // Stored as a ref (not state) so tick callbacks read the latest values without causing re-renders.
  const forestStatesRef = useRef<Map<string, PhoneState>>(new Map());

  /** Broadcasts a single color+brightness to all participants. */
  const sendGlobal = useCallback((nextColor: string, nextBrightness: number) => {
    socketRef.current?.send(JSON.stringify({ type: 'setBatchScreenLight', mode: 'global', color: nextColor, brightness: nextBrightness }));
  }, []);

  /** Broadcasts a per-userId color map so each ScreenLight panel shows its own color. */
  const sendPerParticipant = useCallback((colors: Record<string, { color: string; brightness: number }>) => {
    socketRef.current?.send(JSON.stringify({ type: 'setBatchScreenLight', mode: 'perParticipant', colors }));
  }, []);

  /** Clears the active tick interval and resets program state. Safe to call when no program is running. */
  const stopProgram = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActiveProgram(null);
  }, []);

  /**
   * Starts the Pulse program: broadcasts a global color that oscillates between pulseColorA and
   * pulseColorB at ~30 fps. Color values are captured at start time so the interval closure stays
   * stable — changing A/B while running has no effect until restarted.
   */
  const startPulse = useCallback(() => {
    stopProgram();
    programStartRef.current = Date.now();
    const a = pulseColorA;
    const b = pulseColorB;
    const br = brightness;
    intervalRef.current = setInterval(() => {
      const ts = (Date.now() - programStartRef.current) / 1000;
      const t = (Math.sin(ts * Math.PI) + 1) / 2;
      sendGlobal(lerpColor(a, b, t), br);
    }, 33);
    setActiveProgram('pulse');
  }, [stopProgram, pulseColorA, pulseColorB, brightness, sendGlobal]);

  /**
   * Starts the Forest program: each participant drifts independently through a greens palette at ~10 fps.
   * `currentParticipants` is a snapshot taken at start — latecomers won't be animated until Forest
   * is restarted (they still receive ticks for existing participants via the server broadcast).
   * Per-phone PhoneState is lazy-initialised on first tick and persists across Forest restarts.
   */
  const startForest = useCallback((currentParticipants: Set<string>) => {
    stopProgram();
    programStartRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const ts = (Date.now() - programStartRef.current) / 1000;
      const colors: Record<string, { color: string; brightness: number }> = {};
      for (const uid of currentParticipants) {
        if (!forestStatesRef.current.has(uid)) {
          forestStatesRef.current.set(uid, makePhoneState());
        }
        const state = forestStatesRef.current.get(uid)!;
        colors[uid] = { color: rgbToHex(greensRandom(state, ts)), brightness: 100 };
      }
      if (Object.keys(colors).length > 0) sendPerParticipant(colors);
    }, 100);
    setActiveProgram('forest');
  }, [stopProgram, sendPerParticipant]);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'setBatchScreenLight' && msg.mode === 'global') {
        setColor(msg.color);
        setBrightness(msg.brightness);
      } else if (msg.type === 'connected') {
        const ids: string[] = (msg.connectedUserIds ?? []).filter((id: string) => id !== userId);
        setParticipants(new Set(ids));
      } else if (msg.type === 'userJoined' && msg.userId !== userId) {
        setParticipants(prev => new Set([...prev, msg.userId]));
      } else if (msg.type === 'userLeft') {
        setParticipants(prev => { const next = new Set(prev); next.delete(msg.userId); return next; });
        forestStatesRef.current.delete(msg.userId);
      }
    },
  });
  socketRef.current = socket;

  const handleColor = (next: string) => {
    stopProgram();
    setColor(next);
    sendGlobal(next, brightness);
  };

  const handleBrightness = (next: number) => {
    stopProgram();
    setBrightness(next);
    sendGlobal(color, next);
  };

  const overlayOpacity = 1 - brightness / 100;

  const btnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 6,
    border: active ? '2px solid #4a7acf' : '2px solid #333',
    background: active ? '#1a3a6a' : '#1a1a1a',
    color: disabled ? '#444' : active ? '#7ab0ff' : '#ccc',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', background: '#0f0f0e', color: '#ccc', fontFamily: 'monospace', gap: '20px', overflow: 'hidden' }}>
      <div style={{ fontSize: 13, color: '#666', letterSpacing: '0.05em' }}>LIGHT SHOW</div>

      {/* Live preview */}
      <div style={{ position: 'relative', height: 80, borderRadius: 8, background: color, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: `rgba(0,0,0,${overlayOpacity})` }} />
      </div>

      {/* Color presets */}
      <div>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 10, letterSpacing: '0.08em' }}>COLOR</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map(p => (
            <button
              key={p.color}
              onClick={() => handleColor(p.color)}
              aria-label={p.label}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: p.color,
                border: color === p.color && activeProgram === null ? '2px solid #fff' : '2px solid #333',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', cursor: 'pointer' }}>
            <input
              type="color"
              value={color}
              onChange={e => handleColor(e.target.value)}
              style={{ width: 36, height: 36, borderRadius: 6, border: '2px solid #333', cursor: 'pointer', padding: 2, background: 'none' }}
            />
            custom
          </label>
        </div>
      </div>

      {/* Brightness slider */}
      <div>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 10, letterSpacing: '0.08em' }}>
          BRIGHTNESS — {brightness}%
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={brightness}
          onChange={e => handleBrightness(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#4a7acf' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#444', marginTop: 4 }}>
          <span>dim</span>
          <span>full</span>
        </div>
      </div>

      {/* Programs */}
      <div>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 12, letterSpacing: '0.08em' }}>PROGRAMS</div>

        {/* Pulse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#888', width: 52, flexShrink: 0 }}>Pulse</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666' }}>
            A
            <input
              type="color"
              value={pulseColorA}
              onChange={e => setPulseColorA(e.target.value)}
              style={{ width: 28, height: 28, borderRadius: 4, border: '2px solid #333', cursor: 'pointer', padding: 1, background: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666' }}>
            B
            <input
              type="color"
              value={pulseColorB}
              onChange={e => setPulseColorB(e.target.value)}
              style={{ width: 28, height: 28, borderRadius: 4, border: '2px solid #333', cursor: 'pointer', padding: 1, background: 'none' }}
            />
          </label>
          <button
            onClick={() => activeProgram === 'pulse' ? stopProgram() : startPulse()}
            disabled={activeProgram === 'forest'}
            style={btnStyle(activeProgram === 'pulse', activeProgram === 'forest')}
          >
            {activeProgram === 'pulse' ? 'Stop' : 'Start'}
          </button>
        </div>

        {/* Forest */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#888', width: 52, flexShrink: 0 }}>Forest</span>
          <span style={{ fontSize: 11, color: '#555', flex: 1 }}>independent drift through greens</span>
          <button
            onClick={() => activeProgram === 'forest' ? stopProgram() : startForest(participants)}
            disabled={activeProgram === 'pulse'}
            style={btnStyle(activeProgram === 'forest', activeProgram === 'pulse')}
          >
            {activeProgram === 'forest' ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
