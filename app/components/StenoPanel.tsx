import { useState, useRef, useEffect, useCallback } from "react";
import usePartySocket from "partysocket/react";
import { getPartySocketConfig } from "../utils/partyHost";
import { MdKeyboard, MdStopCircle } from "react-icons/md";
import { MdScreenLockLandscape } from "react-icons/md";

interface StenoPanelProps {
  room: string;
  userId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: (new () => any) | null =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function StenoPanel({ room, userId }: StenoPanelProps) {
  const [stenoText, setStenoText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [lockHolder, setLockHolder] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch { /* wake lock unavailable (low battery, non-secure context, etc.) */ }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRecordingRef.current) acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [acquireWakeLock]);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage(evt) {
      const data = JSON.parse(evt.data);
      if (data.type === 'connected') {
        setStenoText(data.stenoText ?? '');
        setLockHolder(data.stenoLockUserId ?? null);
        return;
      }
      if (data.type === 'stenoTextChanged') { setStenoText(data.text); return; }
      if (data.type === 'stenoLockAcquired') { setLockHolder(data.userId); return; }
      if (data.type === 'stenoLockReleased') {
        setLockHolder(null);
        if (data.userId === userId) stopRecording();
        return;
      }
    },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setInterimText('');
    releaseWakeLock();
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    socket.send(JSON.stringify({ type: 'stenoStopRecording', userId }));
  }, [socket, userId, releaseWakeLock]);

  const startRecording = useCallback(() => {
    socket.send(JSON.stringify({ type: 'stenoStartRecording', userId }));
    setIsRecording(true);
    isRecordingRef.current = true;
    acquireWakeLock();
    try { recognitionRef.current?.start(); } catch { /* ignore if already started */ }
  }, [socket, userId, acquireWakeLock]);

  useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const r = new SpeechRecognitionCtor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = '';
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalChunk += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setInterimText(interim);
      if (finalChunk.trim()) {
        socket.send(JSON.stringify({ type: 'stenoAppendText', userId, text: finalChunk.trim() }));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    r.onend = () => {
      // Chrome auto-stops after silence in continuous mode — restart if still recording
      if (isRecordingRef.current) {
        try { r.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = r;
    return () => { try { r.abort(); } catch { /* ignore */ } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isLockedByOther = lockHolder !== null && lockHolder !== userId;

  return (
    <div className="steno-panel">
      <div className="steno-body">
        <textarea
          className="steno-textarea"
          value={stenoText}
          placeholder="Transcription will appear here..."
          readOnly={isLockedByOther}
          onChange={e => {
            if (isLockedByOther) return;
            socket.send(JSON.stringify({ type: 'stenoSetText', userId, text: e.target.value }));
          }}
        />
        {interimText && <div className="steno-interim">{interimText}</div>}
      </div>
      <div className="steno-footer">
        {isRecording && (
          <span className="steno-wakelock-hint" title="Screen lock active">
            <MdScreenLockLandscape size={16} />
          </span>
        )}
        <button
          className={`steno-record-btn${isRecording ? ' steno-record-btn--active' : ''}${isLockedByOther ? ' steno-record-btn--locked' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLockedByOther || !SpeechRecognitionCtor}
          title={
            !SpeechRecognitionCtor ? 'Speech recognition not supported in this browser'
            : isLockedByOther ? `Another participant is recording`
            : isRecording ? 'Stop transcribing'
            : 'Start transcribing'
          }
        >
          {isRecording ? <MdStopCircle size={20} /> : <MdKeyboard size={20} />}
          {isRecording ? 'Stop' : isLockedByOther ? 'In use' : 'Transcribe'}
        </button>
      </div>
    </div>
  );
}
