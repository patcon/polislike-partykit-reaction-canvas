import { useState, useRef, useEffect, useCallback } from "react";
import usePartySocket from "partysocket/react";
import { getPartySocketConfig } from "../utils/partyHost";
import { MdKeyboard, MdStopCircle } from "react-icons/md";
import WakeLockIndicatorButton from "./WakeLockIndicatorButton";

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
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const isRecordingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // baseTextRef: server text captured when recording started; carried forward across
  // onend/restart cycles so each new recognition run appends to the right base.
  // sessionFinalRef: transcript of the latest final result in the current run.
  const baseTextRef = useRef('');
  const sessionFinalRef = useRef('');

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockActive(true);
    } catch { /* unavailable: low battery, non-secure context, etc. */ }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeLockActive(false);
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
    baseTextRef.current = stenoText;
    sessionFinalRef.current = '';
    setIsRecording(true);
    isRecordingRef.current = true;
    acquireWakeLock();
    try { recognitionRef.current?.start(); } catch { /* ignore if already started */ }
  }, [socket, userId, acquireWakeLock, stenoText]);

  useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const r = new SpeechRecognitionCtor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (!e.results[i].isFinal) interim += e.results[i][0].transcript;
      }
      setInterimText(interim);

      // Only process the result that just changed (e.resultIndex).
      // On Android Chrome each event fires with a new resultIndex whose transcript
      // is the full phrase accumulated so far — concatenating ALL results would
      // duplicate words. On desktop a single result becomes final with the whole phrase.
      const latest = e.results[e.resultIndex];
      if (!latest.isFinal) return;

      const transcript = latest[0].transcript.trim();
      if (!transcript || transcript === sessionFinalRef.current) return;

      sessionFinalRef.current = transcript;
      const base = baseTextRef.current.trimEnd();
      const fullText = base ? `${base} ${transcript}` : transcript;
      socket.send(JSON.stringify({ type: 'stenoSetText', userId, text: fullText }));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    r.onend = () => {
      // Mobile browsers stop recognition after each phrase; restart if still recording.
      // Promote sessionFinalRef into baseTextRef so the next run appends correctly.
      if (isRecordingRef.current) {
        const session = sessionFinalRef.current.trim();
        if (session) {
          const base = baseTextRef.current.trimEnd();
          baseTextRef.current = base ? `${base} ${session}` : session;
          sessionFinalRef.current = '';
        }
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
        <WakeLockIndicatorButton
          enabled={isRecording}
          active={wakeLockActive}
          onToggle={() => {}}
        />
        <button
          className={`steno-record-btn${isRecording ? ' steno-record-btn--active' : ''}${isLockedByOther ? ' steno-record-btn--locked' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLockedByOther || !SpeechRecognitionCtor}
          title={
            !SpeechRecognitionCtor ? 'Speech recognition not supported in this browser'
            : isLockedByOther ? 'Another participant is recording'
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
