import { useState, useEffect } from 'react';
import type PartySocket from 'partysocket';
import type { VizConfig } from '../../../types';
import { DEFAULT_VIZ_CONFIG } from '../../Visualizer/createVisualizerScene';

export { DEFAULT_VIZ_CONFIG };

export function useVisualizerConfig(socket: PartySocket | null, initial: VizConfig | null) {
  const [vizConfig, setVizConfig] = useState<VizConfig>(initial ?? DEFAULT_VIZ_CONFIG);

  useEffect(() => {
    if (initial) setVizConfig(initial);
  }, [initial]);

  function sendVizConfig(partial: Partial<VizConfig>) {
    const next = { ...vizConfig, ...partial };
    setVizConfig(next);
    socket?.send(JSON.stringify({ type: 'setVisualizerConfig', config: next }));
  }

  return { vizConfig, sendVizConfig };
}
