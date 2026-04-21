import { useState, useRef, useEffect, useMemo } from "react";
import usePartySocket from "partysocket/react";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../utils/voteRegion";
import type { ReactionRegion, ReactionAnchors } from "../utils/voteRegion";
import { REACTION_LABEL_PRESETS, getCustomLabelHistory, saveCustomLabelToHistory, removeCustomLabelFromHistory } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";
import ImageConfigModal from "./ImageConfigModal";
import SocialConfigModal from "./SocialConfigModal";
import type { SocialConfig } from "../types";

function ParticipantRow({ userId, region, labels }: { userId: string; region: ReactionRegion | null; labels: ReactionLabelSet }) {
  const regionColor = region === 'positive' ? '#4a4' : region === 'negative' ? '#a44' : region === 'neutral' ? '#aa4' : '#555';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#1a1a1a', borderRadius: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: regionColor, flexShrink: 0 }} />
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {userId}
      </span>
      <button disabled style={{ opacity: 0.3, fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'not-allowed' }}>
        ···
      </button>
    </div>
  );
}

interface AdminPanelV4Props {
  room: string;
}

type RecordingMode = 'transitions' | 'positions';

interface PlaybackFile {
  recordingStart: number;
  recordingEnd: number;
  room: string;
  mode: RecordingMode;
  events: object[];
}

function anchorToLocal(anchors: ReactionAnchors) {
  return {
    positiveX: String(anchors.positive.x),
    positiveY: String(anchors.positive.y),
    negativeX: String(anchors.negative.x),
    negativeY: String(anchors.negative.y),
    neutralX:  String(anchors.neutral.x),
    neutralY:  String(anchors.neutral.y),
  };
}

type AdminTab = 'record' | 'labels' | 'anchors' | 'avatars' | 'interfaces' | 'events' | 'participants';

