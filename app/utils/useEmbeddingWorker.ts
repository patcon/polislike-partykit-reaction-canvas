import { useState, useRef, useCallback } from 'react'
import type { WorkerEvent } from '../workers/embeddingWorker.types'

export const EMBEDDING_MODELS = [
  { id: 'Xenova/all-MiniLM-L6-v2',                      label: 'MiniLM-L6 (fast, ~22 MB)',         default: false },
  { id: 'Xenova/all-MiniLM-L12-v2',                     label: 'MiniLM-L12 (balanced, ~33 MB)',    default: true },
  { id: 'Xenova/all-mpnet-base-v2',                      label: 'MPNet-base (quality, ~420 MB)',    default: false },
  { id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', label: 'Multilingual MiniLM (~125 MB)',    default: false },
] as const

export type EmbeddingModelId = typeof EMBEDDING_MODELS[number]['id']

export type EmbedPhase =
  | { status: 'idle' }
  | { status: 'model-loading'; progress: number }
  | { status: 'embedding'; loaded: number; total: number }
  | { status: 'umap-running' }
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
          case 'progress:umap-running':
            setPhase({ status: 'umap-running' }); break
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

  const runEmbedding = useCallback((texts: string[], modelId: EmbeddingModelId) => {
    setPhase({ status: 'model-loading', progress: 0 })
    getWorker().postMessage({ type: 'embed', texts, modelId })
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
