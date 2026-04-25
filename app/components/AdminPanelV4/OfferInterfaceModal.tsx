import type { ReactionLabelSet } from "../../voteLabels";
import type { PushTarget } from "./types";

interface OfferInterfaceModalProps {
  pushTarget: PushTarget;
  pendingInterfaceName: string;
  setPendingInterfaceName: (v: string) => void;
  activeLabels: ReactionLabelSet;
  onSend: (msg: object) => void;
  onClose: () => void;
}

export default function OfferInterfaceModal({
  pushTarget, pendingInterfaceName, setPendingInterfaceName,
  activeLabels, onSend, onClose,
}: OfferInterfaceModalProps) {
  const handleSend = () => {
    onSend({
      type: 'pushInterface',
      ...(pushTarget.kind === 'user'
        ? { targetUserId: pushTarget.userId }
        : pushTarget.kind === 'users'
          ? { targetUserIds: pushTarget.userIds }
          : { targetRegion: pushTarget.region }),
      interfaceName: pendingInterfaceName,
    });
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onPointerDown={onClose}
    >
      <div
        style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 10, padding: '20px 20px 16px', width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, color: '#888' }}>
          Offer interface to{' '}
          {pushTarget.kind === 'user'
            ? <span style={{ color: '#ccc', fontFamily: 'monospace' }}>{pushTarget.userId}</span>
            : pushTarget.kind === 'users'
              ? <span style={{ color: '#ccc' }}>{pushTarget.label} ({pushTarget.userIds.length})</span>
              : <span style={{ color: '#ccc' }}>{pushTarget.region === null ? 'Lurking' : activeLabels[pushTarget.region]} group</span>
          }
        </div>
        <select
          value={pendingInterfaceName}
          onChange={e => setPendingInterfaceName(e.target.value)}
          autoFocus
          style={{ background: '#333', border: '1px solid #555', color: '#eee', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
        >
          <option value="social">social</option>
          <option value="emcee">emcee</option>
          <option value="visualizer">visualizer</option>
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSend}
            style={{ flex: 1, padding: '8px', background: '#2a5cba', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
          >
            Send
          </button>
          <button
            onClick={onClose}
            style={{ padding: '8px 14px', background: 'none', border: '1px solid #444', color: '#888', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
