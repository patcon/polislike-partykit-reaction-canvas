// ~30fps: smooth for cursor tracking, half the bandwidth of 60fps.
// All cursor-sending surfaces (TouchLayer, PerfCanvasApp) use this as the
// base throttle. The k6 load test mirrors this value so perf results
// reflect real client behaviour.
export const CURSOR_THROTTLE_MS = 33;

// Server-side batching window in ms. The server coalesces cursor events within
// this window into a single cursorBatch broadcast. Set to 0 to disable batching
// and broadcast each event immediately (useful for perf comparison).
export const SERVER_CURSOR_BATCH_MS = 50;

// Smooth cursor config — applied in the main app and perf app.
// Tune these values in PerfCanvasApp's debug UI, then update here.
export const SMOOTH_CURSOR_ENABLED = true;
export const SMOOTH_CURSOR_CONFIG = {
  stiffness: 0.12,
  damping: 0.5,
  mass: 1,
};
