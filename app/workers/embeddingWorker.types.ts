export type ReducerAlgorithmId = 'umap-js' | 'umap-druid' | 'localmap' | 'pacmap'

export type ReducerParams = Record<string, number>

export type WorkerCommand =
  | { type: 'embed'; texts: string[]; modelId: string; algorithmId: ReducerAlgorithmId; reducerParams: ReducerParams }

export type WorkerEvent =
  | { type: 'progress:model-loading'; progress: number }
  | { type: 'progress:embedding'; loaded: number; total: number }
  | { type: 'progress:reducer'; epoch: number; total: number }
  | { type: 'done'; points: [number, number, number][] }
  | { type: 'error'; message: string }
