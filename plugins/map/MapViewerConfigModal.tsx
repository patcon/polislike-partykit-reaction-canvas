import React from 'react';
import { usePanelContext } from '../../app/context/PanelContext';
import { useMapViewerConfig } from './useMapViewerConfig';
import PanelSettingsModalMapViewer from '../../app/components/modals/PanelSettingsModalMapViewer';

export default function MapViewerConfigModal({ onClose }: { onClose: () => void }) {
  const { room } = usePanelContext();
  const { config, setConfig } = useMapViewerConfig();
  return (
    <PanelSettingsModalMapViewer
      room={room}
      current={config}
      onSubmit={setConfig}
      onClose={onClose}
    />
  );
}
