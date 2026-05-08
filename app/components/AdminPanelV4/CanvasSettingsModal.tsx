import { useState } from "react";
import type { ValenceInputMode } from "../../types";

interface CanvasSettingsModalProps {
  showNowLabel: boolean;
  onChangeShowNowLabel: (v: boolean) => void;
  ownValenceDisplay: 'background' | 'labels' | 'none';
  onChangeOwnValenceDisplay: (mode: 'background' | 'labels' | 'none') => void;
  valenceInputMode: ValenceInputMode;
  onChangeValenceInputMode: (mode: ValenceInputMode) => void;
  onClose: () => void;
}

const OWN_VALENCE_OPTIONS: { value: 'background' | 'labels' | 'none'; label: string; description: string }[] = [
  { value: 'background', label: 'Background', description: 'Canvas background shifts color as you move between regions' },
  { value: 'labels', label: 'Labels', description: 'The label for your current region gets a subtle color highlight' },
  { value: 'none', label: 'None', description: 'No visual feedback for your own position' },
];

const VALENCE_INPUT_OPTIONS: { value: ValenceInputMode; label: string; description: string }[] = [
  { value: 'touch', label: 'Touch', description: 'Move your finger across the canvas to express your reaction' },
  { value: 'orientation-horizontal', label: 'Orientation (Horizontal)', description: 'Face-up = agree, face-down = disagree — works for any flip direction or combination' },
  { value: 'orientation-vertical', label: 'Orientation (Vertical)', description: 'Phone upright = agree, phone flat = pass, phone upside-down = disagree' },
];

export default function CanvasSettingsModal({ showNowLabel, onChangeShowNowLabel, ownValenceDisplay, onChangeOwnValenceDisplay, valenceInputMode, onChangeValenceInputMode, onClose }: CanvasSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'display' | 'input'>('display');

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Reaction Canvas settings</p>

        <div className="share-qr-tab-bar" style={{ marginBottom: 16 }}>
          <button
            className={`share-qr-tab-btn${activeTab === 'display' ? ' share-qr-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('display')}
          >
            Valence Display
          </button>
          <button
            className={`share-qr-tab-btn${activeTab === 'input' ? ' share-qr-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            Valence Input
          </button>
        </div>

        {activeTab === 'display' && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#ccc', fontSize: 14, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={showNowLabel}
                onChange={e => onChangeShowNowLabel(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              Show "Now" label on canvas
            </label>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
              Displays the current moment label at the top of the canvas for all participants. Clears when the moment is snapped.
            </p>

            <p style={{ color: '#ccc', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Display own valence via</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {OWN_VALENCE_OPTIONS.map(({ value, label, description }) => (
                <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="ownValenceDisplay"
                    value={value}
                    checked={ownValenceDisplay === value}
                    onChange={() => onChangeOwnValenceDisplay(value)}
                    style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ color: '#ccc', fontSize: 14 }}>{label}</span>
                    <span style={{ display: 'block', color: '#666', fontSize: 12 }}>{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {activeTab === 'input' && (
          <>
            <p style={{ color: '#ccc', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Detect valence via</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {VALENCE_INPUT_OPTIONS.map(({ value, label, description }) => (
                <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="valenceInputMode"
                    value={value}
                    checked={valenceInputMode === value}
                    onChange={() => onChangeValenceInputMode(value)}
                    style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ color: '#ccc', fontSize: 14 }}>{label}</span>
                    <span style={{ display: 'block', color: '#666', fontSize: 12 }}>{description}</span>
                  </span>
                </label>
              ))}
            </div>
            {valenceInputMode !== 'touch' && (
              <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
                In orientation mode, the cursor moves along the disagree → pass → agree path based on phone tilt. Participants will be prompted to grant orientation permission on iOS.
              </p>
            )}
          </>
        )}

        <button className="github-modal-btn-dismiss" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
