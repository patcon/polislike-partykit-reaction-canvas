import { useState, useRef } from "react";
import { computeReactionRegion } from "../../../utils/voteRegion";
import type { ReactionRegion } from "../../../utils/voteRegion";
import type { RecordingMode } from "../types";
import type PartySocket from "partysocket";

const MAX_TABLE_ROWS = 200;

export function useRecording(socket: PartySocket, room: string) {
  const [isRecording, setIsRecording]     = useState(false);
  const [serverRecording, setServerRecording] = useState(false);
  const [mode, setMode]                   = useState<RecordingMode>('positions');
  const [eventCount, setEventCount]       = useState(0);
  const [displayEvents, setDisplayEvents] = useState<object[]>([]);

  const eventsRef         = useRef<object[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const prevRegionsRef    = useRef<Map<string, ReactionRegion | null>>(new Map());
  const isRecordingRef    = useRef(false);
  const modeRef           = useRef<RecordingMode>('positions');

  const startRecording = () => {
    if (recordingStartRef.current === null) recordingStartRef.current = Date.now();
    prevRegionsRef.current = new Map();
    setIsRecording(true);
    isRecordingRef.current = true;
    socket.send(JSON.stringify({ type: 'setRecordingState', recording: true }));
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    socket.send(JSON.stringify({ type: 'setRecordingState', recording: false }));
  };

  const downloadEvents = () => {
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

  const clearEvents = () => {
    eventsRef.current = [];
    prevRegionsRef.current = new Map();
    recordingStartRef.current = null;
    setDisplayEvents([]);
    setEventCount(0);
  };

  const handleModeChange = (newMode: RecordingMode) => {
    setMode(newMode);
    modeRef.current = newMode;
  };

  const pushEvent = (evt: object) => {
    eventsRef.current.push(evt);
    setDisplayEvents(prev => [...prev, evt].slice(-MAX_TABLE_ROWS));
    setEventCount(c => c + 1);
  };

  const handleSocketEvent = (data: Record<string, unknown>) => {
    if (data.type === 'recordingStateChanged') {
      setServerRecording(data.recording as boolean);
      return;
    }

    if (!isRecordingRef.current) return;

    const now = Date.now();

    if (data.type === 'userJoined' || data.type === 'userLeft') {
      pushEvent({
        connectionId: data.userId,
        type: data.type === 'userJoined' ? 'arrival' : 'departure',
        timestamp: now,
      });
      return;
    }

    if (data.type === 'move' || data.type === 'touch') {
      const { userId: connectionId, x, y } = data.position as { userId: string; x: number; y: number };
      if (modeRef.current === 'positions') {
        pushEvent({ connectionId, type: data.type, x, y, timestamp: now });
      } else {
        const newRegion = computeReactionRegion(x, y);
        const prevRegion = prevRegionsRef.current.get(connectionId) ?? null;
        if (newRegion !== prevRegion) {
          pushEvent({ connectionId, from: prevRegion, to: newRegion, timestamp: now });
          prevRegionsRef.current.set(connectionId, newRegion);
        }
      }
    }

    if (data.type === 'remove') {
      const { userId: connectionId } = data.position as { userId: string };
      if (modeRef.current === 'transitions') {
        const prevRegion = prevRegionsRef.current.get(connectionId) ?? null;
        if (prevRegion !== null) {
          pushEvent({ connectionId, from: prevRegion, to: null, timestamp: now });
        }
        prevRegionsRef.current.set(connectionId, null);
      } else {
        pushEvent({ connectionId, type: 'remove', x: 0, y: 0, timestamp: now });
      }
    }
  };

  return {
    isRecording,
    serverRecording, setServerRecording,
    mode,
    eventCount,
    displayEvents,
    MAX_TABLE_ROWS,
    startRecording,
    stopRecording,
    downloadEvents,
    clearEvents,
    handleModeChange,
    handleSocketEvent,
  };
}
