import type { ReactionLabelSet } from "../../voteLabels";
import type { PushTarget } from "./types";

interface HapticConfirmModalProps {
  pushTarget: PushTarget;
  activeLabels: ReactionLabelSet;
  onSend: () => void;
  onClose: () => void;
}

export default function HapticConfirmModal({ pushTarget, activeLabels, onSend, onClose }: HapticConfirmModalProps) {
  const targetDescription =
    pushTarget.kind === 'user'
      ? <span style={{ color: '#ccc', fontFamily: 'monospace' }}>{pushTarget.userId}</span>
      : pushTarget.kind === 'users'
        ? <span style={{ color: '#ccc' }}>{pushTarget.label} ({pushTarget.userIds.length})</span>
        : <span style={{ color: '#ccc' }}>{pushTarget.region === null ? 'Lurking' : activeLabels[pushTarget.region]} group</span>;

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
          Send haptic buzz to {targetDescription}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onSend}
            autoFocus
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
