import type { ReducerAlgorithm } from 'reddwarf-ts';

export type { ReducerAlgorithm };

export type DruidWorkerCommand = {
  type: 'reduce';
  matrix: number[][];
  algorithm: ReducerAlgorithm;
  params: Record<string, number>;
};

export type DruidWorkerEvent =
  | { type: 'progress'; iteration: number; total: number; coords: [number, number][] }
  | { type: 'done'; coords: [number, number][] }
  | { type: 'error'; message: string };
