import { useEffect, useMemo, useRef, useState } from 'react';
import usePartySocket from 'partysocket/react';
import { FaPhone, FaPhoneSlash, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { getPartySocketConfig } from '../../../utils/partyHost';
import { useWebRTCCall } from './useWebRTCCall';

interface PhonePanelProps {
  room: string;
  userId: string;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Firefox/i.test(ua) && !/EdgA/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const label = isIOS ? 'ios'
    : isAndroid && isChrome ? 'android-chrome'
    : isAndroid && isFirefox ? 'android-firefox'
    : isAndroid ? 'android-other'
    : 'desktop';
  return { isIOS, isAndroid, isChrome, isFirefox, label };
}

function classifyDevice(label: string): 'earpiece' | 'bluetooth' | 'headset' | 'speaker' | 'unknown' {
  const l = label.toLowerCase();
  if (['earpiece', 'handset', 'ear'].some(k => l.includes(k))) return 'earpiece';
  if (['bluetooth', 'a2dp', 'sco', 'wireless', 'airpods', 'buds'].some(k => l.includes(k))) return 'bluetooth';
  if (['headset', 'headphone', 'wired'].some(k => l.includes(k))) return 'headset';
  if (['speaker', 'loud'].some(k => l.includes(k))) return 'speaker';
  return 'unknown';
}

// 'earpiece' is NOT included — on Android it's a phantom routing mode ("Headset earpiece")
// that's always present, not a real connected device. Only BT/wired/USB are real external audio.
const EXTERNAL_AUDIO_CLASSES: ReturnType<typeof classifyDevice>[] = ['bluetooth', 'headset'];

function enumAudioDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
  return navigator.mediaDevices.enumerateDevices().then(devs => ({
    inputs: devs.filter(d => d.kind === 'audioinput'),
    outputs: devs.filter(d => d.kind === 'audiooutput'),
  }));
}

