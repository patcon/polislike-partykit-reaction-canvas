import { useState, useRef, useEffect } from "react";
import usePartySocket from "partysocket/react";
import { DEFAULT_ANCHORS } from "../utils/voteRegion";
import type { ReactionAnchors } from "../utils/voteRegion";
import { REACTION_LABEL_PRESETS } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";
import Canvas from "./Canvas";
import { countEvents, clearEvents } from "../lib/supabase";

// Rooms whose recordings are protected from deletion via the admin UI.
const PROTECTED_ROOMS = ['irc6creOFGs'];

interface AdminPanelV5Props {
  room: string;
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

export default function AdminPanelV5({ room }: AdminPanelV5Props) {
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

  const [configTab, setConfigTab] = useState<'labels' | 'anchors'>('labels');
  const [userCap, setUserCap] = useState<number | null>(null);
  const [capInput, setCapInput] = useState<string>('');
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [clearingEvents, setClearingEvents] = useState(false);

  // Labels config state
  const [labelSelected, setLabelSelected] = useState<string>('default');
  const [customPositive, setCustomPositive] = useState('');
  const [customNegative, setCustomNegative] = useState('');
  const [customNeutral, setCustomNeutral] = useState('');

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

  const refreshEventCount = () => {
    countEvents(room).then(setEventCount);
  };

  useEffect(() => {
    refreshEventCount();
  }, [room]);

  const handleClearEvents = async () => {
    setClearingEvents(true);
    await clearEvents(room);
    await refreshEventCount();
    setClearingEvents(false);
  };

  const socket = usePartySocket({
    host: window.location.port === '1999' ? `${window.location.hostname}:1999` : process.env.PARTYKIT_HOST,
    room,
    query: { isAdmin: 'true' },
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'presenceCount') {
          setPresenceCount(data.count);
          return;
        }

        if (data.type === 'connected') {
          if ('roomLabels' in data) applyServerLabels(data.roomLabels);
          if ('roomAnchors' in data) applyServerAnchors(data.roomAnchors);
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

        if (data.type === 'userCapChanged') {
          setUserCap(data.cap);
          setCapInput(data.cap !== null ? String(data.cap) : '');
          return;
        }
      } catch (e) {
        console.error('AdminPanelV5: failed to parse message', e);
      }
    },
  });

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
        <h1>Reaction Canvas V5 — Admin</h1>
        <p style={{ marginTop: 8, color: '#aaa' }}>Room: <strong style={{ color: '#eee' }}>{room}</strong></p>

        {/* Two-column layout: recordings left, config right */}
        <div style={{ display: 'flex', gap: 48, marginTop: 32, alignItems: 'flex-start' }}>

          {/* Left: recordings + participant cap */}
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

            {/* Recordings section */}
            <div style={{ borderTop: '1px solid #333', paddingTop: 20 }}>
              <p style={{ marginBottom: 12, fontWeight: 600 }}>Supabase Recordings:</p>
              <p style={{ color: '#aaa', fontSize: 14, marginBottom: 16 }}>
                {eventCount === null
                  ? 'Loading…'
                  : <><span style={{ color: '#eee', fontWeight: 600 }}>{eventCount}</span> events recorded for room <code style={{ color: '#9cf', fontSize: 12 }}>{room}</code>{PROTECTED_ROOMS.includes(room) && <span style={{ marginLeft: 8, color: '#f90', fontSize: 12 }}>🔒 protected</span>}</>
                }
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="v3-admin-btn"
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={refreshEventCount}
                >
                  Refresh count
                </button>
                <button
                  className="v3-admin-btn v3-admin-btn--destructive"
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={handleClearEvents}
                  disabled={clearingEvents || (eventCount ?? 0) === 0 || PROTECTED_ROOMS.includes(room)}
                >
                  {clearingEvents ? 'Clearing…' : '✕ Clear all recordings'}
                </button>
              </div>
            </div>
          </div>

          {/* Right: tabbed config */}
          <div style={{ flex: 1, borderLeft: '1px solid #444', paddingLeft: 48 }}>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #444' }}>
              {(['labels', 'anchors'] as const).map(tab => (
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
                  {tab === 'labels' ? 'Labels' : 'Anchors'}
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
                    <input type="radio" name="coordSystem" value="barycentric" checked readOnly style={{ marginRight: 8 }} />
                    Barycentric
                  </label>
                  <label style={{ display: 'block', color: '#666', cursor: 'not-allowed' }}>
                    <input type="radio" name="coordSystem" value="linear" disabled style={{ marginRight: 8 }} />
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

          </div>{/* end right column */}
        </div>{/* end two-column row */}
      </div>}
    </div>
  );
}
