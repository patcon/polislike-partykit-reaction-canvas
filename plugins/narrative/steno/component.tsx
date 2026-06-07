import { useState, useRef, useEffect, useCallback } from "react";
import usePartySocket from "partysocket/react";
import { getPartySocketConfig } from "../../../app/utils/partyHost";
import { MdKeyboard, MdStopCircle } from "react-icons/md";
import WakeLockIndicatorButton from "../../../app/components/shared/WakeLockIndicatorButton";
import { extractPlainText } from "../../../app/utils/vttUtils";
import { useWakeLock } from "../../../app/utils/useWakeLock";
import { usePanelContext } from "../../../app/context/PanelContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: (new () => any) | null = typeof window !== 'undefined'
  ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null) // eslint-disable-line @typescript-eslint/no-explicit-any
  : null;

export default function StenoPanel() {
  const { room, userId } = usePanelContext();
  const [stenoVtt, setStenoVtt] = useState('WEBVTT\n');
  const [interimText, setInterimText] = useState('');
  const [lockHolder, setLockHolder] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [viewMode, setViewMode] = useState<'vtt' | 'plaintext'>('vtt');
  const isRecordingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const { acquired: wakeLockActive } = useWakeLock(isRecording);
  // segmentStartRef: ISO timestamp captured when first interim result arrives for a speech segment.
  // sessionFinalRef: deduplicates repeated transcripts across onend/restart cycles.
  // segmentTimerRef: forces a flush if speech runs longer than MAX_SEGMENT_MS without a natural pause.
  const segmentStartRef = useRef<string | null>(null);
  const sessionFinalRef = useRef('');
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage(evt) {
      const data = JSON.parse(evt.data);
      if (data.type === 'stenoTextChanged') { setStenoVtt(data.text); return; }
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
    if (segmentTimerRef.current !== null) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    socket.send(JSON.stringify({ type: 'stenoStopRecording', userId }));
  }, [socket, userId]);

  const startRecording = useCallback(() => {
    socket.send(JSON.stringify({ type: 'stenoStartRecording', userId }));
    sessionFinalRef.current = '';
    segmentStartRef.current = null;
    setIsRecording(true);
    isRecordingRef.current = true;
    try { recognitionRef.current?.start(); } catch { /* ignore if already started */ }
  }, [socket, userId]);

  const MAX_SEGMENT_MS = 5_000;

  useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const r = new SpeechRecognitionCtor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = '';
      let hasInterim = false;
      for (let i = 0; i < e.results.length; i++) {
        if (!e.results[i].isFinal) {
          interim += e.results[i][0].transcript;
          hasInterim = true;
        }
      }

      // Capture cue start time on first interim result of a new speech segment,
      // and start a forced-flush timer in case speech runs without a natural pause.
      if (hasInterim && !segmentStartRef.current) {
        segmentStartRef.current = new Date().toISOString();
        segmentTimerRef.current = setTimeout(() => {
          segmentTimerRef.current = null;
          try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        }, MAX_SEGMENT_MS);
      }
      setInterimText(interim);

      // Only process the result that just changed (e.resultIndex).
      // On Android Chrome each event fires with a new resultIndex whose transcript
      // is the full phrase accumulated so far — concatenating ALL results would
      // duplicate words. On desktop a single result becomes final with the whole phrase.
      const latest = e.results[e.resultIndex];
      if (latest.isFinal) {
        if (segmentTimerRef.current !== null) {
          clearTimeout(segmentTimerRef.current);
          segmentTimerRef.current = null;
        }
      }
      if (!latest.isFinal) return;

      const endTime = new Date().toISOString();
      const startTime = segmentStartRef.current ?? endTime;
      segmentStartRef.current = null;

      const transcript = latest[0].transcript.trim();
      if (!transcript || transcript === sessionFinalRef.current) return;

      sessionFinalRef.current = transcript;
      const cue = `${startTime} --> ${endTime}\n${transcript}`;
      socket.send(JSON.stringify({ type: 'stenoAppendText', userId, text: cue }));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    r.onend = () => {
      if (segmentTimerRef.current !== null) {
        clearTimeout(segmentTimerRef.current);
        segmentTimerRef.current = null;
      }
      // Mobile browsers stop recognition after each phrase; restart if still recording.
      if (isRecordingRef.current) {
        segmentStartRef.current = null;
        sessionFinalRef.current = '';
        try { r.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = r;
    return () => { try { r.abort(); } catch { /* ignore */ } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isLockedByOther = lockHolder !== null && lockHolder !== userId;

  return (
    <div className="steno-panel">
      <div className="steno-view-toggle">
        <button
          className={`steno-view-btn${viewMode === 'vtt' ? ' steno-view-btn--active' : ''}`}
          onClick={() => setViewMode('vtt')}
        >VTT</button>
        <button
          className={`steno-view-btn${viewMode === 'plaintext' ? ' steno-view-btn--active' : ''}`}
          onClick={() => setViewMode('plaintext')}
        >Plaintext</button>
      </div>
      <div className="steno-body">
        <textarea
          className="steno-textarea"
          value={viewMode === 'vtt' ? stenoVtt : extractPlainText(stenoVtt)}
          placeholder={viewMode === 'vtt' ? 'WEBVTT\n\n...' : 'Transcription will appear here...'}
          readOnly={isLockedByOther || viewMode === 'plaintext'}
          onChange={e => {
            if (isLockedByOther || viewMode === 'plaintext') return;
            let text = e.target.value;
            if (!text.startsWith('WEBVTT\n')) {
              const after = text.indexOf('\n');
              text = 'WEBVTT\n' + (after >= 0 ? text.slice(after + 1) : '');
            }
            setStenoVtt(text);
            socket.send(JSON.stringify({ type: 'stenoSetText', userId, text }));
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
