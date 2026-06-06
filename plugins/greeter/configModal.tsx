import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';
import PanelSettingsModalGreeter from '../../app/components/modals/PanelSettingsModalGreeter';
import type { GreeterConfig } from '../../app/types';

export default function GreeterConfigModal({ onClose }: { onClose: () => void }) {
  const { send, getLastMessage } = useAdminSocket();

  const current = getLastMessage('greeterConfigChanged')?.config as GreeterConfig | null | undefined;

  const handleSubmit = (config: GreeterConfig) => {
    send({ type: 'setGreeterConfig', config });
  };

  return (
    <PanelSettingsModalGreeter
      current={current}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}
