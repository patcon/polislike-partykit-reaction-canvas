import { useState, useRef } from "react";
import usePartySocket from "partysocket/react";
import { computeReactionRegion } from "../utils/voteRegion";
import type { ReactionRegion } from "../utils/voteRegion";

interface AdminPanelV3Props {
  room: string;
}

type RecordingMode = 'transitions' | 'positions';

export default function AdminPanelV3({ room }: AdminPanelV3Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<RecordingMode>('transitions');
  const [eventCount, setEventCount] = useState(0);
  const [serverRecording, setServerRecording] = useState(false);

  const eventsRef = useRef<object[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const prevRegionsRef = useRef<Map<string, ReactionRegion | null>>(new Map());
  const isRecordingRef = useRef(false);
  const modeRef = useRef<RecordingMode>('transitions');

  // Keep refs in sync with state so the socket handler can access current values
  // without stale closures
  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room,
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'recordingStateChanged') {
          setServerRecording(data.recording);
          return;
        }

        if (data.type === 'connected' && data.recordingState !== undefined) {
          setServerRecording(data.recordingState);
          return;
        }

        if (!isRecordingRef.current) return;

        const now = Date.now();

        if (data.type === 'move' || data.type === 'touch') {
          const { userId: connectionId, x, y } = data.position;

          if (modeRef.current === 'positions') {
            eventsRef.current.push({ connectionId, type: data.type, x, y, timestamp: now });
            setEventCount(c => c + 1);
          } else {
            // transitions mode
            const newRegion = computeReactionRegion(x, y);
            const prevRegion = prevRegionsRef.current.get(connectionId) ?? null;
            if (newRegion !== prevRegion) {
              eventsRef.current.push({ connectionId, from: prevRegion, to: newRegion, timestamp: now });
              setEventCount(c => c + 1);
              prevRegionsRef.current.set(connectionId, newRegion);
            }
          }
        }

        if (data.type === 'remove') {
          const { userId: connectionId } = data.position;

          if (modeRef.current === 'transitions') {
            const prevRegion = prevRegionsRef.current.get(connectionId) ?? null;
            if (prevRegion !== null) {
              eventsRef.current.push({ connectionId, from: prevRegion, to: null, timestamp: now });
              setEventCount(c => c + 1);
            }
            prevRegionsRef.current.set(connectionId, null);
          } else {
            eventsRef.current.push({ connectionId, type: 'remove', x: 0, y: 0, timestamp: now });
            setEventCount(c => c + 1);
          }
        }
      } catch (e) {
        console.error('AdminPanelV3: failed to parse message', e);
      }
    },
  });

  const startRecording = () => {
    eventsRef.current = [];
    prevRegionsRef.current = new Map();
    recordingStartRef.current = Date.now();
    setEventCount(0);
    setIsRecording(true);
    isRecordingRef.current = true;
    socket.send(JSON.stringify({ type: 'setRecordingState', recording: true }));
  };

  const stopAndDownload = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    socket.send(JSON.stringify({ type: 'setRecordingState', recording: false }));

    const payload = {
      recordingStart: recordingStartRef.current,
      recordingEnd: Date.now(),
      room,
      mode,
      events: eventsRef.current,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reactions-${room}-${new Date(recordingStartRef.current!).toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleModeChange = (newMode: RecordingMode) => {
    setMode(newMode);
    modeRef.current = newMode;
  };

  return (
    <div className="v3-admin-panel">
      <h1>Reaction Canvas V3 — Admin</h1>
      <p style={{ marginTop: 8, color: '#aaa' }}>Room: <strong style={{ color: '#eee' }}>{room}</strong></p>

      <div style={{ marginTop: 32 }}>
        <p style={{ marginBottom: 12, fontWeight: 600 }}>Recording mode:</p>
        <label style={{ display: 'block', marginBottom: 8, cursor: isRecording ? 'not-allowed' : 'pointer' }}>
          <input
            type="radio"
            name="mode"
            value="transitions"
            checked={mode === 'transitions'}
            disabled={isRecording}
            onChange={() => handleModeChange('transitions')}
            style={{ marginRight: 8 }}
          />
          Transitions — log only when a cursor changes vote region
        </label>
        <label style={{ display: 'block', cursor: isRecording ? 'not-allowed' : 'pointer' }}>
          <input
            type="radio"
            name="mode"
            value="positions"
            checked={mode === 'positions'}
            disabled={isRecording}
            onChange={() => handleModeChange('positions')}
            style={{ marginRight: 8 }}
          />
          Raw positions — log every move/touch/remove event
        </label>
      </div>

      <div style={{ marginTop: 32 }}>
        {!isRecording ? (
          <button className="v3-admin-btn v3-admin-btn-record" onClick={startRecording}>
            ● Start Recording
          </button>
        ) : (
          <button className="v3-admin-btn v3-admin-btn-stop" onClick={stopAndDownload}>
            ■ Stop &amp; Download
          </button>
        )}
      </div>

      <div style={{ marginTop: 24, color: '#aaa' }}>
        Status:{' '}
        {isRecording
          ? <span style={{ color: '#f55', fontWeight: 700 }}>RECORDING — {eventCount} events logged</span>
          : <span>Not recording</span>
        }
      </div>

      <div style={{ marginTop: 8, color: '#aaa', fontSize: 13 }}>
        Server broadcast:{' '}
        {serverRecording
          ? <span style={{ color: '#f55' }}>REC active (participants see badge)</span>
          : <span>inactive</span>
        }
      </div>
    </div>
  );
}
