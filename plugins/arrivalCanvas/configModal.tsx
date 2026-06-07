import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';
import PanelSettingsModalArrivalCanvas from '../../app/components/panels/AdminPanelNoDB/PanelSettingsModalArrivalCanvas';

export default function ArrivalCanvasConfigModal({ onClose }: { onClose: () => void }) {
  const { send, getLastMessage } = useAdminSocket();

  const current = getLastMessage('arrivalCapacityChanged')?.capacity as number | undefined;

  const handleSubmit = (capacity: number) => {
    send({ type: 'setArrivalCapacity', capacity });
  };

  return (
    <PanelSettingsModalArrivalCanvas
      currentCapacity={current ?? 50}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}
