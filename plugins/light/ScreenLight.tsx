import { useState } from 'react';
import { useWakeLock } from '../../app/utils/useWakeLock';
import WakeLockIndicatorButton from '../../app/components/shared/WakeLockIndicatorButton';
import { useMessageSubscription } from '../../app/contexts/RoomSocketContext';

export default function ScreenLight() {
  const [color, setColor] = useState('#000000');
  const [brightness, setBrightness] = useState(100);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(true);
  const { acquired: wakeLockAcquired } = useWakeLock(wakeLockEnabled);

  useMessageSubscription((evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'screenLightState' || msg.type === 'lightColor') {
      setColor(msg.color);
      setBrightness(msg.brightness);
    }
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
