// ~30fps: smooth for cursor tracking, half the bandwidth of 60fps.
// All cursor-sending surfaces (TouchLayer, PerfCanvasApp) use this as the
// base throttle. The k6 load test mirrors this value so perf results
// reflect real client behaviour.
export const CURSOR_THROTTLE_MS = 33;
