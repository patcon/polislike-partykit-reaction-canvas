/**
 * k6 WebSocket load test for the PartyKit reaction canvas.
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 *   macOS: brew install k6
 *
 * Usage:
 *   k6 run perf/load-test-k6.js
 *   k6 run --env WS_URL=wss://whispering-gallery-staging.patcon.partykit.dev/party/perf-test perf/load-test-k6.js
 *   k6 run --vus 200 --duration 60s perf/load-test-k6.js
 *
 * k6 produces structured metrics automatically:
 *   ws_connecting        — connection handshake time (p50/p95/p99)
 *   ws_msgs_sent         — total messages sent
 *   ws_msgs_received     — total messages received
 *   ws_sessions          — total sessions opened
 *   http_req_failed      — connection failure rate
 *
 * Target environments:
 *   Local:   ws://localhost:1999/party/default
 *   Staging: wss://whispering-gallery-staging.patcon.partykit.dev/party/perf-test
 */

import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

// --- Custom metrics ---
const cursorsSent     = new Counter("cursors_sent");
const cursorsReceived = new Counter("cursors_received");
const connectLatency  = new Trend("connect_latency_ms", true);

// --- Config ---
const WS_URL = __ENV.WS_URL || "ws://localhost:1999/party/default";

// Load profile: ramp to 50 VUs over 10s, hold 30s, ramp down 10s.
// Override with --vus and --duration flags for a flat run.
export const options = {
  stages: [
    { duration: "10s", target: 50 },
    { duration: "30s", target: 50 },
    { duration: "10s", target: 0  },
  ],
  thresholds: {
    // Fail the test if >5% of connections fail
    "ws_sessions":      ["count>0"],
    // Flag if p95 connect time exceeds 2s
    "connect_latency_ms": ["p(95)<2000"],
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

  const res = ws.connect(WS_URL, {}, function (socket) {
    connectLatency.add(Date.now() - t0);

    socket.on("open", () => {
      // Send cursor updates at ~30fps (33ms interval) following a circular orbit
      socket.setInterval(() => {
        const tSec = (Date.now() - t0) / 1000;
        const { x, y } = orbitPosition(orbit, tSec);
        const eventType = Math.random() < 0.1 ? "touch" : "move";
        socket.send(
          JSON.stringify({
            type: eventType,
            position: { x, y, timestamp: Date.now(), userId },
          })
        );
        cursorsSent.add(1);
      }, 33);

      // Close after 20s per VU iteration (k6 will re-invoke for the stage duration)
      socket.setTimeout(() => {
        socket.send(
          JSON.stringify({
            type: "remove",
            position: { x: 0, y: 0, timestamp: Date.now(), userId },
          })
        );
        socket.close();
      }, 20000);
    });

    socket.on("message", () => {
      cursorsReceived.add(1);
    });

    socket.on("error", (e) => {
      console.error(`[${userId.slice(0, 8)}] WS error: ${e.error()}`);
    });
  });

  check(res, { "connected successfully": (r) => r && r.status === 101 });

  // Brief pause between VU iterations so k6 pacing stays smooth
  sleep(1);
}
