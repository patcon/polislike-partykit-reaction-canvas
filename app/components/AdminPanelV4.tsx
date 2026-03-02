import { useState, useRef } from "react";
import usePartySocket from "partysocket/react";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../utils/voteRegion";
import type { ReactionRegion, ReactionAnchors } from "../utils/voteRegion";
import { REACTION_LABEL_PRESETS } from "../voteLabels";
import type { ReactionLabelSet } from "../voteLabels";

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
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<RecordingMode>('transitions');
  const [configTab, setConfigTab] = useState<'labels' | 'anchors'>('labels');
  const [eventCount, setEventCount] = useState(0);
  const [serverRecording, setServerRecording] = useState(false);

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

        if (data.type === 'connected') {
          if (data.recordingState !== undefined) setServerRecording(data.recordingState);
          if ('roomLabels' in data) applyServerLabels(data.roomLabels);
          if ('roomAnchors' in data) applyServerAnchors(data.roomAnchors);
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
        console.error('AdminPanelV4: failed to parse message', e);
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
    <div className="v3-admin-panel">
      <h1>Reaction Canvas V4 — Admin</h1>
      <p style={{ marginTop: 8, color: '#aaa' }}>Room: <strong style={{ color: '#eee' }}>{room}</strong></p>

      {/* Two-column layout: recording left, config right */}
      <div style={{ display: 'flex', gap: 48, marginTop: 32, alignItems: 'flex-start' }}>

        {/* Left: recording */}
        <div style={{ flexShrink: 0 }}>
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

          <div style={{ marginTop: 24 }}>
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

          <div style={{ marginTop: 16, color: '#aaa' }}>
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

        </div>{/* end right column */}
      </div>{/* end two-column row */}
    </div>
  );
}
