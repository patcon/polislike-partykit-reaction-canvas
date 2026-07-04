#!/usr/bin/env node

// Shrink a cursor recording (emcee PlaybackFile / mode "positions") for use as a
// Recorded-playback sample. Crops to a time window, thins redundant events, remaps
// long connectionId UUIDs to short ids, and rounds coordinates — all lossless at
// playback resolution (the sim engine ticks at SIM_TICK_MS=50ms; a <3s stale
// timeout keeps held-still cursors alive with a 2s heartbeat).
//
// Usage:
//   node scripts/thin-recording.js <input.json> <output.json> [options]
//
// Options:
//   --start=SEC        crop start (seconds from recording start; default 0)
//   --end=SEC          crop end   (seconds; default = end of recording)
//   --round=N          round x/y to N decimals (default 2; try 1 for more savings)
//   --throttle=MS      drop positional events closer than MS to the last kept (default 50)
//   --heartbeat=MS     force-keep a stationary cursor at least this often (default 2000)
//   --eps=U            movement threshold in canvas units to count as "moved" (default 0.5)
//   --keep-ids         do NOT remap connectionIds to short ids (default: remap)
//
// Example (reproduce the shipped sample):
//   node scripts/thin-recording.js ~/Downloads/session.json public/sim-recordings/sample.json --start=885 --end=975

const fs = require('fs');

function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) opt[m[1]] = m[2] === undefined ? true : m[2];
    else pos.push(a);
  }
  return { pos, opt };
}

const { pos, opt } = parseArgs(process.argv.slice(2));
if (pos.length < 2) {
  console.error('usage: node scripts/thin-recording.js <input.json> <output.json> [options] (see header)');
  process.exit(1);
}

const [inputPath, outputPath] = pos;
const round = opt.round !== undefined ? Number(opt.round) : 2;
const throttle = opt.throttle !== undefined ? Number(opt.throttle) : 50;
const heartbeat = opt.heartbeat !== undefined ? Number(opt.heartbeat) : 2000;
const eps = opt.eps !== undefined ? Number(opt.eps) : 0.5;
const remapIds = !opt['keep-ids'];

const POS_TYPES = new Set(['move', 'touch']);
const src = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const origin = src.recordingStart ?? 0;
const startMs = origin + (opt.start !== undefined ? Number(opt.start) * 1000 : 0);
const endMs = opt.end !== undefined ? origin + Number(opt.end) * 1000 : (src.recordingEnd ?? Infinity);

// 1. Crop to the window and rebase timestamps to 0.
const cropped = src.events
  .filter((e) => e.timestamp >= startMs && e.timestamp <= endMs)
  .map((e) => ({ ...e, timestamp: e.timestamp - startMs }));

// 2. Remap connectionIds to short sequential ids (order of first appearance).
const idMap = new Map();
const shortId = (cid) => {
  if (!remapIds) return cid;
  if (!idMap.has(cid)) idMap.set(cid, String(idMap.size));
  return idMap.get(cid);
};

// 3. Thin per user: throttle sub-tick events, then keep on movement or heartbeat.
//    Control events (arrival/remove/departure) are always kept.
const byConn = new Map();
for (const e of cropped) {
  if (!byConn.has(e.connectionId)) byConn.set(e.connectionId, []);
  byConn.get(e.connectionId).push(e);
}
const r = (n) => Number(n.toFixed(round));
const kept = [];
for (const [, events] of byConn) {
  let last = null;
  for (const e of events) {
    const out = { connectionId: shortId(e.connectionId), type: e.type, timestamp: e.timestamp };
    if (!POS_TYPES.has(e.type) || e.x == null) { kept.push(out); continue; }
    if (last) {
      const dt = e.timestamp - last.timestamp;
      const moved = Math.hypot(e.x - last.x, e.y - last.y) > eps;
      if (dt < throttle) continue;                 // sub-tick — collapses on playback anyway
      if (!moved && dt < heartbeat) continue;      // stationary within the heartbeat window
    }
    out.x = r(e.x);
    out.y = r(e.y);
    kept.push(out);
    last = e; // compare movement against last *kept* (captures slow drift correctly)
  }
}
kept.sort((a, b) => a.timestamp - b.timestamp);

const out = {
  recordingStart: 0,
  recordingEnd: endMs === Infinity ? (src.recordingEnd - startMs) : (endMs - startMs),
  room: src.room,
  mode: src.mode,
  events: kept,
};
fs.writeFileSync(outputPath, JSON.stringify(out));

const inBytes = fs.statSync(inputPath).size;
const outBytes = fs.statSync(outputPath).size;
const pct = (a, b) => (100 - (100 * b) / a).toFixed(0);
console.log(`events: ${src.events.length} -> ${kept.length} (${pct(src.events.length, kept.length)}% cut)`);
console.log(`bytes:  ${inBytes} -> ${outBytes} (~${(outBytes / 1024).toFixed(0)} KB, ${pct(inBytes, outBytes)}% smaller)`);
console.log(`users:  ${byConn.size}${remapIds ? ' (remapped to sim_0..sim_' + (byConn.size - 1) + ')' : ''}`);
