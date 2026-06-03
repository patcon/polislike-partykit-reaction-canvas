/**
 * k6 WebSocket load test for the PartyKit reaction canvas.
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 *   macOS: brew install k6
 *
 * Usage:
 *   k6 run perf/load-test-k6.js
 *   k6 run --env WS_URL=wss://perf.whispering-gallery.patcon.partykit.dev/parties/perf/perf-default perf/load-test-k6.js
 *   k6 run --vus 200 --duration 60s perf/load-test-k6.js
 *
 * Adaptive throttle (mirrors PerfCanvasApp logic):
 *   k6 run --env ADAPTIVE_THROTTLE=true perf/load-test-k6.js
 *   k6 run --env ADAPTIVE_THROTTLE=true \
 *          --env THROTTLE_BASE=50 \
 *          --env THROTTLE_SCALE_START=300 \
 *          --env THROTTLE_SCALE_END=400 \
 *          --env THROTTLE_MAX=250 \
 *          perf/load-test-k6.js
 *
 * k6 produces structured metrics automatically:
 *   ws_connecting        — connection handshake time (p50/p95/p99)
 *   ws_msgs_sent         — total messages sent
 *   ws_msgs_received     — total messages received
 *   ws_sessions          — total sessions opened
 *   http_req_failed      — connection failure rate
 *
 * Target environments:
 *   Local: ws://localhost:1999/parties/perf/perf-default
 *   Perf:  wss://perf.whispering-gallery.patcon.partykit.dev/parties/perf/perf-default
 */

import { sleep } from "k6";
import { WebSocket } from "k6/websockets";
import { Counter, Rate, Trend } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// --- Custom metrics ---
const cursorsSent       = new Counter("cursors_sent");
const cursorsReceived   = new Counter("cursors_received");  // cursor events only, not presenceCount
const connectLatency    = new Trend("connect_latency_ms", true);
const deliveryLatency   = new Trend("cursor_delivery_ms", true);  // sender → server batch → back to sender
const connectionSuccess = new Rate("connection_success");

// --- Config ---
const WS_URL = __ENV.WS_URL || "ws://localhost:1999/parties/perf/perf-default";

// Adaptive throttle — mirrors PerfCanvasApp/TouchLayer logic.
// Each VU tracks the server-broadcast presenceCount and scales its send
// interval using the same quadratic ease-in curve as the real client.
const ADAPTIVE_THROTTLE   = (__ENV.ADAPTIVE_THROTTLE || "false") === "true";
const THROTTLE_BASE       = parseInt(__ENV.THROTTLE_BASE        || "50",  10); // ms at low counts
const THROTTLE_SCALE_START= parseInt(__ENV.THROTTLE_SCALE_START || "300", 10); // connections
const THROTTLE_SCALE_END  = parseInt(__ENV.THROTTLE_SCALE_END   || "400", 10); // connections
const THROTTLE_MAX        = parseInt(__ENV.THROTTLE_MAX         || "250", 10); // ms at high counts

// Quadratic ease-in: cheap at low counts, accelerating near capacity.
// Mirrors CURSOR_THROTTLE_MS in app/utils/cursor.ts — keep in sync.
const CURSOR_THROTTLE_MS = 33;

function computeThrottleMs(count) {
  if (!ADAPTIVE_THROTTLE)              return CURSOR_THROTTLE_MS;
  if (count <= THROTTLE_SCALE_START)   return THROTTLE_BASE;
  if (count >= THROTTLE_SCALE_END)     return THROTTLE_MAX;
  const t = (count - THROTTLE_SCALE_START) / (THROTTLE_SCALE_END - THROTTLE_SCALE_START);
  return Math.round(THROTTLE_BASE + (THROTTLE_MAX - THROTTLE_BASE) * t * t);
}