export default function PhonePanel({ room, userId }: PhonePanelProps) {
  const platform = useMemo(() => detectPlatform(), []);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedSinkLabel, setSelectedSinkLabel] = useState<string | null>(null);
  const [hasExternalAudio, setHasExternalAudio] = useState<boolean | null>(null);
  const [showSpeakerphoneWarning, setShowSpeakerphoneWarning] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [experimentLog, setExperimentLog] = useState<string[]>([]);
  const callStartRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Request mic on mount — mediaDevices requires a secure context (HTTPS or localhost)
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone unavailable — open via HTTPS or localhost');
      return;
    }
    // Explicit communication constraints signal MODE_IN_COMMUNICATION on Android,
    // routing audio to the earpiece rather than the loudspeaker.
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      .then(stream => setLocalStream(stream))
      .catch(() => setMicError('Microphone permission denied'));
  }, []);

  const updateDevices = ({ inputs, outputs }: { inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }) => {
    setAudioInputDevices(inputs);
    setAudioOutputDevices(outputs);
    // Check both kinds — on Android, BT headsets appear in audioinput as "Bluetooth headset".
    // "Headset earpiece" and "Speakerphone" are phantom routing modes, not real connected devices.
    const detected = [...inputs, ...outputs].some(d => EXTERNAL_AUDIO_CLASSES.includes(classifyDevice(d.label)));
    setHasExternalAudio(detected);
    if (detected) setShowSpeakerphoneWarning(false);
  };

  useEffect(() => {
    if (!localStream) return;
    enumAudioDevices().then(updateDevices).catch(() => {});

    const handleDeviceChange = () => { enumAudioDevices().then(updateDevices).catch(() => {}); };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      localStream.getTracks().forEach(t => t.stop());
    };
  }, [localStream]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendRef = useRef<(msg: object) => void>(() => {});
  const dispatchRef = useRef<(data: Record<string, unknown>) => Promise<void>>(async () => {});

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage(evt) {
      try {
        void dispatchRef.current(JSON.parse(evt.data) as Record<string, unknown>);
      } catch {}
    },
  });

  sendRef.current = (msg) => socket.send(JSON.stringify(msg));

  const wrtc = useWebRTCCall(sendRef, localStream);
  dispatchRef.current = wrtc.handleServerMessage;

  // Attach remote audio stream, then try to route to earpiece (best-effort, Firefox Android)
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || !wrtc.remoteStream) return;
    el.srcObject = wrtc.remoteStream;
    el.play().catch(() => {});

    if (!('setSinkId' in el)) {
      setSelectedSinkLabel('(setSinkId not supported)');
      return;
    }
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      const earpiece = outputs.find(d => EXTERNAL_AUDIO_CLASSES.includes(classifyDevice(d.label)));
      if (earpiece) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any).setSinkId(earpiece.deviceId)
          .then(() => setSelectedSinkLabel(earpiece.label || earpiece.deviceId))
          .catch((err: unknown) => setSelectedSinkLabel(`setSinkId failed: ${err}`));
      } else {
        setSelectedSinkLabel('(no earpiece device found)');
      }
    }).catch(() => setSelectedSinkLabel('(enumerateDevices failed)'));
  }, [wrtc.remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (wrtc.callState === 'connected') {
      callStartRef.current = Date.now();
      setCallDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - (callStartRef.current ?? Date.now())) / 1000));
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      callStartRef.current = null;
      setCallDuration(0);
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [wrtc.callState]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleJoinQueue = () => {
    if (platform.isAndroid && hasExternalAudio === false) {
      setShowSpeakerphoneWarning(true);
      return;
    }
    wrtc.joinQueue();
  };

  const logExperiment = (line: string) => setExperimentLog(prev => [...prev, line]);

  const trySelectAudioOutput = async () => {
    const mda = navigator.mediaDevices as MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
    if (!mda.selectAudioOutput) return;
    const beforeOut = audioOutputDevices.length;
    try {
      const picked = await mda.selectAudioOutput();
      const after = await enumAudioDevices();
      updateDevices(after);
      logExperiment(`selectAudioOutput: picked "${picked.label}" — outputs ${beforeOut}→${after.outputs.length}`);
    } catch (err) {
      logExperiment(`selectAudioOutput: ${err}`);
    }
  };

  const tryReEnumerate = async () => {
    const beforeIn = audioInputDevices.length;
    const beforeOut = audioOutputDevices.length;
    const after = await enumAudioDevices();
    updateDevices(after);
    const newIn = after.inputs.map(d => d.label).filter(l => !audioInputDevices.some(d => d.label === l));
    const newOut = after.outputs.map(d => d.label).filter(l => !audioOutputDevices.some(d => d.label === l));
    logExperiment(`re-enumerate: in ${beforeIn}→${after.inputs.length}, out ${beforeOut}→${after.outputs.length}${[...newIn, ...newOut].length ? `, new: ${[...newIn, ...newOut].join(', ')}` : ''}`);
  };

  const tryAudioVideo = async () => {
    const beforeIn = audioInputDevices.length;
    const beforeOut = audioOutputDevices.length;
    let videoStream: MediaStream | null = null;
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const after = await enumAudioDevices();
      updateDevices(after);
      const newIn = after.inputs.map(d => d.label).filter(l => !audioInputDevices.some(d => d.label === l));
      const newOut = after.outputs.map(d => d.label).filter(l => !audioOutputDevices.some(d => d.label === l));
      logExperiment(`audio+video: in ${beforeIn}→${after.inputs.length}, out ${beforeOut}→${after.outputs.length}${[...newIn, ...newOut].length ? `, new: ${[...newIn, ...newOut].join(', ')}` : ' (no new labels)'}`);
    } catch (err) {
      logExperiment(`audio+video: ${err}`);
    } finally {
      videoStream?.getTracks().forEach(t => t.stop());
    }
  };

  const hasSinkId = 'setSinkId' in HTMLAudioElement.prototype;
  const hasSelectAudioOutput = 'selectAudioOutput' in navigator.mediaDevices;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#111', color: '#eee', padding: 32, minHeight: 0, position: 'relative',
    }}>
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {wrtc.callState === 'idle' && showSpeakerphoneWarning ? (
        <SpeakerphoneWarningView
          onProceed={() => { setShowSpeakerphoneWarning(false); wrtc.joinQueue(); }}
          onCancel={() => setShowSpeakerphoneWarning(false)}
        />
      ) : wrtc.callState === 'idle' ? (
        <IdleView
          onAccept={handleJoinQueue}
          disabled={!!micError || !localStream}
          micError={micError}
        />
      ) : null}
      {wrtc.callState === 'queued' && <QueuedView onCancel={wrtc.cancelQueue} />}
      {wrtc.callState === 'connecting' && <ConnectingView />}
      {wrtc.callState === 'connected' && (
        <ConnectedView
          peerId={wrtc.peerId}
          duration={formatDuration(callDuration)}
          isMuted={wrtc.isMuted}
          onToggleMute={wrtc.toggleMute}
          onHangUp={wrtc.hangUp}
        />
      )}

      {/* Debug panel — bottom of screen */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 12px 8px' }}>
        <button
          onClick={() => setShowDebug(v => !v)}
          style={{ background: 'none', border: 'none', color: '#444', fontSize: 11, cursor: 'pointer', padding: '4px 0' }}
        >
          {showDebug ? '▾' : '▸'} audio debug
        </button>
        {showDebug && (
          <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, padding: 10, fontSize: 11, fontFamily: 'monospace', maxHeight: '60vh', overflowY: 'auto' }}>

            {/* Section A — Environment */}
            <div style={{ color: '#777', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 1 }}>environment</div>
            <div style={{ color: '#666', marginBottom: 4 }}>
              platform: <span style={{ color: '#aaa' }}>{platform.label}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 4 }}>
              setSinkId: <span style={{ color: hasSinkId ? '#4c4' : '#f55' }}>{hasSinkId ? 'yes' : 'no'}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 4 }}>
              selectAudioOutput: <span style={{ color: hasSelectAudioOutput ? '#4c4' : '#f55' }}>{hasSelectAudioOutput ? 'yes (Firefox)' : 'no'}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 4 }}>
              external audio: <span style={{
                color: hasExternalAudio === null ? '#888' : hasExternalAudio ? '#4c4' : '#fa4'
              }}>{hasExternalAudio === null ? 'checking…' : hasExternalAudio ? 'yes (BT/wired)' : 'no — phone only'}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 12 }}>
              selected sink: <span style={{ color: '#aaa' }}>{selectedSinkLabel ?? '(none yet)'}</span>
            </div>

            {/* Section B — Devices */}
            {[
              { label: 'audioinput', devices: audioInputDevices },
              { label: 'audiooutput', devices: audioOutputDevices },
            ].map(({ label: kind, devices }) => (
              <div key={kind}>
                <div style={{ color: '#777', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 1 }}>
                  {kind} devices ({devices.length})
                </div>
                {devices.length === 0 ? (
                  <div style={{ color: '#555', marginBottom: 12 }}>
                    {localStream ? '(none returned)' : 'grant mic permission first'}
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    {devices.map((d, i) => {
                      const cls = classifyDevice(d.label);
                      const clsColor: Record<string, string> = { earpiece: '#4c4', bluetooth: '#4af', headset: '#4af', speaker: '#f84', unknown: '#666' };
                      return (
                        <div key={i} style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid #333' }}>
                          <div style={{ color: '#ccc' }}>
                            {d.label || '(no label)'}
                            {' '}
                            <span style={{ color: clsColor[cls] ?? '#666', fontSize: 10 }}>[{cls}]</span>
                          </div>
                          <div style={{ color: '#555' }}>{d.deviceId.slice(0, 20)}{d.deviceId.length > 20 ? '…' : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Section C — Permission experiments */}
            <div style={{ color: '#777', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 1 }}>permission experiments</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {hasSelectAudioOutput && (
                <button onClick={trySelectAudioOutput} style={btnStyle}>
                  Try selectAudioOutput() — Firefox only
                </button>
              )}
              <button onClick={tryReEnumerate} style={btnStyle}>
                Re-enumerate devices
              </button>
              <button onClick={tryAudioVideo} style={btnStyle}>
                Try audio+video permission
              </button>
            </div>
            {experimentLog.length > 0 && (
              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 6 }}>
                {experimentLog.map((line, i) => (
                  <div key={i} style={{ color: '#7a7', marginBottom: 3 }}>{line}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#222', border: '1px solid #444', color: '#aaa',
  borderRadius: 4, padding: '4px 8px', fontSize: 10, cursor: 'pointer', textAlign: 'left',
};

function SpeakerphoneWarningView({ onProceed, onCancel }: { onProceed: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 280, textAlign: 'center' }}>
      <div style={{ fontSize: 40, color: '#fa4' }}>⚠</div>
      <p style={{ color: '#fa4', fontSize: 16, fontWeight: 600, margin: 0 }}>No headphones detected</p>
      <p style={{ color: '#888', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
        Your call audio may play through the speakerphone. Connect Bluetooth headphones or wired earphones first, or proceed anyway.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <button
          onClick={onProceed}
          style={{
            background: '#7a4a00', color: '#fca', border: 'none', borderRadius: 8,
            padding: '12px 20px', fontSize: 14, cursor: 'pointer',
          }}
        >
          Use speakerphone anyway
        </button>
        <button
          onClick={onCancel}
          style={{
            background: 'none', color: '#888', border: '1px solid #444',
            borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function IdleView({ onAccept, disabled, micError }: { onAccept: () => void; disabled: boolean; micError: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div style={{ fontSize: 48, color: '#555' }}>
        <FaPhone />
      </div>
      <p style={{ color: '#888', fontSize: 15, textAlign: 'center', margin: 0 }}>
        Voice calls
      </p>
      {micError && (
        <p style={{ color: '#f55', fontSize: 13, textAlign: 'center', margin: 0 }}>{micError}</p>
      )}
      <button
        onClick={onAccept}
        disabled={disabled}
        style={{
          background: disabled ? '#333' : '#1a7a1a',
          color: disabled ? '#555' : '#fff',
          border: 'none', borderRadius: 50, width: 72, height: 72,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
        aria-label="Accept call"
      >
        <FaPhone />
      </button>
      <p style={{ color: '#666', fontSize: 12, textAlign: 'center', margin: 0 }}>
        Tap to be connected with the next available person
      </p>
    </div>
  );
}

function QueuedView({ onCancel }: { onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid #1a7a1a',
          animation: 'phone-ring-pulse 1.5s ease-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 8, borderRadius: '50%',
          border: '2px solid #1a7a1a', opacity: 0.6,
          animation: 'phone-ring-pulse 1.5s ease-out infinite 0.3s',
        }} />
        <div style={{
          position: 'absolute', inset: 16, borderRadius: '50%',
          background: '#1a7a1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: '#fff',
        }}>
          <FaPhone />
        </div>
      </div>
      <p style={{ color: '#aaa', fontSize: 15, textAlign: 'center', margin: 0 }}>
        Awaiting candidate connection…
      </p>
      <button
        onClick={onCancel}
        style={{
          background: 'none', color: '#888', border: '1px solid #444',
          borderRadius: 20, padding: '8px 20px', fontSize: 13, cursor: 'pointer',
        }}
      >
        Cancel
      </button>
      <style>{`
        @keyframes phone-ring-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ConnectingView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 36, color: '#1a7a1a' }}><FaPhone /></div>
      <p style={{ color: '#aaa', fontSize: 15, margin: 0 }}>Connecting…</p>
    </div>
  );
}

function ConnectedView({
  peerId, duration, isMuted, onToggleMute, onHangUp,
}: {
  peerId: string | null;
  duration: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#888', fontSize: 12, margin: '0 0 4px' }}>Connected</p>
        <p style={{ color: '#eee', fontSize: 22, fontVariantNumeric: 'tabular-nums', margin: 0, fontFamily: 'monospace' }}>
          {duration}
        </p>
        {peerId && (
          <p style={{ color: '#555', fontSize: 11, margin: '6px 0 0', fontFamily: 'monospace' }}>
            {peerId.length > 16 ? `${peerId.slice(0, 8)}…${peerId.slice(-6)}` : peerId}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <button
          onClick={onToggleMute}
          style={{
            background: isMuted ? '#7a2a00' : '#2a2a2a',
            color: isMuted ? '#f88' : '#ccc',
            border: 'none', borderRadius: 50, width: 56, height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, cursor: 'pointer',
          }}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </button>
        <button
          onClick={onHangUp}
          style={{
            background: '#7a1a1a',
            color: '#fff',
            border: 'none', borderRadius: 50, width: 72, height: 72,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, cursor: 'pointer',
          }}
          aria-label="Hang up"
        >
          <FaPhoneSlash />
        </button>
      </div>
    </div>
  );
}
