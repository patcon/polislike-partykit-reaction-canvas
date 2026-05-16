import { useState, useRef, useCallback } from 'react'
import type { ReducerAlgorithmId, ReducerParams, WorkerEvent } from '../workers/embeddingWorker.types'

export type { ReducerAlgorithmId, ReducerParams }

export const EMBEDDING_MODELS = [
  { id: 'Xenova/all-MiniLM-L6-v2',                      label: 'MiniLM-L6 (fast, ~22 MB)',         default: false },
  { id: 'Xenova/all-MiniLM-L12-v2',                     label: 'MiniLM-L12 (balanced, ~33 MB)',    default: true },
  { id: 'Xenova/all-mpnet-base-v2',                      label: 'MPNet-base (quality, ~420 MB)',    default: false },
  { id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', label: 'Multilingual MiniLM (~125 MB)',    default: false },
] as const

export type EmbeddingModelId = typeof EMBEDDING_MODELS[number]['id']

export const REDUCERS = [
  { id: 'umap-js'    as ReducerAlgorithmId, label: 'UMAP (umap-js)',  default: true  },
  { id: 'umap-druid' as ReducerAlgorithmId, label: 'UMAP (DruidJS)',  default: false },
  { id: 'localmap'   as ReducerAlgorithmId, label: 'LocalMAP (maybe broken)', default: false },
  { id: 'pacmap'     as ReducerAlgorithmId, label: 'PaCMAP',          default: false },
] as const

export type ParamDef = { label: string; min: number; max: number; step: number; default: number }

export const REDUCER_PARAM_DEFS: Record<ReducerAlgorithmId, Record<string, ParamDef>> = {
  'umap-js': {
    n_neighbors: { label: 'Neighbors',       min: 2,   max: 200,  step: 1,    default: 15  },
    min_dist:    { label: 'Min dist',        min: 0,   max: 1,    step: 0.01, default: 0.1 },
    spread:      { label: 'Spread',          min: 0.1, max: 10,   step: 0.1,  default: 1.0 },
    epochs:      { label: 'Iterations (0=auto)', min: 0,   max: 1000, step: 10,   default: 0   },
  },
  'umap-druid': {
    n_neighbors: { label: 'Neighbors',       min: 2,   max: 200,  step: 1,    default: 15  },
    min_dist:    { label: 'Min dist',        min: 0,   max: 1,    step: 0.01, default: 0.1 },
    spread:      { label: 'Spread',          min: 0.1, max: 10,   step: 0.1,  default: 1.0 },
    epochs:      { label: 'Iterations (0=auto)', min: 0,   max: 1000, step: 10,   default: 0   },
  },
  'pacmap': {
    n_neighbors: { label: 'Neighbors', min: 2,   max: 200, step: 1,   default: 10  },
    MN_ratio:    { label: 'MN ratio',  min: 0.1, max: 5,   step: 0.1, default: 0.5 },
    FP_ratio:    { label: 'FP ratio',  min: 0.5, max: 10,  step: 0.5, default: 2.0 },
  },
  'localmap': {
    n_neighbors:    { label: 'Neighbors',       min: 2,  max: 200, step: 1,   default: 10  },
    MN_ratio:       { label: 'MN ratio',        min: 0.1, max: 5,  step: 0.1, default: 0.5 },
    FP_ratio:       { label: 'FP ratio',        min: 0.5, max: 10, step: 0.5, default: 2.0 },
    low_dist_thres: { label: 'Low dist thresh', min: 1,  max: 50,  step: 1,   default: 10  },
  },
}

export function defaultReducerParams(): Record<ReducerAlgorithmId, ReducerParams> {
  return Object.fromEntries(
    Object.entries(REDUCER_PARAM_DEFS).map(([id, defs]) => [
      id,
      Object.fromEntries(Object.entries(defs).map(([k, def]) => [k, def.default])),
    ])
  ) as Record<ReducerAlgorithmId, ReducerParams>
}

export type EmbedPhase =
  | { status: 'idle' }
  | { status: 'model-loading'; progress: number }
  | { status: 'embedding'; loaded: number; total: number }
  | { status: 'reducer-running'; epoch: number; total: number; previewPoints?: [number, number, number][] }
  | { status: 'done'; points: [number, number, number][] }
  | { status: 'error'; message: string }

export function useEmbeddingWorker() {
  const [phase, setPhase] = useState<EmbedPhase>({ status: 'idle' })
  const workerRef = useRef<Worker | null>(null)

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker('/embeddingWorker.js', { type: 'module' })
      w.onmessage = (e: MessageEvent<WorkerEvent>) => {
        const msg = e.data
        switch (msg.type) {
          case 'progress:model-loading':
            setPhase({ status: 'model-loading', progress: msg.progress }); break
          case 'progress:embedding':
            setPhase({ status: 'embedding', loaded: msg.loaded, total: msg.total }); break
          case 'progress:reducer':
            setPhase({ status: 'reducer-running', epoch: msg.epoch, total: msg.total, previewPoints: msg.previewPoints }); break
          case 'done':
            setPhase({ status: 'done', points: msg.points }); break
          case 'error':
            setPhase({ status: 'error', message: msg.message }); break
        }
      }
      w.onerror = (e: ErrorEvent) => {
        console.error('[embeddingWorker] uncaught error', e.message, e.filename, `line ${e.lineno}`, e)
        setPhase({ status: 'error', message: `Worker error: ${e.message || '(no message — check console)'}` })
      }
      w.onmessageerror = (e) => {
        console.error('[embeddingWorker] message deserialisation error', e)
        setPhase({ status: 'error', message: 'Worker message error' })
      }
      workerRef.current = w
    }
    return workerRef.current
  }, [])

  const runEmbedding = useCallback((texts: string[], modelId: EmbeddingModelId, algorithmId: ReducerAlgorithmId, reducerParams: ReducerParams) => {
    setPhase({ status: 'model-loading', progress: 0 })
    getWorker().postMessage({ type: 'embed', texts, modelId, algorithmId, reducerParams })
  }, [getWorker])

  const cancelEmbedding = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setPhase({ status: 'idle' })
  }, [])

  const resetPhase = useCallback(() => {
    setPhase({ status: 'idle' })
  }, [])

  return { phase, runEmbedding, cancelEmbedding, resetPhase }
}
