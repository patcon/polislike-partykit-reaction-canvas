import { useState, useEffect, useRef, useCallback } from "react";
import { WebHaptics } from "web-haptics";

export function useHapticPriming() {
  const [hapticEnabled, setHapticEnabled] = useState(WebHaptics.isSupported);
  const [vibrationPrimed, setVibrationPrimed] = useState(!WebHaptics.isSupported);
  const hapticWasUnprimedRef = useRef(false);

  // Android Chrome gates navigator.vibrate() on prior user interaction. Prime it
  // on first touch so socket-triggered buzzes work without needing a manual toggle.
  useEffect(() => {
    if (!WebHaptics.isSupported) return;
    const prime = () => {
      navigator.vibrate(0);
      setVibrationPrimed(true);
    };
    document.addEventListener('touchstart', prime, { once: true });
    return () => document.removeEventListener('touchstart', prime);
  }, []);

  // Capture whether the button was unprimed at pointerdown (before touchstart fires),
  // so the click handler can skip the toggle when the first touch lands on the icon.
  const onPointerDown = useCallback(() => {
    hapticWasUnprimedRef.current = !vibrationPrimed;
  }, [vibrationPrimed]);

  const onToggle = useCallback(() => {
    if (!WebHaptics.isSupported) return;
    if (hapticWasUnprimedRef.current) {
      hapticWasUnprimedRef.current = false;
    } else {
      setHapticEnabled(prev => !prev);
    }
  }, []);

  return {
    hapticEnabled,
    effectivelyEnabled: hapticEnabled && vibrationPrimed,
    onPointerDown,
    onToggle,
  };
}
