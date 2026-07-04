import { useEffect, useRef, useState } from "react";
import { useRoomSocket } from "../../contexts/RoomSocketContext";
import { SimulationEngine, type SimEngineState } from "../../lib/simulation/engine";
import { createSocketSink } from "../../lib/simulation/sinks/socketSink";
import { PROGRAMS } from "../../lib/simulation/programs";
import { DEFAULT_ANCHORS } from "../../utils/voteRegion";

/** User-count presets (see docs/specs/simulated-users.md). */
const USER_COUNTS = [25, 50, 100];
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
  const [state, setState] = useState<SimEngineState>("idle");

  // The engine is created once per run; route it through a ref so it always
  // sends via the current socket even if `send` identity changes.
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);

  // Remove sim cursors if the bar unmounts mid-run.
  useEffect(() => () => { engineRef.current?.stop(); }, []);

  const handlePlay = () => {
    if (state === "idle") {
      const entry = PROGRAMS.find((p) => p.id === programId) ?? PROGRAMS[0];
      engineRef.current = new SimulationEngine(
        entry.create(),
        createSocketSink((msg) => sendRef.current(msg)),
        { userCount, seed: SIM_SEED, regionAnchors: DEFAULT_ANCHORS },
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
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      <select
        aria-label="Users"
        className="sim-control-select"
        value={userCount}
        disabled={active}
        onChange={(e) => setUserCount(Number(e.target.value))}
      >
        {USER_COUNTS.map((n) => (
          <option key={n} value={n}>{n} users</option>
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
