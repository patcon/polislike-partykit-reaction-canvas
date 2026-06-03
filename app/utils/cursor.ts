// ~30fps: smooth for cursor tracking, half the bandwidth of 60fps.
// All cursor-sending surfaces (TouchLayer, PerfCanvasApp) use this as the
// base throttle. The k6 load test mirrors this value so perf results
// reflect real client behaviour.
export const CURSOR_THROTTLE_MS = 33;

// Spring cursor smoothing — applied in the main app and perf app.
// Tune these values in PerfCanvasApp's debug UI, then update here.
export const SPRING_CURSOR_ENABLED = true;
export const SPRING_CONFIG = {
  stiffness: 0.12,
  damping: 0.75,
  mass: 1,
};