// Load profile: ramp to 100 VUs over 10s, hold 30s, ramp down 10s.
// Override with --vus and --duration flags for a flat run.
export const options = {
  stages: [
    { duration: "10s", target: 100 },
    { duration: "30s", target: 100 },
    { duration: "10s", target: 0   },
  ],
  thresholds: {
    // At least 95% of connections must succeed
    "connection_success":  ["rate>0.95"],
    // Flag if p95 connect time exceeds 2s
    "connect_latency_ms":  ["p(95)<2000"],
    // Flag if p95 end-to-end cursor delivery exceeds 500ms
    // (sender → 50ms server batch → broadcast → back to sender; one-way ≈ half this)
    "cursor_delivery_ms":  ["p(95)<500"],
  },
};

// Circular orbit — deterministic position given elapsed time
function makeOrbit() {
  const r  = 5 + Math.random() * 25;           // radius 5–30% of canvas
  const cx = r + Math.random() * (100 - 2 * r); // center stays on canvas
  const cy = r + Math.random() * (100 - 2 * r);
  const omega = (0.3 + Math.random() * 1.2) * 2 * Math.PI; // 0.3–1.5 rps (rapid thumb on touchscreen)
  const phase = Math.random() * 2 * Math.PI;
  return { cx, cy, r, omega, phase };
}

function orbitPosition(orbit, tSec) {
  const angle = orbit.omega * tSec + orbit.phase;
  return {
    x: Math.round((orbit.cx + orbit.r * Math.cos(angle)) * 100) / 100,
    y: Math.round((orbit.cy + orbit.r * Math.sin(angle)) * 100) / 100,
  };
}

function generateUserId() {
  // Math.random fallback — matches generateUUID() in app/utils/userId.ts
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function () {
  const userId = generateUserId();
  const orbit  = makeOrbit();
  const t0     = Date.now();

  // Stagger close time 18–22s to avoid synchronized reconnect storms across VUs
  const closeAfterMs = 18000 + Math.random() * 4000;

  let presenceCount = 0;
  let lastSent = 0;
  let opened = false;

  const socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    connectLatency.add(Date.now() - t0);
    opened = true;
    connectionSuccess.add(true);

    // Poll at 10ms; actual send rate is governed by computeThrottleMs(presenceCount).
    // When adaptive throttle is off, computeThrottleMs returns 33ms (~30 fps).
    const sendInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastSent < computeThrottleMs(presenceCount)) return;
      lastSent = now;

      const tSec = (now - t0) / 1000;
      const { x, y } = orbitPosition(orbit, tSec);
      const eventType = Math.random() < 0.1 ? "touch" : "move";
      socket.send(
        JSON.stringify({
          type: eventType,
          position: { x, y, timestamp: now, userId },
        })
      );
      cursorsSent.add(1);
    }, 10);

    setTimeout(() => {
      clearInterval(sendInterval);
      socket.send(
        JSON.stringify({
          type: "remove",
          position: { x: 0, y: 0, timestamp: Date.now(), userId },
        })
      );
      socket.close();
    }, closeAfterMs);
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "presenceCount") {
        presenceCount = msg.count;
      } else if (msg.type === "cursorBatch" && Array.isArray(msg.cursors)) {
        // Count only cursor events, not presenceCount broadcasts
        cursorsReceived.add(msg.cursors.length);
        // Measure end-to-end delivery latency for our own cursor echoed back
        const now = Date.now();
        for (const event of msg.cursors) {
          if (event.position?.userId === userId && event.position?.timestamp) {
            deliveryLatency.add(now - event.position.timestamp);
          }
        }
      }
    } catch (_) {}
  };

  socket.onerror = (e) => {
    console.error(`[${userId.slice(0, 8)}] WS error: ${e.message}`);
  };

  socket.onclose = () => {
    if (!opened) connectionSuccess.add(false);
  };

  // Keep VU alive while the socket is open; extra 2s for graceful close handshake
  sleep((closeAfterMs + 2000) / 1000);
}

export function handleSummary(data) {
  const sent     = data.metrics.cursors_sent?.values?.count     || 0;
  const received = data.metrics.cursors_received?.values?.count || 0;
  const fanout   = sent > 0 ? (received / sent).toFixed(2) : "N/A";

  const summary = textSummary(data, { indent: " ", enableColors: true });
  return {
    stdout: summary + `\n Cursor fanout ratio: ${fanout}x (cursors_received / cursors_sent — expected ≈ VU count)\n`,
  };
}
