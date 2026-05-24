import { runReducer } from 'reddwarf-ts';
import type { DruidWorkerCommand } from './druidWorker.types';

self.onmessage = (evt: MessageEvent<DruidWorkerCommand>) => {
  const { matrix, algorithm, params } = evt.data;
  try {
    for (const event of runReducer({ type: 'reduce', matrix, algorithm, params })) {
      self.postMessage(event);
      if (event.type === 'done' || event.type === 'error') break;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
