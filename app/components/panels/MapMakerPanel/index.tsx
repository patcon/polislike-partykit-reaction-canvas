import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import usePartySocket from 'partysocket/react';
import {
  imputeColumnMeans,
  defaultParamsFor,
  defaultAdvancedParamsFor,
  defaultKnnParamsFor,
  REDUCER_PARAM_DEFS,
  REDUCER_ADVANCED_PARAM_DEFS,
  KNN_BACKENDS,
  KNN_BACKEND_ALGORITHMS,
  KNN_PARAM_DEFS,
} from 'reddwarf-ts';
import type { KnnBackend, ReducerAlgorithm } from 'reddwarf-ts';
import { getPartySocketConfig } from '../../../utils/partyHost';
import { idbGet } from '../../../utils/idbStorage';
import type { MomentSnapshot } from '../AdminPanelNoDB/types';
import type { MapProjection } from '../../../types';
import type { DruidWorkerEvent } from '../../../workers/druidWorker.types';
import { usePanelContext } from '../../../context/PanelContext';

type RunStatus = 'idle' | 'running' | 'done' | 'error';

const REGION_TO_VALUE: Record<string, number> = {
  positive: 1,
  negative: -1,
  neutral: 0,
};

const ALGORITHMS: { id: ReducerAlgorithm; label: string }[] = [
  { id: 'umap', label: 'UMAP' },
  { id: 'pacmap', label: 'PaCMAP' },
  { id: 'localmap', label: 'LocalMAP' },
];

function buildMatrix(moments: MomentSnapshot[]): { matrix: number[][]; participantIds: string[] } {
  const participantSet = new Set<string>();
  for (const m of moments) {
    for (const uid of Object.keys(m.regions)) participantSet.add(uid);
  }
  const participantIds = [...participantSet];
  const matrix = participantIds.map(uid =>
    moments.map(m => {
      const region = m.regions[uid];
      if (region === undefined || region === null) return NaN;
      return REGION_TO_VALUE[region] ?? NaN;
    })
  );
  imputeColumnMeans(matrix);
  return { matrix, participantIds };
}

const SETTINGS_KEY = 'map-maker-settings';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') ?? {}; } catch { return {}; }
}

