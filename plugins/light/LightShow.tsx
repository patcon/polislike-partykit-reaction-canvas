import { useState, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import { usePanelContext } from '../../app/context/PanelContext';
import { getPartySocketConfig } from '../../app/utils/partyHost';

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
  const socketRef = useRef<ReturnType<typeof usePartySocket> | null>(null);

  const sendLight = (nextColor: string, nextBrightness: number) => {
    socketRef.current?.send(JSON.stringify({ type: 'setLightColor', color: nextColor, brightness: nextBrightness }));
  };

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'screenLightState') {
        setColor(msg.color);
        setBrightness(msg.brightness);
      }
    },
  });
  socketRef.current = socket;

  const handleColor = (next: string) => {
    setColor(next);
    sendLight(next, brightness);
  };

  const handleBrightness = (next: number) => {
    setBrightness(next);
    sendLight(color, next);
  };

  const overlayOpacity = 1 - brightness / 100;

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
                border: color === p.color ? '2px solid #fff' : '2px solid #333',
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
    </div>
  );
}
