import { useState, useRef, useEffect, useCallback } from 'react';

// Manages Screen Wake Lock lifecycle. Pass `active` to drive acquire/release reactively.
// Automatically re-acquires on visibilitychange (browsers release the lock when tab hides).
// `supported` is false on non-secure contexts (HTTP LAN) where the API is unavailable.
export function useWakeLock(active: boolean): { acquired: boolean; supported: boolean } {
  const supported = 'wakeLock' in navigator;
  const [acquired, setAcquired] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen');
      setAcquired(true);
      sentinelRef.current.addEventListener('release', () => {
        sentinelRef.current = null;
        setAcquired(false);
      }, { once: true });
    } catch { /* unavailable: low battery, non-secure context, etc. */ }
  }, []);

  const release = useCallback(async () => {
    await sentinelRef.current?.release();
    sentinelRef.current = null;
    setAcquired(false);
  }, []);

  useEffect(() => {
    if (active) acquire(); else release();
    return () => { release(); };
  }, [active, acquire, release]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && active) acquire();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [active, acquire]);

  return { acquired, supported };
}
