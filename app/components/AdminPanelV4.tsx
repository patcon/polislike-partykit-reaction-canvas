import { useState, useRef, useEffect, useMemo } from "react";
import usePartySocket from "partysocket/react";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../utils/voteRegion";
import type { ReactionRegion, ReactionAnchors } from "../utils/voteRegion";
import { REACTION_LABEL_PRESETS, getCustomLabelHistory, saveCustomLabelToHistory, removeCustomLabelFromHistory } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";
import ImageConfigModal from "./ImageConfigModal";
import SocialConfigModal from "./SocialConfigModal";
import type { SocialConfig } from "../types";

function ParticipantRow({ userId, region, labels, online, isMenuOpen, onMenuToggle, onOfferInterface }: { userId: string; region: ReactionRegion | null; labels: ReactionLabelSet; online: boolean; isMenuOpen: boolean; onMenuToggle: () => void; onOfferInterface: () => void; }) {
  const regionColor = region === 'positive' ? '#4a4' : region === 'negative' ? '#a44' : region === 'neutral' ? '#aa4' : '#555';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#1a1a1a', borderRadius: 4, opacity: online ? 1 : 0.4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? regionColor : '#333', flexShrink: 0 }} />
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {userId}
      </span>
      <div style={{ position: 'relative' }}>
        <button onClick={onMenuToggle} disabled={!online} style={{ fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: online ? 'pointer' : 'not-allowed', opacity: online ? 1 : 0 }}>
          ···
        </button>
        {isMenuOpen && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#252525', border: '1px solid #444', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 160 }}>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { onOfferInterface(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
            >
              Offer interface…
            </button>
          </div>
        )}
      </div>
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

type AdminTab = 'record' | 'labels' | 'anchors' | 'avatars' | 'interfaces' | 'events' | 'participants' | 'moments';

