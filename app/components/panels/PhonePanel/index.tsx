/**
 * PhonePanel — WebRTC P2P voice calls via PartyKit signaling
 *
 * ─── Audio routing — platform summary ────────────────────────────────────────
 *
 * iOS (all browsers):
 *   All iOS browsers use WebKit. The OS handles audio routing automatically —
 *   BT devices are never exposed via enumerateDevices() regardless of connection
 *   state, so external audio detection always returns false. We skip the
 *   speakerphone warning entirely on iOS rather than showing a false alarm.
 *   Whether audio constraints (echoCancellation etc.) influence routing on iOS
 *   is unconfirmed from real data — the OS likely decides independently.
 *
 * Android Chrome:
 *   Same MODE_IN_COMMUNICATION trick works for the mic side, but output routing
 *   does not follow. In practice, WebRTC audio on Android Chrome plays through
 *   the speakerphone regardless of MODE_IN_COMMUNICATION — the built-in earpiece
 *   is not reachable as a web audio output. setSinkId() is NOT supported on
 *   Android Chrome, and there is no known way to select an output sink from the
 *   browser on Android. External audio (BT/wired) is the only escape from
 *   speakerphone.
 *
 * Android Firefox:
 *   setSinkId() not supported. enumerateDevices() returns only a single generic
 *   "Default audio input device" in audioinput and zero audiooutput entries —
 *   even when a BT device is actively connected. BT detection is therefore
 *   impossible on Android Firefox; our speakerphone warning will always fire
 *   there regardless of headphone state. No known workaround.
 *   Ref: https://bugzilla.mozilla.org/show_bug.cgi?id=1681772
 *
 * Desktop (Chrome/Firefox/Safari):
 *   Full setSinkId() support on Chrome/Edge. Firefox desktop supports
 *   selectAudioOutput() (since v116) which grants speaker-selection permission
 *   without requiring mic access first — more privacy-preserving.
 *   Ref: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput
 *
 * ─── enumerateDevices() on Android — phantom routing modes ───────────────────
 *
 * Chromium's AudioManagerAndroid.java maps Android AudioManager routing modes
 * to enumerateDevices() entries as a fixed-index array. This means several
 * "devices" are always present regardless of connected hardware:
 *
 *   Index 0: "Speakerphone"     ← always present, routing mode only
 *   Index 1: "Wired headset"    ← appears when wired headset plugged in  ✓ real
 *   Index 2: "Headset earpiece" ← always present, the phone's earpiece   ✗ phantom
 *   Index 3: "Bluetooth headset"← appears when BT device connected       ✓ real
 *   Index 4: "USB audio"        ← appears when USB audio device connected ✓ real
 *
 * Ref: https://github.com/Samsung/ChromiumGStreamerBackend/blob/master/media/base/android/java/src/org/chromium/media/AudioManagerAndroid.java
 *
 * "Headset earpiece" is NOT a connected external headset — it's the phone's
 * built-in front speaker, always present. Do not use it as a detection signal.
 * Only indices 1, 3, 4 are real connectable devices that appear/disappear.
 * EXTERNAL_AUDIO_CLASSES reflects this: 'earpiece' is intentionally excluded.
 *
 * ─── Permission model ─────────────────────────────────────────────────────────
 *
 * Before any permission: enumerateDevices() returns device kinds only — no
 * labels, no deviceIds (empty strings).
 *
 * After mic permission (getUserMedia audio): Chrome and Firefox 140+ expose
 * labels for ALL audio devices (both audioinput and audiooutput). This is a
 * known privacy compromise — Firefox originally required a separate
 * speaker-selection permission but aligned with Chrome in v140 for compat.
 *
 * navigator.permissions.query({ name: 'speaker-selection' }) is experimental
 * and broken in most browsers — not worth relying on.
 * Ref: https://github.com/mdn/browser-compat-data/issues/17033
 *
 * Video permission does NOT unlock additional audio device labels.
 *
 * Real-world device data (collected via the in-panel copy button) lives in
 * ./AUDIO_COMPAT.md — update it whenever new browser/device observations are
 * available, and correct anything here that turns out to be wrong.
 *
 * ─── Bluetooth detection strategy ────────────────────────────────────────────
 *
 * After mic permission, check audioinput devices for "Bluetooth headset" label —
 * this is the most reliable dynamic signal on Android Chrome. The label appears
 * in audioinput (not just audiooutput) when a BT device connects, and disappears
 * when it disconnects. We subscribe to devicechange events to react in real time.
 *
 * If no external audio is detected on Android, we show a SpeakerphoneWarningView
 * before the user joins the call queue, giving them a chance to connect headphones.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import usePartySocket from 'partysocket/react';
import { FaPhone, FaPhoneSlash, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { MdScreenLockPortrait } from 'react-icons/md';
import { getPartySocketConfig } from '../../../utils/partyHost';
import { useWebRTCCall } from './useWebRTCCall';
import { useWakeLock } from '../../../utils/useWakeLock';

interface PhonePanelProps {
  room: string;
  userId: string;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isEdge = /EdgA/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Firefox/i.test(ua) && !isEdge;
  const isFirefox = /Firefox/i.test(ua);
  const label = isIOS ? 'ios'
    : isAndroid && isChrome ? 'android-chrome'
    : isAndroid && isEdge ? 'android-edge'
    : isAndroid && isFirefox ? 'android-firefox'
    : isAndroid ? 'android-other'
    : 'desktop';
  return { isIOS, isAndroid, isChrome, isEdge, isFirefox, label };
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
  const [confirming, setConfirming] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [experimentLog, setExperimentLog] = useState<string[]>([]);
  const [deviceChangeCount, setDeviceChangeCount] = useState(0);
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
    if (detected) setConfirming(false);
  };

  useEffect(() => {
    if (!localStream) return;
    enumAudioDevices().then(updateDevices).catch(() => {});

    const handleDeviceChange = () => {
      setDeviceChangeCount(n => n + 1);
      enumAudioDevices().then(updateDevices).catch(() => {});
    };
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
    query: { userId, isPhonePanel: 'true' },
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

  // Call duration timer — pauses during 'reconnecting' so the count survives the gap
  useEffect(() => {
    if (wrtc.callState === 'connected') {
      if (!callStartRef.current) {
        callStartRef.current = Date.now();
        setCallDuration(0);
      }
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - (callStartRef.current ?? Date.now())) / 1000));
      }, 1000);
    } else if (wrtc.callState === 'reconnecting') {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
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

  const { acquired: wakeLockAcquired } = useWakeLock(wrtc.callState !== 'idle');

  // Media Session API — lock-screen call card (iOS 15+) + background tab keep-alive hint.
  // Android Chrome does not show the notification for WebRTC calls regardless of approach
  // tried — see https://github.com/patcon/polislike-partykit-reaction-canvas/issues/112
  // 'hangup' is non-standard; iOS Safari throws on unknown actions so we guard with try/catch.
  // 'stop' is standard infrastructure for if/when Android ever surfaces the notification.
  // playbackState = 'playing' hints to Chrome not to throttle the background tab.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const setHangupHandler = (handler: (() => void) | null) => {
      try { navigator.mediaSession.setActionHandler('hangup' as MediaSessionAction, handler); } catch { /* not supported */ }
    };
    if (wrtc.callState !== 'idle') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: wrtc.callState === 'connected' ? 'In call' : 'Waiting for match',
        artist: 'Polis Voice',
      });
      navigator.mediaSession.playbackState = 'playing';
      setHangupHandler(() => wrtc.hangUp());
      navigator.mediaSession.setActionHandler('stop', () => wrtc.hangUp());
    } else {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      setHangupHandler(null);
      navigator.mediaSession.setActionHandler('stop', null);
    }
    return () => {
      setHangupHandler(null);
      navigator.mediaSession.setActionHandler('stop', null);
    };
  }, [wrtc.callState, wrtc.hangUp]);

  const needsConfirm = platform.isAndroid && hasExternalAudio === false;

  const handleJoinQueue = () => {
    if (needsConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
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

  const activeTrackLabel = localStream?.getAudioTracks()[0]?.label ?? null;

  const [copyLabel, setCopyLabel] = useState('copy');
  const copyDebugInfo = () => {
    const lines: string[] = [
      `timestamp: ${new Date().toISOString()}`,
      `callState: ${wrtc.callState}`,
      `rtc: ${wrtc.rtcConnectionState}`,
      `ice: ${wrtc.iceConnectionState}`,
      `platform: ${platform.label}`,
      `userAgent: ${navigator.userAgent}`,
      `setSinkId: ${hasSinkId ? 'yes' : 'no'}`,
      `selectAudioOutput: ${hasSelectAudioOutput ? 'yes' : 'no'}`,
      `external audio: ${hasExternalAudio === null ? 'checking' : hasExternalAudio ? 'yes' : 'no'}`,
      `devicechange events: ${deviceChangeCount}`,
      `selected sink: ${selectedSinkLabel ?? '(none)'}`,
      `active mic track: ${activeTrackLabel ?? '(none)'}`,
      '',
      `audioinput devices (${audioInputDevices.length}):`,
      ...audioInputDevices.map(d => `  [${classifyDevice(d.label)}] ${d.label || '(no label)'} — ${d.deviceId}`),
      '',
      `audiooutput devices (${audioOutputDevices.length}):`,
      ...audioOutputDevices.map(d => `  [${classifyDevice(d.label)}] ${d.label || '(no label)'} — ${d.deviceId}`),
    ];
    if (experimentLog.length) {
      lines.push('', 'experiment log:', ...experimentLog.map(l => `  ${l}`));
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyLabel('copied!');
      setTimeout(() => setCopyLabel('copy'), 2000);
    }).catch(() => setCopyLabel('failed'));
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#111', color: '#eee', padding: 32, minHeight: 0, position: 'relative',
    }}>
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {wakeLockAcquired && (
        <div title="Screen kept awake" style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555', pointerEvents: 'none' }}>
          <MdScreenLockPortrait size={13} />
          <span>screen on</span>
        </div>
      )}

      {wrtc.callState === 'idle' && (
        <IdleView
          onAccept={handleJoinQueue}
          onCancelConfirm={() => setConfirming(false)}
          disabled={!!micError || !localStream}
          micError={micError}
          speakerphoneWarning={needsConfirm ? (platform.isFirefox ? 'unknown' : 'no-headset') : null}
          confirming={confirming}
        />
      )}
      {wrtc.callState === 'queued' && <QueuedView onCancel={wrtc.cancelQueue} />}
      {wrtc.callState === 'connecting' && <ConnectingView />}
      {wrtc.callState === 'reconnecting' && <ReconnectingView onHangUp={wrtc.hangUp} />}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowDebug(v => !v)}
            style={{ background: 'none', border: 'none', color: '#444', fontSize: 11, cursor: 'pointer', padding: '4px 0' }}
          >
            {showDebug ? '▾' : '▸'} audio debug
          </button>
          {showDebug && (
            <button onClick={copyDebugInfo} style={{ background: 'none', border: '1px solid #333', color: '#555', fontSize: 10, cursor: 'pointer', padding: '2px 6px', borderRadius: 3 }}>
              {copyLabel}
            </button>
          )}
        </div>
        {showDebug && (
          <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, padding: 10, fontSize: 11, fontFamily: 'monospace', maxHeight: '60vh', overflowY: 'auto' }}>

            {/* Section 0 — Call state */}
            <div style={{ color: '#777', marginBottom: 6, textTransform: 'uppercase', fontSize: 10, letterSpacing: 1 }}>call state</div>
            <div style={{ color: '#666', marginBottom: 4 }}>
              callState: <span style={{ color: '#4af' }}>{wrtc.callState}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 4 }}>
              rtc: <span style={{ color: wrtc.rtcConnectionState === 'connected' ? '#4c4' : wrtc.rtcConnectionState === '—' ? '#555' : '#fa4' }}>{wrtc.rtcConnectionState}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 12 }}>
              ice: <span style={{ color: wrtc.iceConnectionState === 'connected' || wrtc.iceConnectionState === 'completed' ? '#4c4' : wrtc.iceConnectionState === '—' ? '#555' : '#fa4' }}>{wrtc.iceConnectionState}</span>
            </div>

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
            <div style={{ color: '#666', marginBottom: 4 }}>
              selected sink: <span style={{ color: '#aaa' }}>{selectedSinkLabel ?? '(none yet)'}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 4 }}>
              active mic track: <span style={{ color: '#aaa' }}>{activeTrackLabel ?? '(none)'}</span>
            </div>
            <div style={{ color: '#666', marginBottom: 12 }}>
              devicechange events: <span style={{ color: '#aaa' }}>{deviceChangeCount}</span>
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

