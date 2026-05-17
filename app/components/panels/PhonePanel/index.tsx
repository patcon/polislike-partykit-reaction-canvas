import { useEffect, useRef, useState } from 'react';
import usePartySocket from 'partysocket/react';
import { FaPhone, FaPhoneSlash, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';
import { getPartySocketConfig } from '../../../utils/partyHost';
import { useWebRTCCall } from './useWebRTCCall';

interface PhonePanelProps {
  room: string;
  userId: string;
}

export default function PhonePanel({ room, userId }: PhonePanelProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
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

  useEffect(() => {
    if (!localStream) return;
    return () => localStream.getTracks().forEach(t => t.stop());
  }, [localStream]);

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

  // Attach remote audio stream
  useEffect(() => {
    if (remoteAudioRef.current && wrtc.remoteStream) {
      remoteAudioRef.current.srcObject = wrtc.remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
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

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#111', color: '#eee', padding: 32, minHeight: 0,
    }}>
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {wrtc.callState === 'idle' && (
        <IdleView
          onAccept={wrtc.joinQueue}
          disabled={!!micError || !localStream}
          micError={micError}
        />
      )}

      {wrtc.callState === 'queued' && (
        <QueuedView onCancel={wrtc.cancelQueue} />
      )}

      {wrtc.callState === 'connecting' && (
        <ConnectingView />
      )}

      {wrtc.callState === 'connected' && (
        <ConnectedView
          peerId={wrtc.peerId}
          duration={formatDuration(callDuration)}
          isMuted={wrtc.isMuted}
          onToggleMute={wrtc.toggleMute}
          onHangUp={wrtc.hangUp}
        />
      )}
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
