import type { KnnBackend, ReducerAlgorithm } from 'reddwarf-ts';

export type { KnnBackend, ReducerAlgorithm };

export type DruidWorkerCommand = {
  type: 'reduce';
  matrix: number[][];
  algorithm: ReducerAlgorithm;
  params: Record<string, number>;
  knnBackend?: KnnBackend;
  knnParams?: Record<string, number>;
};

export type DruidWorkerEvent =
  | { type: 'progress'; iteration: number; total: number; coords: [number, number][] }
  | { type: 'done'; coords: [number, number][] }
  | { type: 'error'; message: string };
