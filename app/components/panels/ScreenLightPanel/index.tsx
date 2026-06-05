import { useState } from 'react';
import usePartySocket from 'partysocket/react';
import { usePanelContext } from '../../../context/PanelContext';
import { getPartySocketConfig } from '../../../utils/partyHost';
import { useWakeLock } from '../../../utils/useWakeLock';
import WakeLockIndicatorButton from '../../shared/WakeLockIndicatorButton';

export default function ScreenLightPanel() {
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
      if (msg.type === 'connected' && msg.lightColor) {
        setColor(msg.lightColor.color);
        setBrightness(msg.lightColor.brightness);
      } else if (msg.type === 'lightColor') {
        setColor(msg.color);
        setBrightness(msg.brightness);
      }
    },
  });

  // brightness as a dimmer: 0% = pure black overlay, 100% = no overlay
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
