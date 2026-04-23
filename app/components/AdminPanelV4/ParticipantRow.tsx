import type { ReactionLabelSet } from "../../voteLabels";
import type { ReactionRegion } from "../../utils/voteRegion";

interface ParticipantRowProps {
  userId: string;
  region: ReactionRegion | null;
  labels: ReactionLabelSet;
  online: boolean;
  isSelf?: boolean;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onOfferInterface: () => void;
  onSendHaptic: () => void;
}

export default function ParticipantRow({ userId, region, labels, online, isSelf, isMenuOpen, onMenuToggle, onOfferInterface, onSendHaptic }: ParticipantRowProps) {
  const regionColor = region === 'positive' ? '#4a4' : region === 'negative' ? '#a44' : region === 'neutral' ? '#aa4' : '#555';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#1a1a1a', borderRadius: 4, opacity: online ? 1 : 0.4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? regionColor : '#333', flexShrink: 0 }} />
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {userId}{isSelf && <span style={{ color: '#888', marginLeft: 4 }}>(you)</span>}
      </span>
      <div style={{ position: 'relative' }}>
        <button onClick={onMenuToggle} disabled={!online} style={{ fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: online ? 'pointer' : 'not-allowed', opacity: online ? 1 : 0 }}>
          ···
        </button>
        {isMenuOpen && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#252525', border: '1px solid #444', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 160 }}>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { onOfferInterface(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
            >
              Offer interface…
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { onSendHaptic(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
            >
              Send buzz…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
