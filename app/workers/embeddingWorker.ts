import type { ReducerAlgorithmId, ReducerParams, WorkerCommand, WorkerEvent } from './embeddingWorker.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPipeline = any

const pipelineCache = new Map<string, AnyPipeline>()
const vectorCache = new Map<string, Float32Array[]>()

const IDB_DB = 'embedding-cache'
const IDB_STORE = 'vectors'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<Float32Array[] | null> {
  try {
    const db = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => {
        const val = req.result as ArrayBuffer[] | undefined
        resolve(val ? val.map(buf => new Float32Array(buf)) : null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function idbSet(key: string, vectors: Float32Array[]): Promise<void> {
  try {
    const db = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const bufs = vectors.map(v => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))
      const req = tx.objectStore(IDB_STORE).put(bufs, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // non-fatal — cache write failure doesn't break the run
  }
}

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
    return reducer.transform(epochs)
  }
  if (algorithmId === 'localmap') {
    const reducer = new druid.LocalMAP(data, {
      d: 3,
      n_neighbors: Math.min(p.n_neighbors, n - 1),
      MN_ratio: p.MN_ratio,
      FP_ratio: p.FP_ratio,
      low_dist_thres: p.low_dist_thres,
    })
    return reducer.transform()
  }
  // pacmap
  const reducer = new druid.PaCMAP(data, {
    d: 3,
    n_neighbors: Math.min(p.n_neighbors, n - 1),
    MN_ratio: p.MN_ratio,
    FP_ratio: p.FP_ratio,
  })
  return reducer.transform()
}

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data
  if (cmd.type === 'embed') {
    try {
      const cacheKey = `${cmd.modelId}\x00${cmd.texts.join('\x00')}`

      let vectors = vectorCache.get(cacheKey) ?? null

      if (!vectors) {
        vectors = await idbGet(cacheKey)
        if (vectors) vectorCache.set(cacheKey, vectors)
      }

      if (!vectors) {
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
        vectors = []
        for (let i = 0; i < cmd.texts.length; i++) {
          self.postMessage({ type: 'progress:embedding', loaded: i, total: cmd.texts.length } satisfies WorkerEvent)
          const output = await pipe(cmd.texts[i], { pooling: 'mean', normalize: true })
          vectors.push(output.data as Float32Array)
        }

        vectorCache.set(cacheKey, vectors)
        void idbSet(cacheKey, vectors)
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
