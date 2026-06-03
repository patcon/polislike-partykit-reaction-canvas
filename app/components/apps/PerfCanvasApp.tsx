import { useState, useRef } from "react";
import Canvas from "../shared/Canvas";
import TouchLayer from "../shared/TouchLayer";
import { getPersistentUserId } from "../../utils/userId";

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

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh", background: "#111", overflow: "hidden" }}>
      <Canvas
        party="perf"
        room={room}
        userId={userId}
        onPresenceCount={setPresenceCount}
        disableBackgroundValence
      />
      <TouchLayer
        party="perf"
        room={room}
        userId={userId}
        onActiveStatementChange={() => {}}
        onReactionStateChange={() => {}}
        onBackgroundColorChange={() => {}}
        reactionStateRef={reactionStateRef}
      />
      <div style={{
        position: "absolute", top: 12, left: 0, right: 0,
        textAlign: "center", color: "rgba(255,255,255,0.4)",
        fontSize: 13, fontFamily: "monospace", pointerEvents: "none",
      }}>
        perf room: {room} · {presenceCount} connected
      </div>
    </div>
  );
}
