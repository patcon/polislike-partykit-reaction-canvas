import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';
import PanelSettingsModalSocialMedia from '../../app/components/modals/PanelSettingsModalSocialMedia';
import type { SocialConfig } from '../../app/types';

export default function SocialSharingConfigModal({ onClose }: { onClose: () => void }) {
  const { send, getLastMessage } = useAdminSocket();

  const current = getLastMessage('socialConfigChanged')?.config as SocialConfig | null | undefined;

  const handleSubmit = (config: SocialConfig) => {
    send({ type: 'setSocialConfig', config });
  };

  return (
    <PanelSettingsModalSocialMedia
      current={current}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}