export default function AdminPanelV4({ room }: AdminPanelV4Props) {

  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<RecordingMode>('positions');
  const [activeTab, setActiveTab] = useState<AdminTab>('record');
  const [eventCount, setEventCount] = useState(0);
  const [serverRecording, setServerRecording] = useState(false);
  const [userCap, setUserCap] = useState<number | null>(null);
  const [capInput, setCapInput] = useState<string>('');
  const [presenceCount, setPresenceCount] = useState<number>(0);

  // Participants tab state
  const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set());
  const [liveCursors, setLiveCursors] = useState<Map<string, {x: number; y: number}>>(new Map());
  const [participantGrouping, setParticipantGrouping] = useState<'none' | 'valence'>('valence');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const staleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Labels config state
  const [labelSelected, setLabelSelected] = useState<string>('default');
  const [customPositive, setCustomPositive] = useState('');
  const [customNegative, setCustomNegative] = useState('');
  const [customNeutral, setCustomNeutral] = useState('');
  const [customHistory, setCustomHistory] = useState<ReactionLabelSet[]>(() => getCustomLabelHistory());

  // Avatar config state
  const [avatarStyle, setAvatarStyle] = useState<string | null>(null);

  // Activity state
  const [activity, setActivity] = useState<'canvas' | 'soccer' | 'image-canvas'>('canvas');
  const [soccerScore, setSoccerScore] = useState({ left: 0, right: 0 });
  const [imageConfigOpen, setImageConfigOpen] = useState(false);
  const [roomImageUrl, setRoomImageUrl] = useState('');
  const [socialConfigOpen, setSocialConfigOpen] = useState(false);
  const [roomSocialConfig, setRoomSocialConfig] = useState<SocialConfig | null>(null);

  // Events (GitHub submissions) state
  interface GithubSubmission {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    timestamp: number;
  }
  const [githubSubmissions, setGithubSubmissions] = useState<GithubSubmission[]>([]);

  // Anchor config state (local editing)
  const defaults = anchorToLocal(DEFAULT_ANCHORS);
  const [positiveX, setPositiveX] = useState(defaults.positiveX);
  const [positiveY, setPositiveY] = useState(defaults.positiveY);
  const [negativeX, setNegativeX] = useState(defaults.negativeX);
  const [negativeY, setNegativeY] = useState(defaults.negativeY);
  const [neutralX,  setNeutralX]  = useState(defaults.neutralX);
  const [neutralY,  setNeutralY]  = useState(defaults.neutralY);

  const applyServerLabels = (labels: ReactionLabelSet | null) => {
    if (labels === null) {
      setLabelSelected('none');
      return;
    }
    // Check if it matches a preset
    const matchedKey = Object.entries(REACTION_LABEL_PRESETS).find(
      ([, set]) => set.positive === labels.positive && set.negative === labels.negative && set.neutral === labels.neutral
    )?.[0];
    if (matchedKey) {
      setLabelSelected(matchedKey);
    } else {
      setLabelSelected('custom');
      setCustomPositive(labels.positive);
      setCustomNegative(labels.negative);
      setCustomNeutral(labels.neutral);
    }
  };

  const applyServerAnchors = (anchors: ReactionAnchors | null) => {
    const resolved = anchors ?? DEFAULT_ANCHORS;
    const local = anchorToLocal(resolved);
    setPositiveX(local.positiveX);
    setPositiveY(local.positiveY);
    setNegativeX(local.negativeX);
    setNegativeY(local.negativeY);
    setNeutralX(local.neutralX);
    setNeutralY(local.neutralY);
  };

  const activeLabels = useMemo<ReactionLabelSet>(() => {
    if (labelSelected === 'custom') return { positive: customPositive || 'Positive', negative: customNegative || 'Negative', neutral: customNeutral || 'Neutral' };
    return REACTION_LABEL_PRESETS[labelSelected] ?? REACTION_LABEL_PRESETS['default'];
  }, [labelSelected, customPositive, customNegative, customNeutral]);

  const activeAnchors = useMemo<ReactionAnchors>(() => ({
    positive: { x: parseFloat(positiveX), y: parseFloat(positiveY) },
    negative: { x: parseFloat(negativeX), y: parseFloat(negativeY) },
    neutral:  { x: parseFloat(neutralX),  y: parseFloat(neutralY)  },
  }), [positiveX, positiveY, negativeX, negativeY, neutralX, neutralY]);

  const [displayEvents, setDisplayEvents] = useState<object[]>([]);
  const MAX_TABLE_ROWS = 200;

  const eventsRef = useRef<object[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const prevRegionsRef = useRef<Map<string, ReactionRegion | null>>(new Map());
  const isRecordingRef = useRef(false);
  const modeRef = useRef<RecordingMode>('positions');

  // Playback state
  const [playbackData, setPlaybackData] = useState<PlaybackFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackElapsed, setPlaybackElapsed] = useState(0);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activePlaybackUserIds = useRef<Set<string>>(new Set());
  // Last sent position per playback userId, for pause heartbeat
  const lastPlaybackPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Refs shared between playback functions
  const sortedEventsRef = useRef<Record<string, unknown>[]>([]);
  const originTsRef = useRef<number>(0);
  const wallStartRef = useRef<number>(0);
  const idxRef = useRef<number>(0);
  const playbackModeRef = useRef<RecordingMode>('positions');

  // Keep refs in sync with state so the socket handler can access current values
  // without stale closures
  const socket = usePartySocket({
    host: window.location.port === '1999' ? `${window.location.hostname}:1999` : window.location.hostname,
    room,
    query: { isAdmin: 'true' },
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'presenceCount') {
          setPresenceCount(data.count);
          return;
        }

        if (data.type === 'recordingStateChanged') {
          setServerRecording(data.recording);
          return;
        }

        if (data.type === 'connected') {
          if (data.recordingState !== undefined) setServerRecording(data.recordingState);
          if ('roomLabels' in data) applyServerLabels(data.roomLabels);
          if ('roomAnchors' in data) applyServerAnchors(data.roomAnchors);
          if ('roomAvatarStyle' in data) setAvatarStyle(data.roomAvatarStyle ?? null);
          if ('currentActivity' in data) setActivity(data.currentActivity ?? 'canvas');
          if ('roomImageUrl' in data) setRoomImageUrl(data.roomImageUrl ?? '');
          if ('roomSocialConfig' in data) setRoomSocialConfig(data.roomSocialConfig ?? null);
          if ('soccerScore' in data && data.soccerScore) setSoccerScore(data.soccerScore);
          if (data.userCap !== undefined) {
            setUserCap(data.userCap);
            setCapInput(data.userCap !== null ? String(data.userCap) : '');
          }
          return;
        }

        if (data.type === 'roomLabelsChanged') {
          applyServerLabels(data.labels);
          return;
        }

        if (data.type === 'roomAnchorsChanged') {
          applyServerAnchors(data.anchors);
          return;
        }

        if (data.type === 'roomAvatarStyleChanged') {
          setAvatarStyle(data.avatarStyle ?? null);
          return;
        }

        if (data.type === 'activityChanged') {
          setActivity(data.activity ?? 'canvas');
          return;
        }

        if (data.type === 'imageUrlChanged') {
          setRoomImageUrl(data.url ?? '');
          return;
        }

        if (data.type === 'socialConfigChanged') {
          setRoomSocialConfig(data.config ?? null);
          return;
        }

        if (data.type === 'goalScored') {
          setSoccerScore(data.score);
          return;
        }

        if (data.type === 'userCapChanged') {
          setUserCap(data.cap);
          setCapInput(data.cap !== null ? String(data.cap) : '');
          return;
        }

        if (data.type === 'githubUsernameSubmitted') {
          setGithubSubmissions(prev => [...prev, {
            username: data.username,
            displayName: data.displayName ?? null,
            avatarUrl: data.avatarUrl ?? null,
            timestamp: data.timestamp,
          }]);
          return;
        }

        // Participant tracking — always runs regardless of recording state
        if (data.type === 'userJoined' || data.type === 'userLeft') {
          if (data.type === 'userJoined') {
            setConnectedUsers(prev => new Set([...prev, data.userId]));
          } else {
            setConnectedUsers(prev => { const s = new Set(prev); s.delete(data.userId); return s; });
            setLiveCursors(prev => { const m = new Map(prev); m.delete(data.userId); return m; });
            clearTimeout(staleTimersRef.current.get(data.userId));
            staleTimersRef.current.delete(data.userId);
          }
        }

        if (data.type === 'move' || data.type === 'touch') {
          const { userId: cursorUserId, x: cx, y: cy } = data.position;
          setConnectedUsers(prev => new Set([...prev, cursorUserId]));
          setLiveCursors(prev => new Map(prev).set(cursorUserId, { x: cx, y: cy }));
          clearTimeout(staleTimersRef.current.get(cursorUserId));
          staleTimersRef.current.set(cursorUserId, setTimeout(() => {
            setLiveCursors(prev => { const m = new Map(prev); m.delete(cursorUserId); return m; });
            staleTimersRef.current.delete(cursorUserId);
          }, 3000));
        }

        if (data.type === 'remove') {
          const { userId: removedId } = data.position;
          setLiveCursors(prev => { const m = new Map(prev); m.delete(removedId); return m; });
          clearTimeout(staleTimersRef.current.get(removedId));
          staleTimersRef.current.delete(removedId);
        }

        if (!isRecordingRef.current) return;

        const now = Date.now();

        if (data.type === 'userJoined' || data.type === 'userLeft') {
          const pushEvent = (evt: object) => {
            eventsRef.current.push(evt);
            setDisplayEvents(prev => [...prev, evt].slice(-MAX_TABLE_ROWS));
            setEventCount(c => c + 1);
          };
          pushEvent({
            connectionId: data.userId,
            type: data.type === 'userJoined' ? 'arrival' : 'departure',
            timestamp: now,
          });
          return;
        }

        if (data.type === 'move' || data.type === 'touch') {
          const { userId: connectionId, x, y } = data.position;

          const pushEvent = (evt: object) => {
            eventsRef.current.push(evt);
            setDisplayEvents(prev => [...prev, evt].slice(-MAX_TABLE_ROWS));
            setEventCount(c => c + 1);
          };

          if (modeRef.current === 'positions') {
            pushEvent({ connectionId, type: data.type, x, y, timestamp: now });
          } else {
            // transitions mode
            const newRegion = computeReactionRegion(x, y);
            const prevRegion = prevRegionsRef.current.get(connectionId) ?? null;
            if (newRegion !== prevRegion) {
              pushEvent({ connectionId, from: prevRegion, to: newRegion, timestamp: now });
              prevRegionsRef.current.set(connectionId, newRegion);
            }
          }
        }

        if (data.type === 'remove') {
          const { userId: connectionId } = data.position;

          const pushEvent = (evt: object) => {
            eventsRef.current.push(evt);
            setDisplayEvents(prev => [...prev, evt].slice(-MAX_TABLE_ROWS));
            setEventCount(c => c + 1);
          };

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
      } catch (e) {
        console.error('AdminPanelV4: failed to parse message', e);
      }
    },
  });

  const startRecording = () => {
    if (recordingStartRef.current === null) {
      recordingStartRef.current = Date.now();
    }
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

  const handlePlaybackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const data = JSON.parse(text) as PlaybackFile;
        // Pre-sort and store refs so scrubber works before first play
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

  const anchorForRegion = (region: string, userId: string): { x: number; y: number } => {
    const anchors: Record<string, { x: number; y: number }> = {
      positive: { x: parseFloat(positiveX), y: parseFloat(positiveY) },
      negative: { x: parseFloat(negativeX), y: parseFloat(negativeY) },
      neutral:  { x: parseFloat(neutralX),  y: parseFloat(neutralY)  },
    };
    const base = anchors[region] ?? { x: 50, y: 50 };
    // Deterministic jitter ±4 units seeded by userId so users don't pile up on the same pixel
    const h = userId.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
    return {
      x: base.x + ((Math.abs(h) % 9) - 4),
      y: base.y + ((Math.abs(h >> 4) % 9) - 4),
    };
  };

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
      // transitions mode
      if (evt.to === null || evt.to === undefined) {
        socket.send(JSON.stringify({
          type: 'playbackCursorBroadcast',
          cursorType: 'remove',
          position: { x: 0, y: 0, userId: fakeUserId, timestamp: Date.now() },
        }));
        activePlaybackUserIds.current.delete(fakeUserId);
        lastPlaybackPositions.current.delete(fakeUserId);
      } else {
        const { x, y } = anchorForRegion(String(evt.to), fakeUserId);
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
        // Reached end — stop cleanly
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
        stopPauseHeartbeat();
        setIsPlaying(false);
        setIsPaused(false);
        clearActiveCursors();
      }
    }, 50);
  };

  const playPlayback = () => {
    if (!playbackData || sortedEventsRef.current.length === 0) return;
    if (isPaused) {
      // Resume from current position
      wallStartRef.current = Date.now() - playbackElapsed;
    } else {
      // Fresh start from beginning
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
    // Keep cursors alive with a heartbeat — Canvas removes them after 3s without an update
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

  // Seek to a specific elapsed time (ms from recording start). Works while playing or paused.
  const seekPlayback = (targetElapsed: number) => {
    if (!playbackData) return;
    const mode = playbackModeRef.current;
    const sorted = sortedEventsRef.current;
    if (!sorted.length) return;

    clearActiveCursors();

    // Find the index of the first event after targetElapsed
    const newIdx = sorted.findIndex(
      e => (e.timestamp as number) - originTsRef.current > targetElapsed
    );
    idxRef.current = newIdx === -1 ? sorted.length : newIdx;

    // Snapshot each user's last known state up to targetElapsed and send it
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

  const sendUserCap = () => {
    const parsed = parseInt(capInput, 10);
    const cap = capInput === '' || parsed <= 0 ? null : parsed;
    socket.send(JSON.stringify({ type: 'setUserCap', cap }));
  };

  const sendLabels = () => {
    let labels: ReactionLabelSet | null;
    if (labelSelected === 'none') {
      labels = null;
    } else if (labelSelected === 'custom') {
      labels = { positive: customPositive, negative: customNegative, neutral: customNeutral };
      saveCustomLabelToHistory(labels);
      setCustomHistory(getCustomLabelHistory());
    } else {
      const preset = REACTION_LABEL_PRESETS[labelSelected];
      labels = preset ? { positive: preset.positive, negative: preset.negative, neutral: preset.neutral } : null;
    }
    socket.send(JSON.stringify({ type: 'setRoomLabels', labels }));
  };

  const sendAnchors = () => {
    const anchors: ReactionAnchors = {
      positive: { x: parseFloat(positiveX), y: parseFloat(positiveY) },
      negative: { x: parseFloat(negativeX), y: parseFloat(negativeY) },
      neutral:  { x: parseFloat(neutralX),  y: parseFloat(neutralY)  },
    };
    socket.send(JSON.stringify({ type: 'setRoomAnchors', anchors }));
  };

  const resetAnchors = () => {
    applyServerAnchors(null);
    socket.send(JSON.stringify({ type: 'setRoomAnchors', anchors: null }));
  };

  const sendAvatarStyle = (style: string | null) => {
    setAvatarStyle(style);
    socket.send(JSON.stringify({ type: 'setRoomAvatarStyle', avatarStyle: style }));
  };

  const sendActivity = (act: 'canvas' | 'soccer' | 'image-canvas') => {
    setActivity(act);
    socket.send(JSON.stringify({ type: 'setActivity', activity: act }));
  };

  const sendImageUrl = (url: string) => {
    setRoomImageUrl(url);
    socket.send(JSON.stringify({ type: 'setImageUrl', url }));
  };

  const sendSocialConfig = (config: SocialConfig) => {
    setRoomSocialConfig(config);
    socket.send(JSON.stringify({ type: 'setSocialConfig', config }));
  };

  const resetSoccerScore = () => {
    socket.send(JSON.stringify({ type: 'resetSoccerScore' }));
  };

  const triggerGithubActivity = () => {
    socket.send(JSON.stringify({ type: 'triggerActivity', activityName: 'githubUsername' }));
  };

  const downloadGithubSubmissions = () => {
    const blob = new Blob([JSON.stringify(githubSubmissions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-submissions-${room}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectPreset = (key: string) => {
    setLabelSelected(key);
    if (key !== 'custom' && key !== 'none') {
      const preset = REACTION_LABEL_PRESETS[key];
      if (preset) {
        setCustomPositive(preset.positive);
        setCustomNegative(preset.negative);
        setCustomNeutral(preset.neutral);
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#333',
    border: '1px solid #555',
    color: '#eee',
    padding: '4px 8px',
    borderRadius: 4,
    width: 64,
  };

  const tabLabel = (tab: AdminTab): string => {
    if (tab === 'events') return githubSubmissions.length > 0 ? `Events (${githubSubmissions.length})` : 'Events';
    if (tab === 'participants') return connectedUsers.size > 0 ? `People (${connectedUsers.size})` : 'People';
    if (tab === 'interfaces') return 'Interface';
    if (tab === 'record') return 'Record';
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  const ALL_TABS: AdminTab[] = ['record', 'labels', 'anchors', 'avatars', 'interfaces', 'events', 'participants'];

  return (
    <div
      className="v3-admin-panel"
      style={{ padding: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* === PERSISTENT HEADER === */}
      <div style={{ flexShrink: 0, borderBottom: '2px solid #444' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#eee', flexShrink: 0 }}>V4 Admin</span>
            <span style={{ color: '#555', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {room}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
            {isRecording && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f55', letterSpacing: '0.05em' }}>● REC</span>
            )}
            {connectedUsers.size > 0 && (
              <span style={{ fontSize: 12, color: '#666' }}>{connectedUsers.size} online</span>
            )}
          </div>
        </div>

        {/* Tab bar — horizontally scrollable, no visible scrollbar */}
        <div
          className="admin-v4-tab-bar"
          style={{ display: 'flex', overflowX: 'auto' }}
        >
          {ALL_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                background: activeTab === tab ? '#333' : 'transparent',
                color: activeTab === tab ? '#eee' : '#888',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #aaa' : '2px solid transparent',
                marginBottom: -2,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      {/* === TAB CONTENT === */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 16px' }}>

        {/* RECORD tab */}
        {activeTab === 'record' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ marginBottom: 8, fontWeight: 600 }}>Participant cap:</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  value={capInput}
                  placeholder="No cap"
                  onChange={e => setCapInput(e.target.value)}
                  style={{ ...inputStyle, width: 88 }}
                />
                <button className="v3-admin-btn" style={{ padding: '4px 12px' }} onClick={sendUserCap}>
                  Apply
                </button>
                {userCap !== null && (
                  <button
                    className="v3-admin-btn"
                    style={{ padding: '4px 12px' }}
                    onClick={() => { setCapInput(''); socket.send(JSON.stringify({ type: 'setUserCap', cap: null })); }}
                  >
                    Remove cap
                  </button>
                )}
              </div>
              {userCap !== null && (
                <p style={{ marginTop: 6, color: '#aaa', fontSize: 13 }}>
                  {presenceCount} / {userCap} participants active
                </p>
              )}
            </div>

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

            <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!isRecording ? (
                <button className="v3-admin-btn v3-admin-btn-record" onClick={startRecording}>
                  ● Start Recording
                </button>
              ) : (
                <button className="v3-admin-btn v3-admin-btn-stop" onClick={stopRecording}>
                  ■ Stop Recording
                </button>
              )}
              <button className="v3-admin-btn" onClick={downloadEvents} disabled={eventCount === 0}>
                ↓ Download JSON
              </button>
              <button
                className="v3-admin-btn v3-admin-btn--destructive"
                onClick={() => { if (confirm(`Clear all ${eventCount} recorded events?`)) clearEvents(); }}
                disabled={eventCount === 0}
              >
                ✕ Clear
              </button>
            </div>

            <div style={{ marginTop: 16, color: '#aaa' }}>
              Status:{' '}
              {isRecording
                ? <span style={{ color: '#f55', fontWeight: 700 }}>RECORDING — {eventCount} events logged</span>
                : eventCount > 0
                  ? <span style={{ color: '#aaa' }}>Stopped — {eventCount} events</span>
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

            {/* Playback section */}
            <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 24 }}>
              <p style={{ marginBottom: 12, fontWeight: 600 }}>Playback</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                  <span className="v3-admin-btn" style={{ display: 'inline-block' }}>
                    ↑ Load JSON file
                  </span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handlePlaybackFile}
                    style={{ display: 'none' }}
                  />
                </label>
                <a
                  href="https://drive.google.com/drive/folders/12ujr5MKjs2q0vzDViyG_1U-SEyVOJZO_"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#69f', fontSize: 13 }}
                >
                  Valence traces ↗
                </a>
              </div>
              {playbackData && (() => {
                const events = playbackData.events as Record<string, unknown>[];
                const uniqueUsers = new Set(events.map(e => e.connectionId)).size;
                return (
                  <div style={{ marginTop: 12, color: '#aaa', fontSize: 13 }}>
                    <div style={{ color: '#eee', marginBottom: 2 }}>
                      {events.length} events · {uniqueUsers} users
                    </div>
                    <div style={{ color: '#888' }}>Mode: {playbackData.mode} · Room: {playbackData.room}</div>
                  </div>
                );
              })()}

              {/* Timeline scrubber — always visible */}
              {(() => {
                const sorted = sortedEventsRef.current;
                const durationMs = sorted.length > 1
                  ? (sorted[sorted.length - 1].timestamp as number) - (sorted[0].timestamp as number)
                  : 0;
                const clampedElapsed = Math.min(playbackElapsed, durationMs || 1);
                const fmtTime = (ms: number) => {
                  const m = Math.floor(ms / 60000);
                  const s = Math.floor((ms % 60000) / 1000);
                  return `${m}:${String(s).padStart(2, '0')}`;
                };
                const hasData = !!playbackData && durationMs > 0;
                return (
                  <div style={{ marginTop: 16, opacity: hasData ? 1 : 0.35 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 4 }}>
                      <span>{fmtTime(hasData ? clampedElapsed : 0)}</span>
                      <span>{fmtTime(hasData ? durationMs : 0)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={hasData ? durationMs : 1}
                      value={hasData ? clampedElapsed : 0}
                      disabled={!hasData}
                      onChange={e => seekPlayback(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'hsl(270, 70%, 65%)', cursor: hasData ? 'pointer' : 'default' }}
                    />
                  </div>
                );
              })()}

              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                {isPlaying ? (
                  <button className="v3-admin-btn" onClick={pausePlayback}>
                    ⏸ Pause
                  </button>
                ) : (
                  <button
                    className="v3-admin-btn v3-admin-btn-record"
                    onClick={playPlayback}
                    disabled={!playbackData}
                  >
                    ▶ {isPaused ? 'Resume' : 'Play'}
                  </button>
                )}
                <button
                  className="v3-admin-btn v3-admin-btn-stop"
                  onClick={stopPlayback}
                  disabled={!isPlaying && !isPaused}
                >
                  ■ Stop
                </button>
              </div>
              {isPlaying && (
                <div style={{ marginTop: 8, color: '#f55', fontSize: 13, fontWeight: 600 }}>
                  PLAYING — playback cursors visible to all participants
                </div>
              )}
              {isPaused && (
                <div style={{ marginTop: 8, color: '#fa0', fontSize: 13, fontWeight: 600 }}>
                  PAUSED — cursors frozen on canvas
                </div>
              )}
            </div>

            {/* Recorded events table */}
            <div style={{ marginTop: 40 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                Recorded events
                {eventCount > MAX_TABLE_ROWS && (
                  <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 8 }}>
                    (showing last {MAX_TABLE_ROWS} of {eventCount})
                  </span>
                )}
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ background: '#222', color: '#aaa', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>#</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>time</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>connectionId</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>from</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>to</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>type</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>x</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayEvents.map((evt, i) => {
                      const e = evt as Record<string, unknown>;
                      const offset = eventCount - displayEvents.length;
                      const ts = typeof e.timestamp === 'number'
                        ? new Date(e.timestamp).toISOString().slice(11, 23)
                        : '';
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#1a1a1a' : '#111' }}>
                          <td style={{ padding: '4px 10px', color: '#555' }}>{offset + i + 1}</td>
                          <td style={{ padding: '4px 10px', color: '#888' }}>{ts}</td>
                          <td style={{ padding: '4px 10px', color: '#ccc' }}>{String(e.connectionId ?? '')}</td>
                          <td style={{ padding: '4px 10px', color: '#f99' }}>{e.from !== undefined ? String(e.from ?? 'null') : ''}</td>
                          <td style={{ padding: '4px 10px', color: '#9f9' }}>{e.to !== undefined ? String(e.to ?? 'null') : ''}</td>
                          <td style={{ padding: '4px 10px', color: '#99f' }}>{e.type !== undefined ? String(e.type) : ''}</td>
                          <td style={{ padding: '4px 10px', color: '#aaa' }}>{e.x !== undefined ? String((e.x as number).toFixed(2)) : ''}</td>
                          <td style={{ padding: '4px 10px', color: '#aaa' }}>{e.y !== undefined ? String((e.y as number).toFixed(2)) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LABELS tab */}
        {activeTab === 'labels' && (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 600 }}>Reaction labels (shared for all participants):</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(REACTION_LABEL_PRESETS).map(([key, set]) => (
                <label key={key} style={{ display: 'block', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="labelSelected"
                    value={key}
                    checked={labelSelected === key}
                    onChange={() => selectPreset(key)}
                    style={{ marginRight: 8 }}
                  />
                  {set.positive} / {set.negative} / {set.neutral}
                  {set.hint && (
                    <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                      — {set.hint}
                      {set.hintLinkText && set.hintUrl && (
                        <a href={set.hintUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#69f' }}>{set.hintLinkText}</a>
                      )}
                    </span>
                  )}
                </label>
              ))}
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="labelSelected"
                  value="custom"
                  checked={labelSelected === 'custom'}
                  onChange={() => setLabelSelected('custom')}
                  style={{ marginRight: 8 }}
                />
                Custom
              </label>
              {labelSelected === 'custom' && (
                <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {([['Positive', customPositive, setCustomPositive], ['Negative', customNegative, setCustomNegative], ['Neutral', customNeutral, setCustomNeutral]] as const).map(([slot, val, setter]) => (
                    <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 64, color: '#aaa', fontSize: 13 }}>{slot}</span>
                      <input
                        type="text"
                        value={val}
                        onChange={e => setter(e.target.value)}
                        placeholder={`${slot} label`}
                        style={{ background: '#333', border: '1px solid #555', color: '#eee', padding: '4px 8px', borderRadius: 4 }}
                      />
                    </div>
                  ))}
                  {customHistory.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {customHistory.map((entry, i) => (
                        <div
                          key={i}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#2a2a2a', border: '1px solid #444', borderRadius: 4, padding: '3px 6px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}
                          onClick={() => { setCustomPositive(entry.positive); setCustomNegative(entry.negative); setCustomNeutral(entry.neutral); }}
                        >
                          <span>{entry.positive} / {entry.negative} / {entry.neutral}</span>
                          <button
                            onClick={e => { e.stopPropagation(); setCustomHistory(removeCustomLabelFromHistory(i)); }}
                            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="labelSelected"
                  value="none"
                  checked={labelSelected === 'none'}
                  onChange={() => setLabelSelected('none')}
                  style={{ marginRight: 8 }}
                />
                None (hide labels)
              </label>
            </div>
            <button
              className="v3-admin-btn"
              style={{ marginTop: 16 }}
              onClick={sendLabels}
              disabled={labelSelected === 'custom' && (!customPositive || !customNegative || !customNeutral)}
            >
              Apply Labels
            </button>
          </div>
        )}

        {/* ANCHORS tab */}
        {activeTab === 'anchors' && (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 600 }}>Coordinate system:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="coordSystem"
                  value="barycentric"
                  checked
                  readOnly
                  style={{ marginRight: 8 }}
                />
                Barycentric
              </label>
              <label style={{ display: 'block', color: '#666', cursor: 'not-allowed' }}>
                <input
                  type="radio"
                  name="coordSystem"
                  value="linear"
                  disabled
                  style={{ marginRight: 8 }}
                />
                Linear <span style={{ fontSize: 12, color: '#555' }}>(coming soon)</span>
              </label>
            </div>

            <p style={{ marginBottom: 4, fontWeight: 600 }}>Anchor positions (shared for all participants):</p>
            <p style={{ marginBottom: 12, color: '#888', fontSize: 13 }}>Values are percentages (0–100) of the canvas width/height.</p>
            <button
              className="v3-admin-btn"
              style={{ marginBottom: 16, padding: '6px 14px', fontSize: 13 }}
              onClick={resetAnchors}
            >
              Reset to defaults
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                ['Positive', positiveX, setPositiveX, positiveY, setPositiveY],
                ['Negative', negativeX, setNegativeX, negativeY, setNegativeY],
                ['Neutral',  neutralX,  setNeutralX,  neutralY,  setNeutralY],
              ] as const).map(([label, xVal, xSetter, yVal, ySetter]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 72, color: '#aaa', fontSize: 13 }}>{label}</span>
                  <label style={{ fontSize: 13, color: '#888', marginRight: 4 }}>X</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={xVal}
                    onChange={e => xSetter(e.target.value)}
                    style={inputStyle}
                  />
                  <label style={{ fontSize: 13, color: '#888', marginRight: 4 }}>Y</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={yVal}
                    onChange={e => ySetter(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <button
              className="v3-admin-btn"
              style={{ marginTop: 16 }}
              onClick={sendAnchors}
            >
              Apply Anchors
            </button>
          </div>
        )}

        {/* AVATARS tab */}
        {activeTab === 'avatars' && (
          <div>
            <p style={{ marginBottom: 4, fontWeight: 600 }}>Avatar style (shown to all participants):</p>
            <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Avatars are generated from each user's ID using <a href="https://www.dicebear.com" target="_blank" rel="noopener noreferrer" style={{ color: '#69f' }}>DiceBear</a>.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="avatarStyle"
                  value=""
                  checked={avatarStyle === null}
                  onChange={() => sendAvatarStyle(null)}
                  style={{ marginRight: 4 }}
                />
                <span style={{ color: '#aaa' }}>None (show colored dots)</span>
              </label>
              {[
                { id: 'adventurer', label: 'Adventurer' },
                { id: 'avataaars', label: 'Avataaars' },
                { id: 'bottts', label: 'Bottts (Robots)' },
                { id: 'fun-emoji', label: 'Fun Emoji' },
                { id: 'identicon', label: 'Identicon' },
                { id: 'lorelei', label: 'Lorelei' },
                { id: 'micah', label: 'Micah' },
                { id: 'open-peeps', label: 'Open Peeps' },
                { id: 'pixel-art', label: 'Pixel Art' },
                { id: 'thumbs', label: 'Thumbs' },
              ].map(({ id, label }) => (
                <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="avatarStyle"
                    value={id}
                    checked={avatarStyle === id}
                    onChange={() => sendAvatarStyle(id)}
                    style={{ marginRight: 4 }}
                  />
                  <img
                    src={`https://api.dicebear.com/9.x/${id}/svg?seed=preview`}
                    alt={label}
                    width={36}
                    height={36}
                    style={{ borderRadius: '50%', border: '2px solid #555', background: '#222' }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* INTERFACES tab */}
        {activeTab === 'interfaces' && (
          <div>
            <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>All settings here are shared with all participants in real time.</p>
            <p style={{ marginBottom: 12, fontWeight: 600 }}>Interfaces</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { id: 'canvas', label: 'Reaction Canvas', desc: 'Standard reaction canvas' },
                { id: 'image-canvas', label: 'Image Canvas', desc: 'React over a shared background image' },
                { id: 'soccer', label: 'Soccer', desc: 'Top-down physics ball — kick with your cursor' },
              ] as const).map(({ id, label, desc }) => (
                <label key={id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="activity"
                    value={id}
                    checked={activity === id}
                    onChange={() => sendActivity(id)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <span style={{ fontWeight: activity === id ? 600 : 400 }}>{label}</span>
                    <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>{desc}</span>
                    {id === 'image-canvas' && (
                      <button
                        className="image-canvas-config-link"
                        onClick={e => { e.preventDefault(); setImageConfigOpen(true); }}
                      >
                        config
                      </button>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {activity === 'soccer' && (
              <div style={{ marginTop: 24, borderTop: '1px solid #444', paddingTop: 20 }}>
                <p style={{ marginBottom: 10, fontWeight: 600 }}>Soccer settings:</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
                  <span style={{ color: '#aaa', fontSize: 15 }}>Score:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#eee' }}>
                    {soccerScore.left} – {soccerScore.right}
                  </span>
                </div>
                <button className="v3-admin-btn v3-admin-btn--destructive" onClick={resetSoccerScore}>
                  Reset Score
                </button>
              </div>
            )}

            <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 20 }}>
              <p style={{ marginBottom: 12, fontWeight: 600 }}>Social sharing</p>
              <p style={{ marginBottom: 12, color: '#888', fontSize: 13 }}>Configure prefilled text for participant share buttons. Participants with <code>?interface=social</code> see a button per platform.</p>
              <div style={{ background: '#222', border: '1px solid #444', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, margin: '0 0 2px' }}>Social butterfly</p>
                  <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Bluesky · Twitter / X · Mastodon</p>
                </div>
                <button
                  className="image-canvas-config-link"
                  onClick={e => { e.preventDefault(); setSocialConfigOpen(true); }}
                >
                  config
                </button>
              </div>
            </div>

            <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 20 }}>
              <p style={{ marginBottom: 4, fontWeight: 600 }}>Popups</p>
              <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Push a one-time form to all participants. Submissions appear in the Events tab.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#222', border: '1px solid #444', borderRadius: 8, padding: '12px 14px' }}>
                  <p style={{ fontWeight: 600, margin: '0 0 2px' }}>Coder role</p>
                  <p style={{ color: '#888', fontSize: 13, margin: '0 0 10px' }}>Ask participants for their GitHub username to confirm they can contribute code.</p>
                  <button className="v3-admin-btn" onClick={triggerGithubActivity}>
                    Push popup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EVENTS tab */}
        {activeTab === 'events' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
              <p style={{ fontWeight: 600, margin: 0 }}>GitHub username submissions</p>
              <button
                className="v3-admin-btn"
                onClick={downloadGithubSubmissions}
                disabled={githubSubmissions.length === 0}
                style={{ marginLeft: 'auto' }}
              >
                ↓ Download JSON
              </button>
              <button
                className="v3-admin-btn v3-admin-btn--destructive"
                onClick={() => setGithubSubmissions([])}
                disabled={githubSubmissions.length === 0}
              >
                ✕ Clear
              </button>
            </div>
            {githubSubmissions.length === 0 ? (
              <p style={{ color: '#666', fontSize: 13 }}>No submissions yet. Trigger the activity from the Interface tab.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ background: '#222', color: '#aaa', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>#</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>time</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>avatar</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>username</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>display name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {githubSubmissions.map((s, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#1a1a1a' : '#111' }}>
                        <td style={{ padding: '4px 10px', color: '#555' }}>{i + 1}</td>
                        <td style={{ padding: '4px 10px', color: '#888' }}>
                          {new Date(s.timestamp).toISOString().slice(11, 19)}
                        </td>
                        <td style={{ padding: '4px 10px' }}>
                          {s.avatarUrl && (
                            <img src={s.avatarUrl} alt={s.username} width={24} height={24} style={{ borderRadius: '50%', verticalAlign: 'middle' }} />
                          )}
                        </td>
                        <td style={{ padding: '4px 10px', color: '#9cf' }}>
                          <a href={`https://github.com/${s.username}`} target="_blank" rel="noopener noreferrer" style={{ color: '#9cf' }}>
                            @{s.username}
                          </a>
                        </td>
                        <td style={{ padding: '4px 10px', color: '#ccc' }}>{s.displayName ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PARTICIPANTS tab */}
        {activeTab === 'participants' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ color: '#aaa', fontSize: 13 }}>Group by:</label>
              <select
                value={participantGrouping}
                onChange={e => setParticipantGrouping(e.target.value as 'none' | 'valence')}
                style={{ background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 8px', borderRadius: 4 }}
              >
                <option value="valence">Valence Zone</option>
                <option value="none">None</option>
              </select>
            </div>

            {connectedUsers.size === 0 ? (
              <p style={{ color: '#666', fontSize: 13 }}>No participants connected.</p>
            ) : participantGrouping === 'none' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...connectedUsers].map(userId => {
                  const cursor = liveCursors.get(userId);
                  const region = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null;
                  return <ParticipantRow key={userId} userId={userId} region={region} labels={activeLabels} />;
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
                  const groupKey = String(region);
                  const members = [...connectedUsers].filter(userId => {
                    const cursor = liveCursors.get(userId);
                    if (!cursor) return region === null;
                    return computeReactionRegion(cursor.x, cursor.y, activeAnchors) === region;
                  });
                  const groupLabel = region === null ? 'Lurking' : activeLabels[region];
                  const collapsed = collapsedGroups.has(groupKey);
                  const toggleCollapse = () => setCollapsedGroups(prev => {
                    const s = new Set(prev);
                    s.has(groupKey) ? s.delete(groupKey) : s.add(groupKey);
                    return s;
                  });
                  return (
                    <div key={groupKey}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 6, paddingRight: 10 }}>
                        <button onClick={toggleCollapse} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0 }}>
                          {collapsed ? '▶' : '▼'}
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, cursor: 'pointer' }} onClick={toggleCollapse}>
                          {groupLabel} ({members.length})
                        </span>
                        <button disabled style={{ opacity: 0.3, fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'not-allowed' }}>
                          ···
                        </button>
                      </div>
                      {!collapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {members.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                              <span style={{ width: 8, height: 8, flexShrink: 0 }} />
                              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', fontStyle: 'italic', flex: 1 }}>empty</span>
                              <button disabled style={{ opacity: 0, fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'not-allowed' }}>···</button>
                            </div>
                          ) : members.map(userId => (
                            <ParticipantRow key={userId} userId={userId} region={region} labels={activeLabels} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {imageConfigOpen && (
        <ImageConfigModal
          currentUrl={roomImageUrl}
          onSubmit={sendImageUrl}
          onClose={() => setImageConfigOpen(false)}
        />
      )}
      {socialConfigOpen && (
        <SocialConfigModal
          current={roomSocialConfig}
          onSubmit={sendSocialConfig}
          onClose={() => setSocialConfigOpen(false)}
        />
      )}
    </div>
  );
}
