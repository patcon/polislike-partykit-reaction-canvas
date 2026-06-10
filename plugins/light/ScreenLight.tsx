import { useState } from 'react';
import usePartySocket from 'partysocket/react';
import { usePanelContext } from '../../app/context/PanelContext';
import { getPartySocketConfig } from '../../app/utils/partyHost';
import { useWakeLock } from '../../app/utils/useWakeLock';
import WakeLockIndicatorButton from '../../app/components/shared/WakeLockIndicatorButton';

export default function ScreenLight() {
  const { room, userId } = usePanelContext();
  const [color, setColor] = useState('#000000');
  const [brightness, setBrightness] = useState(100);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(true);
  const { acquired: wakeLockAcquired } = useWakeLock(wakeLockEnabled);

  usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage(evt) {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'setBatchScreenLight') {
        if (msg.mode === 'global') {
          setColor(msg.color);
          setBrightness(msg.brightness);
        } else if (msg.mode === 'perParticipant' && msg.colors?.[userId]) {
          // Each ScreenLight only applies the entry for its own userId; other entries are ignored.
          setColor(msg.colors[userId].color);
          setBrightness(msg.colors[userId].brightness);
        }
      }
    },
  });

  const overlayOpacity = 1 - brightness / 100;

  return (
    <div className="screen-light-panel" style={{ flex: 1, position: 'relative', background: color }}>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})`, pointerEvents: 'none' }} />
      <WakeLockIndicatorButton
        enabled={wakeLockEnabled}
        active={wakeLockAcquired}
        onToggle={() => setWakeLockEnabled(prev => !prev)}
      />
    </div>
  );
}
