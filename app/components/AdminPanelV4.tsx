import { useState, useRef, useEffect } from "react";
import usePartySocket from "partysocket/react";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../utils/voteRegion";
import type { ReactionRegion, ReactionAnchors } from "../utils/voteRegion";
import { REACTION_LABEL_PRESETS } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";
import Canvas from "./Canvas";

interface AdminPanelV4Props {
  room: string;
}

type RecordingMode = 'transitions' | 'positions';

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

export default function AdminPanelV4({ room }: AdminPanelV4Props) {
  const [mainTab, setMainTab] = useState<'admin' | 'peek'>('admin');
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [tabBarHeight, setTabBarHeight] = useState(46);

  useEffect(() => {
    if (!tabBarRef.current) return;
    const ro = new ResizeObserver(entries => {
      setTabBarHeight(entries[0].contentRect.height);
    });
    ro.observe(tabBarRef.current);
    return () => ro.disconnect();
  }, []);
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<RecordingMode>('transitions');
  const [configTab, setConfigTab] = useState<'labels' | 'anchors' | 'avatars'>('labels');
  const [eventCount, setEventCount] = useState(0);
  const [serverRecording, setServerRecording] = useState(false);
  const [userCap, setUserCap] = useState<number | null>(null);
  const [capInput, setCapInput] = useState<string>('');
  const [presenceCount, setPresenceCount] = useState<number>(0);

  // Labels config state
  const [labelSelected, setLabelSelected] = useState<string>('default');
  const [customPositive, setCustomPositive] = useState('');
  const [customNegative, setCustomNegative] = useState('');
  const [customNeutral, setCustomNeutral] = useState('');

  // Avatar config state
  const [avatarStyle, setAvatarStyle] = useState<string | null>(null);

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

  const [displayEvents, setDisplayEvents] = useState<object[]>([]);
  const MAX_TABLE_ROWS = 200;

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

        if (data.type === 'userCapChanged') {
          setUserCap(data.cap);
          setCapInput(data.cap !== null ? String(data.cap) : '');
          return;
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

  return (
    <div
      className="v3-admin-panel"
      style={{ padding: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Top-level tab bar */}
      <div ref={tabBarRef} style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '2px solid #444', flexShrink: 0 }}>
        {(['admin', 'peek'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            style={{
              padding: '10px 24px',
              background: mainTab === tab ? '#333' : 'transparent',
              color: mainTab === tab ? '#eee' : '#888',
              border: 'none',
              borderBottom: mainTab === tab ? '2px solid #aaa' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: mainTab === tab ? 600 : 400,
            }}
          >
            {tab === 'admin' ? 'Admin' : 'Peek Canvas'}
          </button>
        ))}
      </div>

      {mainTab === 'peek' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Canvas
            room={room}
            userId="admin-peek"
            readOnly={true}
            colorCursorsByVote={true}
            debug={true}
            heightOffset={tabBarHeight}
          />
        </div>
      )}

      {mainTab === 'admin' && <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
      <h1>Reaction Canvas V4 — Admin</h1>
      <p style={{ marginTop: 8, color: '#aaa' }}>Room: <strong style={{ color: '#eee' }}>{room}</strong></p>

      {/* Two-column layout: recording left, config right */}
      <div style={{ display: 'flex', gap: 48, marginTop: 32, alignItems: 'flex-start' }}>

        {/* Left: recording */}
        <div style={{ flexShrink: 0 }}>
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
            <button className="v3-admin-btn" onClick={downloadEvents} disabled={isRecording || eventCount === 0}>
              ↓ Download JSON
            </button>
            <button
              className="v3-admin-btn v3-admin-btn--destructive"
              onClick={clearEvents}
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
        </div>

        {/* Right: tabbed config */}
        <div style={{ flex: 1, borderLeft: '1px solid #444', paddingLeft: 48 }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #444' }}>
        {(['labels', 'anchors', 'avatars'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setConfigTab(tab)}
            style={{
              padding: '8px 20px',
              background: configTab === tab ? '#333' : 'transparent',
              color: configTab === tab ? '#eee' : '#888',
              border: 'none',
              borderBottom: configTab === tab ? '2px solid #aaa' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: configTab === tab ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {tab === 'labels' ? 'Labels' : tab === 'anchors' ? 'Anchors' : 'Avatars'}
          </button>
        ))}
      </div>

      {configTab === 'labels' && (
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

      {configTab === 'anchors' && (
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

      {configTab === 'avatars' && (
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

        </div>{/* end right column */}
      </div>{/* end two-column row */}

      {/* Events table */}
      {displayEvents.length > 0 && (
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
      )}
      </div>}
    </div>
  );
}
