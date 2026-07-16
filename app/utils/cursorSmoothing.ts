export interface CursorSmoothingConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface SmoothedPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Advances a spring-damper toward each target position, one step per call —
 * fixed-step (assumes ~60fps, called once per requestAnimationFrame tick),
 * same as the original inline loop this was extracted from in CursorField.
 * Mutates `state` in place: prunes entries whose target has disappeared, and
 * seeds new entries at the target position (no pop-in from the origin).
 */
export function stepCursorSmoothing(
  state: Map<string, SmoothedPoint>,
  targets: Map<string, { x: number; y: number }>,
  config: CursorSmoothingConfig,
): void {
  for (const id of state.keys()) {
    if (!targets.has(id)) state.delete(id);
  }

  const { stiffness, damping, mass } = config;
  for (const [id, target] of targets) {
    let s = state.get(id);
    if (!s) {
      s = { x: target.x, y: target.y, vx: 0, vy: 0 };
      state.set(id, s);
    }
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    s.vx = s.vx * damping + (dx * stiffness) / mass;
    s.vy = s.vy * damping + (dy * stiffness) / mass;
    s.x += s.vx;
    s.y += s.vy;
  }
}
