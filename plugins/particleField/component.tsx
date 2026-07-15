import { useState } from 'react';
import { usePanelContext } from '../../app/context/PanelContext';
import { useCoordStream } from '../../app/hooks/useCoordStream';
import ParticleFieldCanvas from './ParticleFieldCanvas';
import ConfigDrawer from './ConfigDrawer';
import { DEFAULT_PARAMS } from './constants';
import type { Params } from './types';

export default function ParticleFieldPanel() {
  const { userId } = usePanelContext();
  // includeSelf: this is a presentation viz, matches sibling plugins (boids/moodTones).
  const stream = useCoordStream(userId, { includeSelf: true });

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [showCursors, setShowCursors] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ParticleFieldCanvas stream={stream} params={params} showCursors={showCursors} />
      <ConfigDrawer
        params={params}
        onChange={setParams}
        showCursors={showCursors}
        onShowCursorsChange={setShowCursors}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />
    </div>
  );
}
