import { useState, useRef, useEffect, useCallback } from 'react';
import { useRoomSocket, useMessageSubscription } from '../../../app/contexts/RoomSocketContext';
import { getPartySocketConfig } from '../../../app/utils/partyHost';
import { useEmbeddingWorker, EMBEDDING_MODELS, REDUCERS, REDUCER_PARAM_DEFS, defaultReducerParams, type EmbeddingModelId, type ReducerAlgorithmId, type ReducerParams } from './useEmbeddingWorker';
import { parseVttCues, computeChunks, getTimestampForWordIndex } from './storyTracerUtils';
import type { StoryTracerMeta, StoryTracerPoint } from '../types';
import NarrativePath3D from './NarrativePath3D';
import { usePanelContext } from '../../../app/context/PanelContext';

const LS_MODEL = 'story-tracer-model';
const LS_ALGO = 'story-tracer-algo';
const LS_WINDOW = 'story-tracer-window';
const LS_OVERLAP = 'story-tracer-overlap';

export default function StoryTracerPanel() {
  const { room, userId } = usePanelContext();
  const [stenoVtt, setStenoVtt] = useState('WEBVTT\n');
  const [storedMeta, setStoredMeta] = useState<StoryTracerMeta | null>(null);
  const [storedPoints, setStoredPoints] = useState<StoryTracerPoint[] | null>(null);
  const [isRerunMode, setIsRerunMode] = useState(false);
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedModel, setSelectedModel] = useState<EmbeddingModelId>(() => {
    const stored = localStorage.getItem(LS_MODEL);
    return (EMBEDDING_MODELS.find(m => m.id === stored) ?? EMBEDDING_MODELS.find(m => m.default)!).id;
  });
  const [selectedAlgo, setSelectedAlgo] = useState<ReducerAlgorithmId>(() => {
    const stored = localStorage.getItem(LS_ALGO) as ReducerAlgorithmId | null;
    return (REDUCERS.find(r => r.id === stored) ?? REDUCERS.find(r => r.default)!).id;
  });
  const [reducerParams, setReducerParams] = useState<Record<ReducerAlgorithmId, ReducerParams>>(defaultReducerParams);
  const [windowSize, setWindowSize] = useState(() => parseInt(localStorage.getItem(LS_WINDOW) ?? '40'));
  const [overlapPct, setOverlapPct] = useState(() => parseInt(localStorage.getItem(LS_OVERLAP) ?? '80'));

  const { phase, runEmbedding, cancelEmbedding, resetPhase } = useEmbeddingWorker();
  const pendingChunksRef = useRef<string[]>([]);
  const pendingCuesRef = useRef<ReturnType<typeof parseVttCues>>([]);

  const replayFramesRef = useRef<StoryTracerPoint[][]>([]);
  const [replayFrames, setReplayFrames] = useState<StoryTracerPoint[][]>([]);
  const [replayIdx, setReplayIdx] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const replayTimerRef = useRef<number | null>(null);

  // Must match PROGRESS_INTERVAL in app/workers/embeddingWorker.ts
  const PREVIEW_FRAME_STEP = 10;
  const REPLAY_DURATIONS = [3, 5, 10, 20] as const;
  const [durationIdx, setDurationIdx] = useState(1); // default 5s
  // Ref so startReplay's setInterval closure always reads the latest interval without needing to re-create
  const frameIntervalMsRef = useRef(100);

  const { send } = useRoomSocket();

  useMessageSubscription((evt) => {
    const data = JSON.parse(evt.data);
    if (data.type === 'stenoTextChanged') { setStenoVtt(data.text); return; }
    if (data.type === 'storyTracerPointsChanged') {
      setStoredMeta(data.meta ?? null);
      setStoredPoints(data.points ?? null);
      setIsSaving(false);
      return;
    }
  });

  // Accumulate reducer preview frames into replayFramesRef for post-run replay
  useEffect(() => {
    if (phase.status !== 'reducer-running' || !phase.previewPoints || phase.previewPoints.length === 0) return;
    const pts = phase.previewPoints.map(([x, y, z], i) => ({
      x, y, z,
      text: pendingChunksRef.current[i] ?? '',
    }));
    replayFramesRef.current.push(pts);
  }, [phase]);

  // When embedding finishes, annotate points with timestamps and send to server
  useEffect(() => {
    if (phase.status !== 'done') return;
    const chunks = pendingChunksRef.current;
    const cues = pendingCuesRef.current;
    const step = Math.max(1, Math.round(windowSize * (1 - overlapPct / 100)))
    const points: StoryTracerPoint[] = phase.points.map(([x, y, z], i) => ({
      x, y, z,
      text: chunks[i],
      startTime: getTimestampForWordIndex(i * step, cues),
    }));
    const meta: StoryTracerMeta = {
      modelId: selectedModel,
      algorithmId: selectedAlgo,
      windowSize,
      overlapPct,
      segmentCount: chunks.length,
      computedAt: new Date().toISOString(),
    };
    // Send via HTTP POST — the full points payload can exceed the WebSocket frame limit
    const { host, protocol } = getPartySocketConfig()
    const httpProtocol = protocol === 'wss' ? 'https' : 'http'
    const frames = replayFramesRef.current;
    if (frames.length > 0) {
      setReplayFrames([...frames]);
      setReplayIdx(frames.length - 1);
    }
    setIsSaving(true);
    void fetch(`${httpProtocol}://${host}/parties/main/${room}/storyTracerSetPoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, points, meta }),
    })
    setIsRerunMode(false);
    resetPhase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.status]);

  const cues = parseVttCues(stenoVtt);
  const allText = cues.map(c => c.text).join(' ');
  const wordCount = allText.trim().split(/\s+/).filter(Boolean).length;
  const chunks = wordCount > 0 ? computeChunks(allText, windowSize, overlapPct) : [];
  const hasContent = wordCount > 0;

  const stopReplay = useCallback(() => {
    if (replayTimerRef.current !== null) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setIsReplaying(false);
  }, []);

  const startReplay = useCallback((fromIdx: number, total: number) => {
    stopReplay();
    let idx = fromIdx >= total - 1 ? 0 : fromIdx;
    setReplayIdx(idx);
    setIsReplaying(true);
    replayTimerRef.current = window.setInterval(() => {
      idx++;
      if (idx >= total) {
        clearInterval(replayTimerRef.current!);
        replayTimerRef.current = null;
        setIsReplaying(false);
        setReplayIdx(total - 1);
      } else {
        setReplayIdx(idx);
      }
    }, frameIntervalMsRef.current);
  }, [stopReplay]);

  // Clear replay interval on unmount
  useEffect(() => () => stopReplay(), [stopReplay]);

  const handleRun = useCallback(() => {
    if (!hasContent) return;
    stopReplay();
    setIsRerunMode(false);
    replayFramesRef.current = [];
    setReplayFrames([]);
    setReplayIdx(0);
    const freshCues = parseVttCues(stenoVtt);
    const text = freshCues.map(c => c.text).join(' ');
    const freshChunks = computeChunks(text, windowSize, overlapPct);
    pendingChunksRef.current = freshChunks;
    pendingCuesRef.current = freshCues;
    runEmbedding(freshChunks, selectedModel, selectedAlgo, reducerParams[selectedAlgo]);
  }, [hasContent, stenoVtt, windowSize, overlapPct, selectedModel, selectedAlgo, reducerParams, runEmbedding, stopReplay]);

  const handleClear = useCallback(() => {
    stopReplay();
    replayFramesRef.current = [];
    setReplayFrames([]);
    setReplayIdx(0);
    send(JSON.stringify({ type: 'storyTracerClearPoints', userId }));
    resetPhase();
    setIsRerunMode(false);
  }, [send, userId, resetPhase, stopReplay]);

  const handleCancel = useCallback(() => {
    cancelEmbedding();
    // Freeze whatever frames accumulated so the user can replay the partial run
    const frames = replayFramesRef.current;
    if (frames.length > 0) {
      setReplayFrames([...frames]);
      setReplayIdx(frames.length - 1);
    }
    setIsRerunMode(false);
  }, [cancelEmbedding]);

  // Frame interval drives both setInterval cadence and lerp alpha.
  // alpha formula: target 25% remaining after one interval → alpha = 1 - 0.25^(1/framesPerInterval)
  const frameIntervalMs = replayFrames.length > 1
    ? (REPLAY_DURATIONS[durationIdx] * 1000) / replayFrames.length
    : 100;
  frameIntervalMsRef.current = frameIntervalMs;
  const replayLerpAlpha = Math.max(0.05, Math.min(0.6, 1 - Math.pow(0.25, 1 / (frameIntervalMs / (1000 / 60)))));

  const isRunning = phase.status === 'model-loading' || phase.status === 'embedding' || phase.status === 'reducer-running';
  const isDone = phase.status === 'done';
  const showSettings = !isRunning && (!storedMeta || isRerunMode) && !isDone;
  const showResult = !isRunning && (storedMeta !== null) && !isRerunMode && !isDone;
  const replayActive = !isRunning && replayFrames.length > 1;

  const previewPoints: StoryTracerPoint[] | null =
    phase.status === 'reducer-running' && phase.previewPoints && phase.previewPoints.length > 0
      ? phase.previewPoints.map(([x, y, z], i) => ({
          x, y, z,
          text: pendingChunksRef.current[i] ?? '',
        }))
      // The final reducer-running message has no previewPoints (completion signal),
      // and the 'done' phase exists before the done effect sets replayFrames state.
      // In both cases, hold the last accumulated frame so the canvas never blanks.
      : (phase.status === 'reducer-running' || phase.status === 'done') && replayFramesRef.current.length > 0
        ? replayFramesRef.current[replayFramesRef.current.length - 1]
        : null;

  const modelLabel = EMBEDDING_MODELS.find(m => m.id === (storedMeta?.modelId ?? selectedModel))?.label ?? selectedModel.split('/').pop();
  const reducerLabel = REDUCERS.find(r => r.id === (storedMeta?.algorithmId ?? selectedAlgo))?.label ?? (storedMeta?.algorithmId ?? selectedAlgo);

  const computedAgo = storedMeta ? (() => {
    const diffMs = Date.now() - new Date(storedMeta.computedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
  })() : '';

  return (
    <div className="story-tracer-panel">
      <div className="story-tracer-source">
        {hasContent
          ? `${cues.length} cue${cues.length !== 1 ? 's' : ''} · ${wordCount} words`
          : 'No VTT content yet — use Steno to record a transcript'}
        {storedMeta && (
          <span className="story-tracer-source-stored"> · {storedMeta.segmentCount} points stored</span>
        )}
      </div>

      {showSettings && (
        <div className="story-tracer-settings">
          <label className="story-tracer-label">Model</label>
          <select
            className="story-tracer-select"
            value={selectedModel}
            onChange={e => {
              const v = e.target.value as EmbeddingModelId;
              setSelectedModel(v);
              localStorage.setItem(LS_MODEL, v);
            }}
          >
            {EMBEDDING_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          <label className="story-tracer-label">Reducer</label>
          <select
            className="story-tracer-select"
            value={selectedAlgo}
            onChange={e => {
              const v = e.target.value as ReducerAlgorithmId;
              setSelectedAlgo(v);
              localStorage.setItem(LS_ALGO, v);
            }}
          >
            {REDUCERS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>

          <div className="story-tracer-row story-tracer-row--wrap">
            {Object.entries(REDUCER_PARAM_DEFS[selectedAlgo]).map(([key, def]) => (
              <div key={key} className="story-tracer-field">
                <label className="story-tracer-label">{def.label}</label>
                <input
                  type="number"
                  className="story-tracer-number"
                  min={def.min}
                  max={def.max}
                  step={def.step}
                  value={reducerParams[selectedAlgo][key]}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) {
                      setReducerParams(prev => ({
                        ...prev,
                        [selectedAlgo]: { ...prev[selectedAlgo], [key]: v },
                      }));
                    }
                  }}
                />
              </div>
            ))}
          </div>

          <div className="story-tracer-row">
            <div className="story-tracer-field">
              <label className="story-tracer-label">Window</label>
              <input
                type="number"
                className="story-tracer-number"
                min={5}
                max={200}
                value={windowSize}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1) { setWindowSize(v); localStorage.setItem(LS_WINDOW, String(v)); }
                }}
              />
              <span className="story-tracer-unit">words</span>
            </div>
            <div className="story-tracer-field">
              <label className="story-tracer-label">Overlap</label>
              <input
                type="number"
                className="story-tracer-number"
                min={0}
                max={95}
                value={overlapPct}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 0 && v <= 95) { setOverlapPct(v); localStorage.setItem(LS_OVERLAP, String(v)); }
                }}
              />
              <span className="story-tracer-unit">%</span>
            </div>
          </div>

          {hasContent && chunks.length > 0 && (
            <div className={`story-tracer-segments${segmentsOpen ? ' story-tracer-segments--open' : ''}`}>
              <button className="story-tracer-segments-summary" onClick={() => setSegmentsOpen(o => !o)}>
                {segmentsOpen ? '▾' : '▸'} {chunks.length} segment{chunks.length !== 1 ? 's' : ''}
              </button>
              {segmentsOpen && (
                <ol className="story-tracer-segments-list">
                  {chunks.map((chunk, i) => (
                    <li key={i} className="story-tracer-segment-item">{chunk}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {isRunning && (
        <div className="story-tracer-progress">
          {phase.status === 'model-loading' && (
            <>
              <div className="story-tracer-progress-row">
                <div className="story-tracer-spinner" />
                <span>{phase.progress > 0 ? `Downloading model… ${phase.progress}%` : 'Initializing model…'}</span>
                <button className="story-tracer-cancel-btn" onClick={handleCancel}>Cancel</button>
              </div>
              <div className={`story-tracer-bar${phase.progress === 0 ? ' story-tracer-bar--indeterminate' : ''}`}>
                <div className="story-tracer-bar-fill" style={{ width: `${phase.progress}%` }} />
              </div>
            </>
          )}
          {phase.status === 'embedding' && (
            <>
              <div className="story-tracer-progress-row">
                <div className="story-tracer-spinner" />
                <span>Embedding {phase.loaded + 1} / {phase.total}</span>
                <button className="story-tracer-cancel-btn" onClick={handleCancel}>Cancel</button>
              </div>
              <div className="story-tracer-bar">
                <div className="story-tracer-bar-fill" style={{ width: `${(phase.loaded / phase.total) * 100}%` }} />
              </div>
            </>
          )}
          {phase.status === 'reducer-running' && (
            <>
              <div className="story-tracer-progress-row">
                <div className="story-tracer-spinner" />
                <span>
                  {phase.total > 0
                    ? phase.epoch === 0
                      ? `Running reducer… (generating KNN graph)`
                      : `Running reducer… iteration ${phase.epoch} / ${phase.total}`
                    : 'Running reducer…'}
                </span>
                <button className="story-tracer-cancel-btn" onClick={handleCancel}>Cancel</button>
              </div>
              <div className={`story-tracer-bar${phase.total === 0 ? ' story-tracer-bar--indeterminate' : ''}`}>
                <div
                  className="story-tracer-bar-fill"
                  style={{ width: phase.total > 0 ? `${(phase.epoch / phase.total) * 100}%` : undefined }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {isSaving && (
        <div className="story-tracer-progress">
          <div className="story-tracer-progress-row">
            <div className="story-tracer-spinner" />
            <span>Saving to server…</span>
          </div>
          <div className="story-tracer-bar story-tracer-bar--indeterminate">
            <div className="story-tracer-bar-fill" />
          </div>
        </div>
      )}

      {!isRerunMode && <div className="story-tracer-3d-container">
        {(previewPoints || (!isRunning && (replayFrames.length > 0 || storedPoints))) && (
          <NarrativePath3D
            points={
              previewPoints
                ? previewPoints
                : replayFrames.length > 0 ? replayFrames[replayIdx] : storedPoints!
            }
            lerpAlpha={!isRunning && replayFrames.length > 0 ? replayLerpAlpha : undefined}
          />
        )}
      </div>}

      {phase.status === 'error' && (
        <div className="story-tracer-error">⚠ {phase.message}</div>
      )}

      {!isRerunMode && <div className="story-tracer-replay">
        <button
          className="story-tracer-replay-btn story-tracer-replay-btn--duration"
          disabled={!replayActive}
          onClick={() => {
            const nextIdx = (durationIdx + 1) % REPLAY_DURATIONS.length;
            const nextDuration = REPLAY_DURATIONS[nextIdx];
            frameIntervalMsRef.current = (nextDuration * 1000) / replayFrames.length;
            setDurationIdx(nextIdx);
            if (isReplaying) startReplay(replayIdx, replayFrames.length);
          }}
        >
          {REPLAY_DURATIONS[durationIdx]}s
        </button>
        <button
          className="story-tracer-replay-btn"
          disabled={!replayActive}
          onClick={() => isReplaying ? stopReplay() : startReplay(replayIdx, replayFrames.length)}
        >
          {isReplaying ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          className="story-tracer-replay-slider"
          min={0}
          max={phase.status === 'reducer-running' && phase.total > 0 ? phase.total - 1 : Math.max(0, (replayFrames.length - 1) * PREVIEW_FRAME_STEP)}
          step={phase.status === 'reducer-running' ? 1 : PREVIEW_FRAME_STEP}
          value={phase.status === 'reducer-running' ? phase.epoch : replayIdx * PREVIEW_FRAME_STEP}
          disabled={!replayActive && phase.status !== 'reducer-running'}
          onChange={replayActive ? e => { stopReplay(); setReplayIdx(Math.round(Number(e.target.value) / PREVIEW_FRAME_STEP)); } : undefined}
        />
        <span className="story-tracer-replay-counter">
          {phase.status === 'reducer-running'
            ? `${phase.epoch}/${phase.total}`
            : replayFrames.length > 1
              ? `iter ${replayIdx * PREVIEW_FRAME_STEP}/${(replayFrames.length - 1) * PREVIEW_FRAME_STEP}`
              : ''}
        </span>
      </div>}

      {showResult && (
        <div className="story-tracer-result">
          <div className="story-tracer-result-text">
            ✓ {storedMeta!.segmentCount} points stored
            <span className="story-tracer-result-meta"> ({modelLabel} · {reducerLabel} · {computedAgo})</span>
          </div>
          {!isSaving && (
            <div className="story-tracer-result-actions">
              <button className="story-tracer-btn" onClick={() => setIsRerunMode(true)}>Rerun</button>
              <button className="story-tracer-btn story-tracer-btn--danger" onClick={handleClear}>Clear</button>
            </div>
          )}
        </div>
      )}

      {!isRunning && (showSettings || isRerunMode) && (
        <div className="story-tracer-footer">
          {isRerunMode && (
            <button className="story-tracer-btn" onClick={() => setIsRerunMode(false)}>✕</button>
          )}
          <button
            className="story-tracer-run-btn"
            onClick={handleRun}
            disabled={!hasContent || chunks.length === 0}
          >
            {isRerunMode ? 'Rerun Story Tracer' : 'Run Story Tracer'}
          </button>
        </div>
      )}
    </div>
  );
}
