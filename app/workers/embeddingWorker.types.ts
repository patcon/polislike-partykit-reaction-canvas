export type WorkerCommand =
  | { type: 'embed'; texts: string[]; modelId: string }

export type WorkerEvent =
  | { type: 'progress:model-loading'; progress: number }
  | { type: 'progress:embedding'; loaded: number; total: number }
  | { type: 'progress:umap-running' }
  | { type: 'done'; points: [number, number, number][] }
  | { type: 'error'; message: string }
