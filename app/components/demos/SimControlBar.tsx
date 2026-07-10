import { useEffect, useRef, useState } from "react";
import { useRoomSocket } from "../../contexts/RoomSocketContext";
import { SimulationEngine, type SimEngineState } from "../../lib/simulation/engine";
import { createSocketSink } from "../../lib/simulation/sinks/socketSink";
import { PROGRAMS } from "../../lib/simulation/programs";
import { DEFAULT_ANCHORS } from "../../utils/voteRegion";

/** User-count presets (see docs/specs/simulated-users.md). */
const USER_COUNTS = [25, 50, 100];
/** Group-count options for group-aware programs (e.g. Valence Shift). */
const GROUP_COUNTS = [1, 2, 3, 4, 5, 6, 7];
/** Fixed seed — demo motion is reproducible; the room is a random demo-<uuid>. */
const SIM_SEED = 1;

/**
 * Bottom-of-page control bar for the demo simulator: pick a program and a user
 * count, then play / pause / stop. Drives a {@link SimulationEngine} whose events
 * are sent into the current room as `simCursorBatch` messages, so 25-100 sim
 * cursors ride one socket connection. Must be rendered inside a RoomSocketProvider
 * (the demo pages give the simulator its own `sim-driver` connection).
 */
export default function SimControlBar() {
  const { send } = useRoomSocket();
  const engineRef = useRef<SimulationEngine | null>(null);
  const [programId, setProgramId] = useState(PROGRAMS[0].id);
  const [userCount, setUserCount] = useState(USER_COUNTS[0]);
  const [groupCount, setGroupCount] = useState(3);
  const [state, setState] = useState<SimEngineState>("idle");
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

  // Probe programs that gate on an external asset (e.g. recorded playback needs
  // its recording file); disable their option if the probe fails.
  useEffect(() => {
    let cancelled = false;
    for (const p of PROGRAMS) {
      if (!p.checkAvailable) continue;
      p.checkAvailable().then((ok) => {
        if (cancelled || ok) return;
        setUnavailable((prev) => new Set(prev).add(p.id));
      });
    }
    return () => { cancelled = true; };
  }, []);

  // The engine is created once per run; route it through a ref so it always
  // sends via the current socket even if `send` identity changes.
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);

  // Remove sim cursors if the bar unmounts mid-run.
  useEffect(() => () => { engineRef.current?.stop(); }, []);

  const handlePlay = () => {
    if (unavailable.has(programId)) return;
    if (state === "idle") {
      const entry = PROGRAMS.find((p) => p.id === programId) ?? PROGRAMS[0];
      engineRef.current = new SimulationEngine(
        entry.create(),
        createSocketSink((msg) => sendRef.current(msg)),
        { userCount, seed: SIM_SEED, regionAnchors: DEFAULT_ANCHORS, groupCount },
      );
      engineRef.current.play();
    } else if (state === "paused") {
      engineRef.current?.play();
    }
    setState("running");
  };

  const handlePause = () => {
    engineRef.current?.pause();
    setState("paused");
  };

  const handleStop = () => {
    engineRef.current?.stop();
    engineRef.current = null;
    setState("idle");
  };

  const active = state !== "idle";
  const selectedProgram = PROGRAMS.find((p) => p.id === programId);
  const userCountDisabled = active || Boolean(selectedProgram?.ignoresUserCount);
  const groupCountDisabled = active || !selectedProgram?.usesGroupCount;

  return (
    <div className="sim-control-bar">
      <span className="sim-control-title">Simulate</span>

      <select
        aria-label="Program"
        className="sim-control-select"
        value={programId}
        disabled={active}
        onChange={(e) => setProgramId(e.target.value)}
      >
        {PROGRAMS.map((p) => (
          <option
            key={p.id}
            value={p.id}
            disabled={unavailable.has(p.id)}
            title={unavailable.has(p.id) ? p.unavailableHint : undefined}
          >
            {p.label}{unavailable.has(p.id) ? " (unavailable)" : ""}
          </option>
        ))}
      </select>

      <select
        aria-label="Users"
        className="sim-control-select"
        value={userCount}
        disabled={userCountDisabled}
        onChange={(e) => setUserCount(Number(e.target.value))}
      >
        {USER_COUNTS.map((n) => (
          <option key={n} value={n}>{n} users</option>
        ))}
      </select>

      <select
        aria-label="Groups"
        className="sim-control-select"
        value={groupCount}
        disabled={groupCountDisabled}
        onChange={(e) => setGroupCount(Number(e.target.value))}
      >
        {GROUP_COUNTS.map((n) => (
          <option key={n} value={n}>{n} group{n === 1 ? "" : "s"}</option>
        ))}
      </select>

      {state !== "running" ? (
        <button className="sim-control-btn" onClick={handlePlay}>Play</button>
      ) : (
        <button className="sim-control-btn" onClick={handlePause}>Pause</button>
      )}
      <button className="sim-control-btn sim-control-btn--ghost" onClick={handleStop} disabled={!active}>
        Stop
      </button>

      <span className="sim-control-state">{state}</span>
    </div>
  );
}
