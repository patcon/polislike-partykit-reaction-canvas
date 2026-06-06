import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';
import PanelSettingsModalImageCanvas from '../../app/components/modals/PanelSettingsModalImageCanvas';

export default function ImageCanvasConfigModal({ onClose }: { onClose: () => void }) {
  const { send, getLastMessage } = useAdminSocket();
  const currentUrl = (
    (getLastMessage('imageUrlChanged')?.url ?? getLastMessage('connected')?.roomImageUrl) as string | undefined
  ) ?? '';

  return (
    <PanelSettingsModalImageCanvas
      currentUrl={currentUrl}
      onSubmit={(url) => send({ type: 'setImageUrl', url })}
      onClose={onClose}
    />
  );
}