export default function MapMakerPanel() {
  const { room, userId } = usePanelContext();
  const saved = loadSettings();
  const [algorithm, setAlgorithm] = useState<ReducerAlgorithm>(() => saved.algorithm ?? 'umap');
  const [params, setParams] = useState<Record<string, number>>(() => saved.params ?? defaultParamsFor(saved.algorithm ?? 'umap'));
  const [advancedParams, setAdvancedParams] = useState<Record<string, number>>(() => saved.advancedParams ?? defaultAdvancedParamsFor(saved.algorithm ?? 'umap'));
  const [knnBackend, setKnnBackend] = useState<KnnBackend>(() => saved.knnBackend ?? 'annoy');
  const [knnParamsByBackend, setKnnParamsByBackend] = useState<Record<KnnBackend, Record<string, number>>>(() => saved.knnParamsByBackend ?? {
    annoy: defaultKnnParamsFor('annoy'),
    hnsw: defaultKnnParamsFor('hnsw'),
  });
  const [moments, setMoments] = useState<MomentSnapshot[]>([]);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const participantIdsRef = useRef<string[]>([]);

  useEffect(() => {
    idbGet<MomentSnapshot[]>(`v4-moments-${room}`).then(stored => {
      if (stored) setMoments(stored);
    });
  }, [room]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ algorithm, params, advancedParams, knnBackend, knnParamsByBackend }));
  }, [algorithm, params, advancedParams, knnBackend, knnParamsByBackend]);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage() {},
  });

  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

  const { matrix, participantIds } = useMemo(() => buildMatrix(moments), [moments]);

  const handleCompute = useCallback(() => {
    if (status === 'running') return;
    if (participantIds.length < 3) return;

    workerRef.current?.terminate();
    const worker = new Worker('/druidWorker.js', { type: 'module' });
    workerRef.current = worker;
    participantIdsRef.current = participantIds;

    setStatus('running');
    setProgress(null);
    setErrorMsg('');

    worker.onmessage = (evt: MessageEvent<DruidWorkerEvent>) => {
      const event = evt.data;
      if (event.type === 'progress') {
        setProgress(event.iteration / event.total);
      } else if (event.type === 'done') {
        const ids = participantIdsRef.current;
        const projection: MapProjection = {
          coords: ids.map((id, i) => [id, event.coords[i]]),
          algorithm,
          computedAt: new Date().toISOString(),
        };
        socket.send(JSON.stringify({ type: 'mapProjectionSet', userId, projection }));
        setProgress(1);
        setStatus('done');
        worker.terminate();
      } else if (event.type === 'error') {
        setErrorMsg(event.message);
        setStatus('error');
        worker.terminate();
      }
    };

    worker.onerror = (e) => {
      setErrorMsg(e.message ?? 'Worker error');
      setStatus('error');
    };

    const hasKnn = KNN_BACKEND_ALGORITHMS.includes(algorithm);
    const allParams = { ...params, ...advancedParams };
    worker.postMessage({
      type: 'reduce',
      matrix,
      algorithm,
      params: allParams,
      knnBackend: hasKnn ? knnBackend : undefined,
      knnParams: hasKnn ? knnParamsByBackend[knnBackend] : undefined,
    });
  }, [status, matrix, participantIds, algorithm, params, advancedParams, knnBackend, knnParamsByBackend, socket, userId]);

  const handleClear = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    socket.send(JSON.stringify({ type: 'mapProjectionClear', userId }));
    setStatus('idle');
    setProgress(null);
  };

  const tooFewMoments = moments.length < 1;
  const tooFewParticipants = !tooFewMoments && participantIds.length < 3;
  const canCompute = !tooFewMoments && !tooFewParticipants && status !== 'running';

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: '#0f0f0e', color: '#ccc', fontFamily: 'monospace' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#ccc' }}>Map Maker</h2>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Moments loaded: {moments.length}</div>
        {tooFewMoments && (
          <div style={{ fontSize: 12, color: '#a74', marginBottom: 8 }}>
            No moments found. Import Polis CSV or snap moments from the Moments tab first.
          </div>
        )}
        {!tooFewMoments && tooFewParticipants && (
          <div style={{ fontSize: 12, color: '#a74', marginBottom: 8 }}>
            Need at least 3 participants across moments to compute a projection.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Algorithm</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ALGORITHMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setAlgorithm(id); setParams(defaultParamsFor(id)); setAdvancedParams(defaultAdvancedParamsFor(id)); }}
              disabled={status === 'running'}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: algorithm === id ? '#4a8' : '#444',
                background: algorithm === id ? '#1a3a28' : 'none',
                color: algorithm === id ? '#8c8' : '#888',
                fontSize: 13,
                cursor: status === 'running' ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(REDUCER_PARAM_DEFS[algorithm]).map(([key, def]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ color: '#888', width: 100, flexShrink: 0 }}>{def.label}</span>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={params[key] ?? def.default}
              disabled={status === 'running'}
              onChange={e => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
              style={{ flex: 1, accentColor: '#4a8' }}
            />
            <span style={{ color: '#ccc', width: 40, textAlign: 'right', flexShrink: 0 }}>
              {params[key] ?? def.default}
            </span>
          </label>
        ))}
      </div>

      <details style={{ marginBottom: 16 }}>
        <summary style={{ fontSize: 12, color: '#888', cursor: 'pointer', userSelect: 'none', marginBottom: 8, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, display: 'inline-block', transition: 'transform 0.15s' }}>›</span>
          Advanced
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {Object.entries(REDUCER_ADVANCED_PARAM_DEFS[algorithm]).map(([key, def]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ color: '#888', width: 120, flexShrink: 0 }}>{def.label}</span>
              <input
                type="range"
                min={def.min}
                max={def.max}
                step={def.step}
                value={advancedParams[key] ?? def.default}
                disabled={status === 'running'}
                onChange={e => setAdvancedParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                style={{ flex: 1, accentColor: '#4a8' }}
              />
              <span style={{ color: '#ccc', width: 48, textAlign: 'right', flexShrink: 0 }}>
                {advancedParams[key] ?? def.default}
              </span>
            </label>
          ))}

          {KNN_BACKEND_ALGORITHMS.includes(algorithm) && (
            <>
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>KNN backend</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {KNN_BACKENDS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setKnnBackend(value)}
                      disabled={status === 'running'}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: knnBackend === value ? '#4a8' : '#444',
                        background: knnBackend === value ? '#1a3a28' : 'none',
                        color: knnBackend === value ? '#8c8' : '#888',
                        fontSize: 12,
                        cursor: status === 'running' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {Object.entries(KNN_PARAM_DEFS[knnBackend]).map(([key, def]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ color: '#888', width: 120, flexShrink: 0 }}>{def.label}</span>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={knnParamsByBackend[knnBackend][key] ?? def.default}
                    disabled={status === 'running'}
                    onChange={e => setKnnParamsByBackend(prev => ({
                      ...prev,
                      [knnBackend]: { ...prev[knnBackend], [key]: parseFloat(e.target.value) },
                    }))}
                    style={{ flex: 1, accentColor: '#4a8' }}
                  />
                  <span style={{ color: '#ccc', width: 48, textAlign: 'right', flexShrink: 0 }}>
                    {knnParamsByBackend[knnBackend][key] ?? def.default}
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      </details>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="v3-admin-btn"
          onClick={handleCompute}
          disabled={!canCompute}
          style={{ opacity: !canCompute ? 0.4 : 1 }}
        >
          {status === 'running' ? 'Computing…' : 'Compute Map'}
        </button>
        <button
          className="v3-admin-btn v3-admin-btn--destructive"
          onClick={handleClear}
          disabled={status === 'running'}
          style={{ opacity: status === 'running' ? 0.4 : 1 }}
        >
          Clear Map
        </button>
      </div>

      {status === 'running' && (
        <div style={{ marginBottom: 12 }}>
          {progress === null ? (
            <div style={{ fontSize: 12, color: '#888' }}>Initialising…</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{Math.round(progress * 100)}%</div>
              <div style={{ height: 6, background: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress * 100}%`, background: '#4a8', transition: 'width 0.2s' }} />
              </div>
            </>
          )}
        </div>
      )}

      {status === 'done' && (
        <div style={{ fontSize: 12, color: '#4a8' }}>Projection saved.</div>
      )}

      {status === 'error' && (
        <div style={{ fontSize: 12, color: '#c44' }}>Error: {errorMsg}</div>
      )}
    </div>
  );
}
