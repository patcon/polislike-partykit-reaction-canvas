import { useState, useEffect, useRef, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import { imputeColumnMeans, defaultParamsFor } from 'reddwarf-ts';
import type { ReducerAlgorithm } from 'reddwarf-ts';
import { getPartySocketConfig } from '../../../utils/partyHost';
import type { MomentSnapshot } from '../AdminPanelNoDB/types';
import type { MapProjection } from '../../../types';
import type { DruidWorkerEvent } from '../../../workers/druidWorker.types';

interface MapMakerPanelProps {
  room: string;
  userId: string;
}

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

export default function MapMakerPanel({ room, userId }: MapMakerPanelProps) {
  const [algorithm, setAlgorithm] = useState<ReducerAlgorithm>('umap');
  const [moments, setMoments] = useState<MomentSnapshot[]>([]);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const participantIdsRef = useRef<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`v4-moments-${room}`);
      if (raw) setMoments(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [room]);

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { userId },
    onMessage() {},
  });

  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

  const handleCompute = useCallback(() => {
    if (status === 'running') return;
    const { matrix, participantIds } = buildMatrix(moments);
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

    worker.postMessage({ type: 'reduce', matrix, algorithm, params: defaultParamsFor(algorithm) });
  }, [status, moments, algorithm, socket, userId]);

  const handleClear = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    socket.send(JSON.stringify({ type: 'mapProjectionClear', userId }));
    setStatus('idle');
    setProgress(null);
  };

  const tooFewMoments = moments.length < 1;
  const tooFewParticipants = !tooFewMoments && buildMatrix(moments).participantIds.length < 3;
  const canCompute = !tooFewMoments && !tooFewParticipants && status !== 'running';

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%', boxSizing: 'border-box', color: '#ccc', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#eee' }}>Map Maker</h2>

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
              onClick={() => setAlgorithm(id)}
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
