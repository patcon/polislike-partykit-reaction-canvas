import { useState, useRef } from "react";
import type { ReactionAnchors } from "../../../utils/voteRegion";
import type { PlaybackFile, RecordingMode } from "../types";
import type PartySocket from "partysocket";

function anchorForRegion(region: string, userId: string, anchors: ReactionAnchors): { x: number; y: number } {
  const pts: Record<string, { x: number; y: number }> = {
    positive: anchors.positive,
    negative: anchors.negative,
    neutral:  anchors.neutral,
  };
  const base = pts[region] ?? { x: 50, y: 50 };
  // Deterministic jitter ±4 units seeded by userId so users don't pile up on the same pixel
  const h = userId.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  return {
    x: base.x + ((Math.abs(h) % 9) - 4),
    y: base.y + ((Math.abs(h >> 4) % 9) - 4),
  };
}

export function usePlayback(socket: PartySocket, activeAnchors: ReactionAnchors) {
  const [playbackData, setPlaybackData]     = useState<PlaybackFile | null>(null);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [isPaused, setIsPaused]             = useState(false);
  const [playbackElapsed, setPlaybackElapsed] = useState(0);

  const playbackIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseHeartbeatRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const activePlaybackUserIds  = useRef<Set<string>>(new Set());
  const lastPlaybackPositions  = useRef<Map<string, { x: number; y: number }>>(new Map());
  const sortedEventsRef        = useRef<Record<string, unknown>[]>([]);
  const originTsRef            = useRef<number>(0);
  const wallStartRef           = useRef<number>(0);
  const idxRef                 = useRef<number>(0);
  const playbackModeRef        = useRef<RecordingMode>('positions');
  const activeAnchorsRef       = useRef<ReactionAnchors>(activeAnchors);
  activeAnchorsRef.current     = activeAnchors;

  const sendPlaybackEvent = (evt: Record<string, unknown>, mode: RecordingMode) => {
    const fakeUserId = `replay_${evt.connectionId}`;
    if (mode === 'positions') {
      if (evt.type === 'remove') {
        socket.send(JSON.stringify({
          type: 'playbackCursorBroadcast',
          cursorType: 'remove',
          position: { x: 0, y: 0, userId: fakeUserId, timestamp: Date.now() },
        }));
        activePlaybackUserIds.current.delete(fakeUserId);
      } else {
        socket.send(JSON.stringify({
          type: 'playbackCursorBroadcast',
          cursorType: evt.type,
          position: { x: evt.x, y: evt.y, userId: fakeUserId, timestamp: Date.now() },
        }));
        activePlaybackUserIds.current.add(fakeUserId);
        lastPlaybackPositions.current.set(fakeUserId, { x: evt.x as number, y: evt.y as number });
      }
    } else {
      if (evt.to === null || evt.to === undefined) {
        socket.send(JSON.stringify({
          type: 'playbackCursorBroadcast',
          cursorType: 'remove',
          position: { x: 0, y: 0, userId: fakeUserId, timestamp: Date.now() },
        }));
        activePlaybackUserIds.current.delete(fakeUserId);
        lastPlaybackPositions.current.delete(fakeUserId);
      } else {
        const { x, y } = anchorForRegion(String(evt.to), fakeUserId, activeAnchorsRef.current);
        socket.send(JSON.stringify({
          type: 'playbackCursorBroadcast',
          cursorType: 'move',
          position: { x, y, userId: fakeUserId, timestamp: Date.now() },
        }));
        activePlaybackUserIds.current.add(fakeUserId);
        lastPlaybackPositions.current.set(fakeUserId, { x, y });
      }
    }
  };

  const clearActiveCursors = () => {
    activePlaybackUserIds.current.forEach(uid => {
      socket.send(JSON.stringify({
        type: 'playbackCursorBroadcast',
        cursorType: 'remove',
        position: { x: 0, y: 0, userId: uid, timestamp: Date.now() },
      }));
    });
    activePlaybackUserIds.current.clear();
    lastPlaybackPositions.current.clear();
  };

  const startPauseHeartbeat = () => {
    if (pauseHeartbeatRef.current) clearInterval(pauseHeartbeatRef.current);
    pauseHeartbeatRef.current = setInterval(() => {
      lastPlaybackPositions.current.forEach(({ x, y }, uid) => {
        socket.send(JSON.stringify({
          type: 'playbackCursorBroadcast',
          cursorType: 'move',
          position: { x, y, userId: uid, timestamp: Date.now() },
        }));
      });
    }, 2000);
  };

  const stopPauseHeartbeat = () => {
    if (pauseHeartbeatRef.current) clearInterval(pauseHeartbeatRef.current);
    pauseHeartbeatRef.current = null;
  };

  const runInterval = () => {
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    playbackIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - wallStartRef.current;
      const sorted = sortedEventsRef.current;
      const mode = playbackModeRef.current;
      while (idxRef.current < sorted.length) {
        const evt = sorted[idxRef.current];
        if ((evt.timestamp as number) - originTsRef.current > elapsed) break;
        sendPlaybackEvent(evt, mode);
        idxRef.current++;
      }
      setPlaybackElapsed(elapsed);
      if (idxRef.current >= sorted.length) {
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
        stopPauseHeartbeat();
        setIsPlaying(false);
        setIsPaused(false);
        clearActiveCursors();
      }
    }, 50);
  };

  const handlePlaybackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const data = JSON.parse(text) as PlaybackFile;
        const sorted = [...data.events].sort(
          (a, b) => (a as Record<string, number>).timestamp - (b as Record<string, number>).timestamp
        ) as Record<string, unknown>[];
        sortedEventsRef.current = sorted;
        originTsRef.current = sorted.length > 0 ? (sorted[0].timestamp as number) : 0;
        playbackModeRef.current = data.mode;
        idxRef.current = 0;
        setPlaybackElapsed(0);
        setIsPlaying(false);
        setIsPaused(false);
        clearActiveCursors();
        setPlaybackData(data);
      } catch {
        alert('Failed to parse JSON file.');
      }
    });
  };

  const playPlayback = () => {
    if (!playbackData || sortedEventsRef.current.length === 0) return;
    if (isPaused) {
      wallStartRef.current = Date.now() - playbackElapsed;
    } else {
      idxRef.current = 0;
      activePlaybackUserIds.current = new Set();
      setPlaybackElapsed(0);
      wallStartRef.current = Date.now();
    }
    setIsPlaying(true);
    setIsPaused(false);
    stopPauseHeartbeat();
    runInterval();
  };

  const pausePlayback = () => {
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    playbackIntervalRef.current = null;
    setIsPlaying(false);
    setIsPaused(true);
    startPauseHeartbeat();
  };

  const stopPlayback = () => {
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    playbackIntervalRef.current = null;
    stopPauseHeartbeat();
    setIsPlaying(false);
    setIsPaused(false);
    setPlaybackElapsed(0);
    idxRef.current = 0;
    clearActiveCursors();
  };

  const seekPlayback = (targetElapsed: number) => {
    if (!playbackData) return;
    const mode = playbackModeRef.current;
    const sorted = sortedEventsRef.current;
    if (!sorted.length) return;

    clearActiveCursors();

    const newIdx = sorted.findIndex(
      e => (e.timestamp as number) - originTsRef.current > targetElapsed
    );
    idxRef.current = newIdx === -1 ? sorted.length : newIdx;

    const lastState = new Map<string, Record<string, unknown>>();
    for (const evt of sorted.slice(0, idxRef.current)) {
      const uid = String(evt.connectionId);
      if (mode === 'positions') {
        lastState.set(uid, evt);
      } else {
        if (evt.to !== undefined) lastState.set(uid, evt);
      }
    }
    lastState.forEach(evt => sendPlaybackEvent(evt, mode));

    wallStartRef.current = Date.now() - targetElapsed;
    setPlaybackElapsed(targetElapsed);

    if (isPlaying) runInterval();
  };

  return {
    playbackData,
    isPlaying,
    isPaused,
    playbackElapsed,
    sortedEventsRef,
    handlePlaybackFile,
    playPlayback,
    pausePlayback,
    stopPlayback,
    seekPlayback,
  };
}
