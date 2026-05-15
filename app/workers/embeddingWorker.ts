import type { ReducerAlgorithmId, ReducerParams, WorkerCommand, WorkerEvent } from './embeddingWorker.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPipeline = any

const pipelineCache = new Map<string, AnyPipeline>()
// Per-chunk vector cache: key = `${modelId}\x00${text}`
const vectorCache = new Map<string, Float32Array>()

const IDB_STORE = 'vectors'
let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      // Version 2: per-chunk entries (ArrayBuffer each); v1 used per-batch (ArrayBuffer[]) — incompatible, so recreate the store
      const req = indexedDB.open('embedding-cache', 2)
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result
        if (db.objectStoreNames.contains(IDB_STORE)) db.deleteObjectStore(IDB_STORE)
        db.createObjectStore(IDB_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => { dbPromise = null; reject(req.error) }
    })
  }
  return dbPromise
}

async function idbGetChunk(key: string): Promise<Float32Array | null> {
  try {
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
      req.onsuccess = () => {
        const buf = req.result as ArrayBuffer | undefined
        resolve(buf ? new Float32Array(buf) : null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function idbSetChunk(key: string, vector: Float32Array): Promise<void> {
  try {
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const buf = vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength)
      const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(buf, key)
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
      const chunkKeys = cmd.texts.map(text => `${cmd.modelId}\x00${text}`)

      // Pass 1: in-memory cache
      const vectors: (Float32Array | null)[] = chunkKeys.map(k => vectorCache.get(k) ?? null)

      // Pass 2: IDB for any still-missing chunks (parallel reads)
      const afterMemory = vectors.map((v, i) => v === null ? i : -1).filter(i => i >= 0)
      if (afterMemory.length > 0) {
        const idbResults = await Promise.all(afterMemory.map(i => idbGetChunk(chunkKeys[i])))
        for (let j = 0; j < afterMemory.length; j++) {
          const i = afterMemory[j]
          if (idbResults[j]) {
            vectors[i] = idbResults[j]
            vectorCache.set(chunkKeys[i], idbResults[j]!)
          }
        }
      }

      // Pass 3: embed any still-missing chunks
      const toEmbed = vectors.map((v, i) => v === null ? i : -1).filter(i => i >= 0)
      if (toEmbed.length > 0) {
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
        for (let j = 0; j < toEmbed.length; j++) {
          const i = toEmbed[j]
          // progress counts only the chunks that actually need embedding
          self.postMessage({ type: 'progress:embedding', loaded: j, total: toEmbed.length } satisfies WorkerEvent)
          const output = await pipe(cmd.texts[i], { pooling: 'mean', normalize: true })
          const vector = output.data as Float32Array
          vectors[i] = vector
          vectorCache.set(chunkKeys[i], vector)
          void idbSetChunk(chunkKeys[i], vector)
        }
      }

      self.postMessage({ type: 'progress:reducer-running' } satisfies WorkerEvent)
      const finalVectors = vectors as Float32Array[]
      const data = finalVectors.map(v => Array.from(v))
      const result = await runReducer(cmd.algorithmId, data, finalVectors.length, cmd.reducerParams)
      self.postMessage({ type: 'done', points: result as [number, number, number][] } satisfies WorkerEvent)
    } catch (err) {
      console.error('[embeddingWorker] caught error', err)
      self.postMessage({ type: 'error', message: String(err) } satisfies WorkerEvent)
    }
  }
}
