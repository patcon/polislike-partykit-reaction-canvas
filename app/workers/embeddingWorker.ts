import type { WorkerCommand, WorkerEvent } from './embeddingWorker.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPipeline = any

const pipelineCache = new Map<string, AnyPipeline>()

// Catch any unhandled errors that occur outside the message handler
self.onerror = (msg, src, line, col, err) => {
  console.error('[embeddingWorker] global onerror', { msg, src, line, col, err })
  self.postMessage({ type: 'error', message: `Worker global error: ${msg} (${src}:${line}:${col})` } satisfies WorkerEvent)
}

self.onunhandledrejection = (e: PromiseRejectionEvent) => {
  console.error('[embeddingWorker] unhandled rejection', e.reason)
  self.postMessage({ type: 'error', message: `Worker unhandled rejection: ${String(e.reason)}` } satisfies WorkerEvent)
}

console.log('[embeddingWorker] module loaded')

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data
  console.log('[embeddingWorker] received command', cmd.type, 'modelId' in cmd ? cmd.modelId : '')
  if (cmd.type === 'embed') {
    try {
      if (!pipelineCache.has(cmd.modelId)) {
        console.log('[embeddingWorker] importing @huggingface/transformers…')
        const { pipeline } = await import('@huggingface/transformers')
        console.log('[embeddingWorker] creating pipeline for', cmd.modelId)
        const instance = await pipeline('feature-extraction', cmd.modelId, {
          progress_callback: (info: unknown) => {
            const pct = (info as { progress?: number })?.progress ?? 0
            console.log('[embeddingWorker] model-loading progress', pct)
            self.postMessage({ type: 'progress:model-loading', progress: Math.round(pct) } satisfies WorkerEvent)
          },
        })
        console.log('[embeddingWorker] pipeline ready, caching')
        pipelineCache.set(cmd.modelId, instance)
      } else {
        console.log('[embeddingWorker] model already cached, skipping load')
      }

      const pipe = pipelineCache.get(cmd.modelId)!
      const vectors: Float32Array[] = []
      for (let i = 0; i < cmd.texts.length; i++) {
        self.postMessage({ type: 'progress:embedding', loaded: i, total: cmd.texts.length } satisfies WorkerEvent)
        const output = await pipe(cmd.texts[i], { pooling: 'mean', normalize: true })
        vectors.push(output.data as Float32Array)
      }

      console.log('[embeddingWorker] embedding done, running UMAP on', vectors.length, 'vectors')
      self.postMessage({ type: 'progress:umap-running' } satisfies WorkerEvent)
      const n = vectors.length
      const data = vectors.map(v => Array.from(v))
      console.log('[embeddingWorker] importing umap-js…')
      const { UMAP } = await import('umap-js')
      console.log('[embeddingWorker] running UMAP fit')
      const umap = new UMAP({ nComponents: 3, nNeighbors: Math.min(15, n - 1), minDist: 0.1 })
      const result = umap.fit(data)
      console.log('[embeddingWorker] UMAP done')
      self.postMessage({ type: 'done', points: result as [number, number, number][] } satisfies WorkerEvent)
    } catch (err) {
      console.error('[embeddingWorker] caught error', err)
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerEvent)
    }
  }
}