interface MomentSnapshot {
  id: string;
  label: string;
  timestamp: number;
  regions: Record<string, 'positive' | 'negative' | 'neutral' | null>;
}

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
  const [seenUsers, setSeenUsers] = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`v4-seen-users-${room}`) ?? '[]');
      return new Set(Array.isArray(stored) ? stored : []);
    } catch { return new Set(); }
  });
  const [liveCursors, setLiveCursors] = useState<Map<string, {x: number; y: number}>>(new Map());
  const [participantGrouping, setParticipantGrouping] = useState<'none' | 'valence' | 'moment'>('valence');
  const [moments, setMoments] = useState<MomentSnapshot[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`v4-moments-${room}`) ?? '[]');
    } catch { return []; }
  });
  const [momentLabelInput, setMomentLabelInput] = useState('');
  const [expandedMoments, setExpandedMoments] = useState<Set<string>>(new Set());
  const [editingMomentId, setEditingMomentId] = useState<string | null>(null);
  const [editingMomentLabel, setEditingMomentLabel] = useState('');
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const staleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pushTarget, setPushTarget] = useState<{ kind: 'user'; userId: string } | { kind: 'region'; region: ReactionRegion | null } | { kind: 'users'; userIds: string[]; label: string } | null>(null);
  const [pendingInterfaceName, setPendingInterfaceName] = useState('social');
  const [interfaceAcceptances, setInterfaceAcceptances] = useState<{ userId: string; interfaceName: string }[]>([]);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [openMenuGroupKey, setOpenMenuGroupKey] = useState<string | null>(null);
  useEffect(() => {
    if (!openMenuUserId && !openMenuGroupKey) return;
    const handler = () => { setOpenMenuUserId(null); setOpenMenuGroupKey(null); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [openMenuUserId, openMenuGroupKey]);

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
          if (Array.isArray(data.connectedUserIds) && data.connectedUserIds.length > 0) {
            const ids: string[] = data.connectedUserIds;
            setConnectedUsers(prev => new Set([...prev, ...ids]));
            setSeenUsers(prev => {
              const next = new Set([...prev, ...ids]);
              localStorage.setItem(`v4-seen-users-${room}`, JSON.stringify([...next]));
              return next;
            });
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

        if (data.type === 'interfaceAccepted') {
          setInterfaceAcceptances(prev => [...prev, { userId: data.userId, interfaceName: data.interfaceName }]);
          return;
        }

        const addSeenUser = (userId: string) => {
          setSeenUsers(prev => {
            if (prev.has(userId)) return prev;
            const next = new Set([...prev, userId]);
            localStorage.setItem(`v4-seen-users-${room}`, JSON.stringify([...next]));
            return next;
          });
        };

        // Participant tracking — always runs regardless of recording state
        if (data.type === 'userJoined' || data.type === 'userLeft') {
          if (data.type === 'userJoined') {
            setConnectedUsers(prev => new Set([...prev, data.userId]));
            addSeenUser(data.userId);
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
          addSeenUser(cursorUserId);
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

  const snapMoment = () => {
    const regions: Record<string, 'positive' | 'negative' | 'neutral' | null> = {};
    for (const userId of seenUsers) {
      const cursor = liveCursors.get(userId);
      regions[userId] = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null;
    }
    const newMoment: MomentSnapshot = {
      id: crypto.randomUUID(),
      label: momentLabelInput.trim() || `Moment ${moments.length + 1}`,
      timestamp: Date.now(),
      regions,
    };
    const updated = [newMoment, ...moments];
    setMoments(updated);
    localStorage.setItem(`v4-moments-${room}`, JSON.stringify(updated));
    setMomentLabelInput('');
    setEditingMomentId(null);
  };

  const tabLabel = (tab: AdminTab): string => {
    if (tab === 'events') return githubSubmissions.length > 0 ? `Events (${githubSubmissions.length})` : 'Events';
    if (tab === 'participants') return connectedUsers.size > 0 ? `People (${connectedUsers.size})` : 'People';
    if (tab === 'moments') return moments.length > 0 ? `Moments (${moments.length})` : 'Moments';
    if (tab === 'interfaces') return 'Interface';
    if (tab === 'record') return 'Record';
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  const ALL_TABS: AdminTab[] = ['record', 'labels', 'anchors', 'avatars', 'interfaces', 'events', 'participants', 'moments'];

  return (
    <div
      className="v3-admin-panel"
      style={{ padding: 0, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
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
              <p style={{ marginBottom: 4, fontWeight: 600 }}>Role assignments</p>
              <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Push interface invitations to participants from the Participants tab. Use this to revoke all pushed roles.</p>
              <button
                className="v3-admin-btn v3-admin-btn--destructive"
                onClick={() => socket.send(JSON.stringify({ type: 'clearPushedInterfaces' }))}
              >
                Clear all role assignments
              </button>
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
                onChange={e => setParticipantGrouping(e.target.value as 'none' | 'valence' | 'moment')}
                style={{ background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 8px', borderRadius: 4 }}
              >
                <option value="valence">Valence: Current</option>
                <option value="none">None</option>
                <option value="moment">Valence: Moments</option>
              </select>
            </div>

            {participantGrouping === 'moment' && (
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ color: '#aaa', fontSize: 13 }}>Moment:</label>
                <select
                  value={selectedMomentId ?? ''}
                  onChange={e => setSelectedMomentId(e.target.value || null)}
                  style={{ background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 8px', borderRadius: 4 }}
                >
                  <option value="">— select a moment —</option>
                  {moments.map(m => (
                    <option key={m.id} value={m.id}>{m.label} ({new Date(m.timestamp).toLocaleTimeString()})</option>
                  ))}
                </select>
              </div>
            )}

            {seenUsers.size === 0 ? (
              <p style={{ color: '#666', fontSize: 13 }}>No participants seen yet.</p>
            ) : participantGrouping === 'none' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...seenUsers].map(userId => {
                  const online = connectedUsers.has(userId);
                  const cursor = liveCursors.get(userId);
                  const region = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null;
                  return <ParticipantRow key={userId} userId={userId} region={region} labels={activeLabels} online={online} isMenuOpen={openMenuUserId === userId} onMenuToggle={() => setOpenMenuUserId(prev => prev === userId ? null : userId)} onOfferInterface={() => { setOpenMenuUserId(null); setPushTarget({ kind: 'user', userId }); setPendingInterfaceName('social'); }} />;
                })}
              </div>
            ) : participantGrouping === 'moment' ? (
              (() => {
                const chosenMoment = moments.find(m => m.id === selectedMomentId);
                if (!chosenMoment) return <p style={{ color: '#666', fontSize: 13 }}>Select a moment above to group participants.</p>;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
                      const groupKey = String(region);
                      const members = [...seenUsers].filter(userId => (chosenMoment.regions[userId] ?? null) === region);
                      const groupLabel = region === null ? 'Lurking' : activeLabels[region];
                      const collapsed = collapsedGroups.has(`moment-${groupKey}`);
                      const toggleCollapse = () => setCollapsedGroups(prev => {
                        const s = new Set(prev);
                        const key = `moment-${groupKey}`;
                        s.has(key) ? s.delete(key) : s.add(key);
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
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={() => setOpenMenuGroupKey(prev => prev === groupKey ? null : groupKey)}
                                style={{ fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'pointer' }}
                              >
                                ···
                              </button>
                              {openMenuGroupKey === groupKey && (
                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#252525', border: '1px solid #444', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 160 }}>
                                  <button
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={() => { setOpenMenuGroupKey(null); setPushTarget({ kind: 'users', userIds: members, label: groupLabel }); setPendingInterfaceName('social'); }}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                                  >
                                    Offer interface…
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {!collapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {members.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                                  <span style={{ width: 8, height: 8, flexShrink: 0 }} />
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', fontStyle: 'italic', flex: 1 }}>empty</span>
                                </div>
                              ) : members.map(userId => {
                                const online = connectedUsers.has(userId);
                                return <ParticipantRow key={userId} userId={userId} region={region} labels={activeLabels} online={online} isMenuOpen={openMenuUserId === userId} onMenuToggle={() => setOpenMenuUserId(prev => prev === userId ? null : userId)} onOfferInterface={() => { setOpenMenuUserId(null); setPushTarget({ kind: 'user', userId }); setPendingInterfaceName('social'); }} />;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
                  const groupKey = String(region);
                  const members = [...connectedUsers].filter(userId => {
                    const cursor = liveCursors.get(userId);
                    if (!cursor) return region === null;
                    return computeReactionRegion(cursor.x, cursor.y, activeAnchors) === region;
                  });
                  const offlineMembers = [...seenUsers].filter(userId => !connectedUsers.has(userId));
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
                          {groupLabel} ({members.length}{region === null && offlineMembers.length > 0 ? ` + ${offlineMembers.length} offline` : ''})
                        </span>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setOpenMenuGroupKey(prev => prev === groupKey ? null : groupKey)}
                            style={{ fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'pointer' }}
                          >
                            ···
                          </button>
                          {openMenuGroupKey === groupKey && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#252525', border: '1px solid #444', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 160 }}>
                              <button
                                onPointerDown={e => e.stopPropagation()}
                                onClick={() => { setOpenMenuGroupKey(null); setPushTarget({ kind: 'region', region }); setPendingInterfaceName('social'); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                              >
                                Offer interface…
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {!collapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {members.length === 0 && (region !== null || offlineMembers.length === 0) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                              <span style={{ width: 8, height: 8, flexShrink: 0 }} />
                              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', fontStyle: 'italic', flex: 1 }}>empty</span>
                              <button disabled style={{ opacity: 0, fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'not-allowed' }}>···</button>
                            </div>
                          ) : null}
                          {members.map(userId => (
                            <ParticipantRow key={userId} userId={userId} region={region} labels={activeLabels} online={true} isMenuOpen={openMenuUserId === userId} onMenuToggle={() => setOpenMenuUserId(prev => prev === userId ? null : userId)} onOfferInterface={() => { setOpenMenuUserId(null); setPushTarget({ kind: 'user', userId }); setPendingInterfaceName('social'); }} />
                          ))}
                          {region === null && offlineMembers.map(userId => (
                            <ParticipantRow key={userId} userId={userId} region={null} labels={activeLabels} online={false} isMenuOpen={false} onMenuToggle={() => {}} onOfferInterface={() => {}} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {seenUsers.size > 0 && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    localStorage.removeItem(`v4-seen-users-${room}`);
                    setSeenUsers(new Set());
                  }}
                  style={{ fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                >
                  Clear history
                </button>
              </div>
            )}

            {interfaceAcceptances.length > 0 && (
              <div style={{ marginTop: 20, borderTop: '1px solid #333', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Acceptances</div>
                {interfaceAcceptances.map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#6c6', fontFamily: 'monospace', padding: '2px 0' }}>
                    ✓ {a.userId} accepted "{a.interfaceName}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MOMENTS tab */}
        {activeTab === 'moments' && (
          <div>
            {/* "Now" card — preview of current state, doubles as snap form */}
            {(() => {
              const nowCounts = { positive: 0, negative: 0, neutral: 0, lurking: 0 };
              for (const userId of seenUsers) {
                const cursor = liveCursors.get(userId);
                const r = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null;
                if (r === 'positive') nowCounts.positive++;
                else if (r === 'negative') nowCounts.negative++;
                else if (r === 'neutral') nowCounts.neutral++;
                else nowCounts.lurking++;
              }
              const isEditingNow = editingMomentId === '__now__';
              const nowExpanded = expandedMoments.has('__now__');
              return (
                <div style={{ border: '2px solid #1a7a3c', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#162b1e', cursor: 'pointer' }}
                    onClick={() => setExpandedMoments(prev => { const s = new Set(prev); s.has('__now__') ? s.delete('__now__') : s.add('__now__'); return s; })}
                  >
                    <span style={{ fontSize: 10, color: '#4c4', width: 12, textAlign: 'center', flexShrink: 0 }}>{nowExpanded ? '▼' : '▶'}</span>
                    {isEditingNow ? (
                      <input
                        autoFocus
                        value={momentLabelInput}
                        onChange={e => setMomentLabelInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingMomentId(null);
                        }}
                        onBlur={() => setEditingMomentId(null)}
                        onClick={e => e.stopPropagation()}
                        placeholder="Label for next snap…"
                        style={{ flex: 1, background: '#1e3828', color: '#eee', border: '1px solid #2a6040', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: 13, color: momentLabelInput ? '#cec' : '#7c7', fontStyle: momentLabelInput ? 'normal' : 'italic', fontWeight: 600 }}>
                        {momentLabelInput || 'Now'}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setEditingMomentId('__now__'); }}
                      style={{ background: 'none', border: 'none', color: '#4a4', cursor: 'pointer', fontSize: 11, padding: '0 4px', flexShrink: 0 }}
                      title="Set label"
                    >✏</button>
                  </div>
                  <div style={{ display: 'flex', gap: 16, padding: '6px 30px', background: '#111e16', fontSize: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: '#4c4' }}>{activeLabels.positive}: {nowCounts.positive}</span>
                    <span style={{ color: '#c44' }}>{activeLabels.negative}: {nowCounts.negative}</span>
                    <span style={{ color: '#88a' }}>{activeLabels.neutral}: {nowCounts.neutral}</span>
                    {nowCounts.lurking > 0 && <span style={{ color: '#555' }}>Lurking: {nowCounts.lurking}</span>}
                  </div>
                  {nowExpanded && (
                    <div style={{ padding: '8px 10px 12px', background: '#0e1a12' }}>
                      {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
                        const members = [...seenUsers].filter(userId => {
                          const cursor = liveCursors.get(userId);
                          return (cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null) === region;
                        });
                        const groupLabel = region === null ? 'Lurking' : activeLabels[region];
                        return (
                          <div key={String(region)} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                              {groupLabel} ({members.length})
                            </div>
                            {members.length === 0 ? (
                              <div style={{ fontSize: 12, color: '#2a4a2a', fontStyle: 'italic', paddingLeft: 8 }}>empty</div>
                            ) : members.map(userId => {
                              const online = connectedUsers.has(userId);
                              const regionColor = region === 'positive' ? '#4a4' : region === 'negative' ? '#a44' : region === 'neutral' ? '#66a' : '#555';
                              return (
                                <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: online ? regionColor : '#333', display: 'inline-block' }} />
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userId}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={snapMoment}
                    style={{ display: 'block', width: '100%', padding: '12px', background: '#1a7a3c', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Snap Moment
                  </button>
                </div>
              );
            })()}

            {moments.length === 0 ? (
              <p style={{ color: '#666', fontSize: 13 }}>No moments captured yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {moments.map(moment => {
                  const counts = { positive: 0, negative: 0, neutral: 0, lurking: 0 };
                  for (const r of Object.values(moment.regions)) {
                    if (r === 'positive') counts.positive++;
                    else if (r === 'negative') counts.negative++;
                    else if (r === 'neutral') counts.neutral++;
                    else counts.lurking++;
                  }
                  const expanded = expandedMoments.has(moment.id);
                  const isEditing = editingMomentId === moment.id;
                  return (
                    <div key={moment.id} style={{ border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#1e1e1e', cursor: 'pointer' }}
                        onClick={() => setExpandedMoments(prev => { const s = new Set(prev); s.has(moment.id) ? s.delete(moment.id) : s.add(moment.id); return s; })}
                      >
                        <span style={{ fontSize: 10, color: '#666', width: 12, textAlign: 'center', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingMomentLabel}
                            onChange={e => setEditingMomentLabel(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const updated = moments.map(m => m.id === moment.id ? { ...m, label: editingMomentLabel.trim() || m.label } : m);
                                setMoments(updated);
                                localStorage.setItem(`v4-moments-${room}`, JSON.stringify(updated));
                                setEditingMomentId(null);
                              } else if (e.key === 'Escape') {
                                setEditingMomentId(null);
                              }
                            }}
                            onBlur={() => setEditingMomentId(null)}
                            onClick={e => e.stopPropagation()}
                            style={{ flex: 1, background: '#2a2a2a', color: '#eee', border: '1px solid #555', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}
                          />
                        ) : (
                          <span style={{ flex: 1, fontSize: 13, color: '#ddd' }}>{moment.label}</span>
                        )}
                        <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>{new Date(moment.timestamp).toLocaleTimeString()}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingMomentId(moment.id); setEditingMomentLabel(moment.label); }}
                          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, padding: '0 4px', flexShrink: 0 }}
                          title="Rename"
                        >✏</button>
                        <button
                          onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${moment.label}"?`)) { const updated = moments.filter(m => m.id !== moment.id); setMoments(updated); localStorage.setItem(`v4-moments-${room}`, JSON.stringify(updated)); } }}
                          style={{ background: 'none', border: 'none', color: '#633', cursor: 'pointer', fontSize: 11, padding: '0 4px', flexShrink: 0 }}
                          title="Delete"
                        >✕</button>
                      </div>
                      <div style={{ display: 'flex', gap: 16, padding: '6px 30px', background: '#181818', fontSize: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: '#4c4' }}>{activeLabels.positive}: {counts.positive}</span>
                        <span style={{ color: '#c44' }}>{activeLabels.negative}: {counts.negative}</span>
                        <span style={{ color: '#88a' }}>{activeLabels.neutral}: {counts.neutral}</span>
                        {counts.lurking > 0 && <span style={{ color: '#555' }}>Lurking: {counts.lurking}</span>}
                      </div>
                      {expanded && (
                        <div style={{ padding: '8px 10px 12px', background: '#151515' }}>
                          {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
                            const groupKey = String(region);
                            const members = Object.entries(moment.regions)
                              .filter(([, r]) => (r ?? null) === region)
                              .map(([uid]) => uid);
                            const groupLabel = region === null ? 'Lurking' : activeLabels[region];
                            return (
                              <div key={groupKey} style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                                  {groupLabel} ({members.length})
                                </div>
                                {members.length === 0 ? (
                                  <div style={{ fontSize: 12, color: '#444', fontStyle: 'italic', paddingLeft: 8 }}>empty</div>
                                ) : members.map(userId => {
                                  const online = connectedUsers.has(userId);
                                  const regionColor = region === 'positive' ? '#4a4' : region === 'negative' ? '#a44' : region === 'neutral' ? '#66a' : '#555';
                                  return (
                                    <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: online ? regionColor : '#333', display: 'inline-block' }} />
                                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aaa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userId}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
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

      {pushTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onPointerDown={() => { setPushTarget(null); setPendingInterfaceName('social'); }}
        >
          <div
            style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 10, padding: '20px 20px 16px', width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}
            onPointerDown={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, color: '#888' }}>
              Offer interface to{' '}
              {pushTarget.kind === 'user'
                ? <span style={{ color: '#ccc', fontFamily: 'monospace' }}>{pushTarget.userId}</span>
                : pushTarget.kind === 'users'
                  ? <span style={{ color: '#ccc' }}>{pushTarget.label} ({pushTarget.userIds.length})</span>
                  : <span style={{ color: '#ccc' }}>{pushTarget.region === null ? 'Lurking' : activeLabels[pushTarget.region]} group</span>
              }
            </div>
            <select
              value={pendingInterfaceName}
              onChange={e => setPendingInterfaceName(e.target.value)}
              autoFocus
              style={{ background: '#333', border: '1px solid #555', color: '#eee', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
            >
              <option value="social">social</option>
              <option value="emcee">emcee</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  socket.send(JSON.stringify({
                    type: 'pushInterface',
                    ...(pushTarget.kind === 'user' ? { targetUserId: pushTarget.userId } : pushTarget.kind === 'users' ? { targetUserIds: pushTarget.userIds } : { targetRegion: pushTarget.region }),
                    interfaceName: pendingInterfaceName,
                  }));
                  setPushTarget(null);
                  setPendingInterfaceName('social');
                }}
                style={{ flex: 1, padding: '8px', background: '#2a5cba', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
              >
                Send
              </button>
              <button
                onClick={() => { setPushTarget(null); setPendingInterfaceName('social'); }}
                style={{ padding: '8px 14px', background: 'none', border: '1px solid #444', color: '#888', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
