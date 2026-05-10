import { UMAP } from 'umap-js'
import type { WorkerCommand, WorkerEvent } from './embeddingWorker.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPipeline = any

const pipelineCache = new Map<string, AnyPipeline>()

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data
  if (cmd.type === 'embed') {
    try {
      if (!pipelineCache.has(cmd.modelId)) {
        const { pipeline } = await import('@huggingface/transformers')
        const instance = await pipeline('feature-extraction', cmd.modelId, {
          progress_callback: (info: unknown) => {
            const pct = (info as { progress?: number })?.progress ?? 0
            self.postMessage({ type: 'progress:model-loading', progress: Math.round(pct) } satisfies WorkerEvent)
          },
        })
        pipelineCache.set(cmd.modelId, instance)
      }

      const pipe = pipelineCache.get(cmd.modelId)!
      const vectors: Float32Array[] = []
      for (let i = 0; i < cmd.texts.length; i++) {
        self.postMessage({ type: 'progress:embedding', loaded: i, total: cmd.texts.length } satisfies WorkerEvent)
        const output = await pipe(cmd.texts[i], { pooling: 'mean', normalize: true })
        vectors.push(output.data as Float32Array)
      }

      self.postMessage({ type: 'progress:umap-running' } satisfies WorkerEvent)
      const n = vectors.length
      const data = vectors.map(v => Array.from(v))
      const umap = new UMAP({ nComponents: 3, nNeighbors: Math.min(15, n - 1), minDist: 0.1 })
      const result = umap.fit(data)
      self.postMessage({ type: 'done', points: result as [number, number, number][] } satisfies WorkerEvent)
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerEvent)
    }
  }
}
