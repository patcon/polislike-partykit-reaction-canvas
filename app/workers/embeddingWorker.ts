import type { ReducerAlgorithmId, ReducerParams, WorkerCommand, WorkerEvent } from './embeddingWorker.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPipeline = any

const pipelineCache = new Map<string, AnyPipeline>()

self.onerror = (msg, src, line, col, err) => {
  console.error('[embeddingWorker] global onerror', { msg, src, line, col, err })
  self.postMessage({ type: 'error', message: `Worker global error: ${msg} (${src}:${line}:${col})` } satisfies WorkerEvent)
}

self.onunhandledrejection = (e: PromiseRejectionEvent) => {
  console.error('[embeddingWorker] unhandled rejection', e.reason)
  self.postMessage({ type: 'error', message: `Worker unhandled rejection: ${String(e.reason)}` } satisfies WorkerEvent)
}

async function runReducer(algorithmId: ReducerAlgorithmId, data: number[][], n: number, p: ReducerParams): Promise<number[][]> {
  // Mirror umap-js epoch auto-calculation: fewer epochs for larger datasets
  const autoEpochs = n <= 2500 ? 500 : n <= 5000 ? 400 : n <= 7500 ? 300 : 200
  const epochs = p.epochs > 0 ? p.epochs : autoEpochs
  if (algorithmId === 'umap-js') {
    const { UMAP } = await import('umap-js')
    const umap = new UMAP({
      nComponents: 3,
      nNeighbors: Math.min(p.n_neighbors, n - 1),
      minDist: p.min_dist,
      spread: p.spread,
      nEpochs: p.epochs,  // 0 triggers umap-js's own auto-calculation
    })
    return umap.fit(data) as number[][]
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const druid = await import('@saehrimnir/druidjs') as any
  if (algorithmId === 'umap-druid') {
    const reducer = new druid.UMAP(data, { d: 3, n_neighbors: Math.min(p.n_neighbors, n - 1), min_dist: p.min_dist, _spread: p.spread })
    return reducer.transform(epochs).to2dArray()
  }
  if (algorithmId === 'localmap') {
    const reducer = new druid.LocalMAP(data, {
      d: 3,
      n_neighbors: Math.min(p.n_neighbors, n - 1),
      MN_ratio: p.MN_ratio,
      FP_ratio: p.FP_ratio,
      low_dist_thres: p.low_dist_thres,
    })
    return reducer.transform().to2dArray()
  }
  // pacmap
  const reducer = new druid.PaCMAP(data, {
    d: 3,
    n_neighbors: Math.min(p.n_neighbors, n - 1),
    MN_ratio: p.MN_ratio,
    FP_ratio: p.FP_ratio,
  })
  return reducer.transform().to2dArray()
}

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

      self.postMessage({ type: 'progress:reducer-running' } satisfies WorkerEvent)
      const n = vectors.length
      const data = vectors.map(v => Array.from(v))
      const result = await runReducer(cmd.algorithmId, data, n, cmd.reducerParams)
      self.postMessage({ type: 'done', points: result as [number, number, number][] } satisfies WorkerEvent)
    } catch (err) {
      console.error('[embeddingWorker] caught error', err)
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerEvent)
    }
  }
}
