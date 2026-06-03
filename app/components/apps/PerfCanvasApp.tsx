import { useState, useRef } from "react";
import Canvas from "../shared/Canvas";
import TouchLayer from "../shared/TouchLayer";
import { getPersistentUserId } from "../../utils/userId";

const SLIDER_STYLE: React.CSSProperties = { width: 80 };
const LABEL_STYLE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' };
const DIVIDER_STYLE: React.CSSProperties = { borderTop: '1px solid rgba(255,255,255,0.1)', margin: '2px 0' };

// Quadratic ease-in scaling: cheap at low counts, progressively more throttling near capacity.
function computeThrottleMs(count: number, base: number, scaleStart: number, scaleEnd: number, max: number): number {
  if (count <= scaleStart) return base;
  if (count >= scaleEnd) return max;
  const t = (count - scaleStart) / (scaleEnd - scaleStart);
  return Math.round(base + (max - base) * t * t);
}

function getRoomFromUrl(): string {
  return new URLSearchParams(window.location.search).get("room") ?? "perf-default";
}

/**
 * Minimal canvas app wired to the stripped-down perf party server.
 * No statement panel, no admin controls, no labels — just cursor broadcast.
 * Use this with the load test scripts to assess peak performance.
 *
 * URL: /#perf
 * URL params: ?room=<name>
 */
export default function PerfCanvasApp() {
  const [userId] = useState(() => getPersistentUserId());
  const [presenceCount, setPresenceCount] = useState(0);
  const reactionStateRef = useRef<'positive' | 'negative' | 'neutral' | null>(null);
  const room = getRoomFromUrl();

  const [springEnabled, setSpringEnabled] = useState(false);
  const [stiffness, setStiffness] = useState(0.12);
  const [damping, setDamping] = useState(0.75);
  const [mass, setMass] = useState(1);
  const [showActual, setShowActual] = useState(false);
  const [showSpring, setShowSpring] = useState(true);

  const springConfig = springEnabled ? { stiffness, damping, mass, showSpring } : undefined;

  const [throttleEnabled, setThrottleEnabled] = useState(false);
  const [throttleBase, setThrottleBase] = useState(50);
  const [throttleScaleStart, setThrottleScaleStart] = useState(100);
  const [throttleScaleEnd, setThrottleScaleEnd] = useState(600);
  const [throttleMax, setThrottleMax] = useState(250);

  const throttleMs = throttleEnabled
    ? computeThrottleMs(presenceCount, throttleBase, throttleScaleStart, throttleScaleEnd, throttleMax)
    : 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh", background: "#111", overflow: "hidden" }}>
      <Canvas
        party="perf"
        room={room}
        userId={userId}
        onPresenceCount={setPresenceCount}
        disableBackgroundValence
        springConfig={springConfig}
        hideCursors={springEnabled && !showActual}
      />
      <TouchLayer
        party="perf"
        room={room}
        userId={userId}
        onActiveStatementChange={() => {}}
        onReactionStateChange={() => {}}
        onBackgroundColorChange={() => {}}
        reactionStateRef={reactionStateRef}
        throttleMs={throttleMs}
      />
      <div style={{
        position: "absolute", top: 12, left: 0, right: 0,
        textAlign: "center", color: "rgba(255,255,255,0.4)",
        fontSize: 13, fontFamily: "monospace", pointerEvents: "none",
      }}>
        perf room: {room} · {presenceCount} connected
      </div>
      <div style={{
        position: "absolute", top: 12, right: 12,
        background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8, padding: "10px 14px",
        display: "flex", flexDirection: "column", gap: 8,
        fontFamily: "monospace", zIndex: 10,
      }}>
        <label style={LABEL_STYLE}>
          <input type="checkbox" checked={springEnabled} onChange={e => setSpringEnabled(e.target.checked)} />
          spring cursors
        </label>
        {springEnabled && (
          <>
            <label style={LABEL_STYLE}>
              <input type="checkbox" checked={showActual} onChange={e => setShowActual(e.target.checked)} />
              show actual
            </label>
            <label style={LABEL_STYLE}>
              <input type="checkbox" checked={showSpring} onChange={e => setShowSpring(e.target.checked)} />
              show spring
            </label>
            <label style={LABEL_STYLE}>
              stiffness
              <input type="range" min={0.01} max={0.5} step={0.01} value={stiffness}
                onChange={e => setStiffness(Number(e.target.value))} style={SLIDER_STYLE} />
              {stiffness.toFixed(2)}
            </label>
            <label style={LABEL_STYLE}>
              damping
              <input type="range" min={0.1} max={0.99} step={0.01} value={damping}
                onChange={e => setDamping(Number(e.target.value))} style={SLIDER_STYLE} />
              {damping.toFixed(2)}
            </label>
            <label style={LABEL_STYLE}>
              mass
              <input type="range" min={0.1} max={5} step={0.1} value={mass}
                onChange={e => setMass(Number(e.target.value))} style={SLIDER_STYLE} />
              {mass.toFixed(1)}
            </label>
          </>
        )}
        <div style={DIVIDER_STYLE} />
        <label style={LABEL_STYLE}>
          <input type="checkbox" checked={throttleEnabled} onChange={e => setThrottleEnabled(e.target.checked)} />
          adaptive throttle
          {throttleEnabled && <span style={{ color: 'rgba(255,255,255,0.4)' }}>· {throttleMs}ms</span>}
        </label>
        {throttleEnabled && (
          <>
            <label style={LABEL_STYLE}>
              base
              <input type="range" min={0} max={200} step={5} value={throttleBase}
                onChange={e => setThrottleBase(Number(e.target.value))} style={SLIDER_STYLE} />
              {throttleBase}ms
            </label>
            <label style={LABEL_STYLE}>
              scale from
              <input type="range" min={0} max={500} step={10} value={throttleScaleStart}
                onChange={e => setThrottleScaleStart(Number(e.target.value))} style={SLIDER_STYLE} />
              {throttleScaleStart}
            </label>
            <label style={LABEL_STYLE}>
              scale to
              <input type="range" min={50} max={1000} step={10} value={throttleScaleEnd}
                onChange={e => setThrottleScaleEnd(Number(e.target.value))} style={SLIDER_STYLE} />
              {throttleScaleEnd}
            </label>
            <label style={LABEL_STYLE}>
              max
              <input type="range" min={50} max={500} step={10} value={throttleMax}
                onChange={e => setThrottleMax(Number(e.target.value))} style={SLIDER_STYLE} />
              {throttleMax}ms
            </label>
          </>
        )}
      </div>
    </div>
  );
}
