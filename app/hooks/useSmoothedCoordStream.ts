import { useEffect, useRef } from 'react';
import type { CoordStreamResult } from './useCoordStream';
import { stepCursorSmoothing } from '../utils/cursorSmoothing';
import type { CursorSmoothingConfig, SmoothedPoint } from '../utils/cursorSmoothing';

/**
 * Wraps any CoordStreamResult (useCoordStream or useRawCoordStream) with a
 * spring-damper smoothing pass, so consumers get eased motion between network
 * updates instead of the raw step-changes that arrive every
 * CURSOR_THROTTLE_MS/SERVER_CURSOR_BATCH_MS. Same spring math CursorField
 * uses for its smooth-cursor overlay (see app/utils/cursorSmoothing.ts),
 * extracted so other live-cursor consumers (e.g. the particleField panel and
 * its live Storybook story) can reuse it without duplicating the physics.
 */
export function useSmoothedCoordStream(
  raw: CoordStreamResult,
  smoothing: CursorSmoothingConfig,
): CoordStreamResult {
  const smoothedRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const stateRef = useRef<Map<string, SmoothedPoint>>(new Map());
  const smoothingRef = useRef(smoothing);
  smoothingRef.current = smoothing;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      stepCursorSmoothing(stateRef.current, raw.positionsRef.current, smoothingRef.current);
      const out = smoothedRef.current;
      out.clear();
      for (const [id, s] of stateRef.current) out.set(id, { x: s.x, y: s.y });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [raw.positionsRef]);

  return { positionsRef: smoothedRef, status: raw.status, connectedRef: raw.connectedRef };
}