function IdleView({ onAccept, onCancelConfirm, disabled, micError, speakerphoneWarning, confirming }: {
  onAccept: () => void;
  onCancelConfirm: () => void;
  disabled: boolean;
  micError: string | null;
  speakerphoneWarning: 'no-headset' | 'unknown' | null;
  confirming: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 280, width: '100%' }}>
      <div style={{ fontSize: 48, color: '#555' }}>
        <FaPhone />
      </div>
      <p style={{ color: '#888', fontSize: 15, textAlign: 'center', margin: 0 }}>
        Voice calls
      </p>

      {speakerphoneWarning === 'no-headset' && (
        <div style={{ background: '#2a1e00', border: '1px solid #5a3a00', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
          <p style={{ color: '#fa4', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Connect headphones first</p>
          <p style={{ color: '#a87', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            This app is designed for live events. If everyone uses speakerphone it gets chaotic fast — headphones let each person focus on their own call.
          </p>
        </div>
      )}

      {speakerphoneWarning === 'unknown' && (
        <div style={{ background: '#1e1e2a', border: '1px solid #3a3a5a', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
          <p style={{ color: '#88f', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Headphones recommended</p>
          <p style={{ color: '#778', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            This app is designed for live events. Headphones keep things focused — your browser can't confirm whether you have them connected.
          </p>
        </div>
      )}

      {micError && (
        <p style={{ color: '#f55', fontSize: 13, textAlign: 'center', margin: 0 }}>{micError}</p>
      )}

      {confirming ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
          <p style={{ color: '#fa4', fontSize: 13, textAlign: 'center', margin: 0 }}>
            {speakerphoneWarning === 'unknown'
              ? 'Headphones are recommended for live events'
              : 'Connect without headphones?'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onAccept}
              style={{
                background: '#7a4a00', color: '#fca', border: 'none', borderRadius: 8,
                padding: '10px 18px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Connect
            </button>
            <button
              onClick={onCancelConfirm}
              style={{
                background: 'none', color: '#888', border: '1px solid #444',
                borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
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

function ReconnectingView({ onHangUp }: { onHangUp: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div style={{ fontSize: 36, color: '#7a6a1a' }}><FaPhone /></div>
      <p style={{ color: '#aaa', fontSize: 15, textAlign: 'center', margin: 0 }}>
        Reconnecting…
      </p>
      <p style={{ color: '#666', fontSize: 12, textAlign: 'center', margin: 0 }}>
        Your match lost connection briefly
      </p>
      <button
        onClick={onHangUp}
        style={{
          background: 'none', color: '#888', border: '1px solid #444',
          borderRadius: 20, padding: '8px 20px', fontSize: 13, cursor: 'pointer',
        }}
      >
        Hang up
      </button>
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
