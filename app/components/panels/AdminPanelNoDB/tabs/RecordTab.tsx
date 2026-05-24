import type { RecordingMode, PlaybackFile } from "../types";

const inputStyle: React.CSSProperties = {
  background: '#333',
  border: '1px solid #555',
  color: '#eee',
  padding: '4px 8px',
  borderRadius: 4,
  width: 64,
};

interface RecordTabProps {
  // Cap
  userCap: number | null;
  capInput: string;
  setCapInput: (v: string) => void;
  presenceCount: number;
  sendUserCap: (input: string) => void;
  onRemoveCap: () => void;
  // Recording
  isRecording: boolean;
  serverRecording: boolean;
  mode: RecordingMode;
  eventCount: number;
  displayEvents: object[];
  MAX_TABLE_ROWS: number;
  startRecording: () => void;
  stopRecording: () => void;
  downloadEvents: () => void;
  clearEvents: () => void;
  handleModeChange: (mode: RecordingMode) => void;
  // Playback
  playbackData: PlaybackFile | null;
  isPlaying: boolean;
  isPaused: boolean;
  playbackElapsed: number;
  sortedEventsRef: React.MutableRefObject<Record<string, unknown>[]>;
  handlePlaybackFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  playPlayback: () => void;
  pausePlayback: () => void;
  stopPlayback: () => void;
  seekPlayback: (ms: number) => void;
}

export default function RecordTab({
  userCap, capInput, setCapInput, presenceCount, sendUserCap, onRemoveCap,
  isRecording, serverRecording, mode, eventCount, displayEvents, MAX_TABLE_ROWS,
  startRecording, stopRecording, downloadEvents, clearEvents, handleModeChange,
  playbackData, isPlaying, isPaused, playbackElapsed, sortedEventsRef,
  handlePlaybackFile, playPlayback, pausePlayback, stopPlayback, seekPlayback,
}: RecordTabProps) {
  return (
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
          <button className="v3-admin-btn" style={{ padding: '4px 12px' }} onClick={() => sendUserCap(capInput)}>
            Apply
          </button>
          {userCap !== null && (
            <button className="v3-admin-btn" style={{ padding: '4px 12px' }} onClick={onRemoveCap}>
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
  );
}
