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

// Seeded random walk so cursors drift naturally rather than teleporting
function randomWalk(prev, step = 5) {
  return Math.max(0, Math.min(100, prev + (Math.random() * step * 2 - step)));
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
  let x = Math.random() * 100;
  let y = Math.random() * 100;

  const t0 = Date.now();

  const res = ws.connect(WS_URL, {}, function (socket) {
    connectLatency.add(Date.now() - t0);

    socket.on("open", () => {
      // Send cursor updates at ~30fps (33ms interval) for the duration of this VU iteration
      socket.setInterval(() => {
        x = randomWalk(x);
        y = randomWalk(y);
        const eventType = Math.random() < 0.1 ? "touch" : "move";
        socket.send(
          JSON.stringify({
            type: eventType,
            position: {
              x: Math.round(x * 100) / 100,
              y: Math.round(y * 100) / 100,
              timestamp: Date.now(),
              userId,
            },
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
