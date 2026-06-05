import { useState, useEffect } from "react";
import { idbGet } from "../../utils/idbStorage";
import type { MapViewerConfig } from "../../types";
import type { MomentSnapshot } from "../panels/AdminPanelNoDB/types";
import { VOTE_COLORS, USER_STATUS_COLORS, USER_STATUS_LABELS, MISSING_COLOR } from "../../constants/userStatus";

interface PanelSettingsModalMapViewerProps {
  room: string;
  current: MapViewerConfig | null;
  onSubmit: (config: MapViewerConfig) => void;
  onClose: () => void;
}

export default function PanelSettingsModalMapViewer({ room, current, onSubmit, onClose }: PanelSettingsModalMapViewerProps) {
  const [colorMode, setColorMode] = useState<'none' | 'moment' | 'now'>(current?.colorMode ?? 'none');
  const [momentId, setMomentId] = useState<string | null>(current?.momentId ?? null);
  const [moments, setMoments] = useState<MomentSnapshot[]>([]);

  useEffect(() => {
    idbGet<MomentSnapshot[]>(`v4-moments-${room}`).then(stored => {
      if (stored) setMoments(stored);
    });
  }, [room]);

  const handleSave = () => {
    onSubmit({ colorMode, momentId: colorMode === 'moment' ? momentId : null });
    onClose();
  };

  const showVoteLegend = colorMode === 'moment' || colorMode === 'now';

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Map Viewer config</p>
        <p className="github-modal-body">Choose how participant dots are colored on the map.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Color mode</span>
            <select
              className="github-modal-input"
              value={colorMode}
              onChange={e => setColorMode(e.target.value as 'none' | 'moment' | 'now')}
              style={{ cursor: 'pointer' }}
            >
              <option value="none">None (uniform color)</option>
              <option value="moment">Valence: Moments</option>
              <option value="now">Valence: Now</option>
            </select>
          </label>

          {colorMode === 'moment' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa' }}>Moment</span>
              {moments.length === 0 ? (
                <p style={{ fontSize: 12, color: '#666', margin: 0 }}>No moments loaded. Import a Polis CSV or snap moments first.</p>
              ) : (
                <select
                  className="github-modal-input"
                  value={momentId ?? ''}
                  onChange={e => setMomentId(e.target.value || null)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">— pick a moment —</option>
                  {moments.map(m => (
                    <option key={m.id} value={m.id}>{m.label || `Moment ${m.id.slice(0, 6)}`}</option>
                  ))}
                </select>
              )}
            </label>
          )}

          {showVoteLegend && (
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: VOTE_COLORS.positive, display: 'inline-block' }} /> agree
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: VOTE_COLORS.negative, display: 'inline-block' }} /> disagree
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: VOTE_COLORS.neutral, display: 'inline-block' }} /> pass
              </span>
              {colorMode === 'moment' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: MISSING_COLOR, display: 'inline-block' }} /> missing
                </span>
              )}
              {colorMode === 'now' && (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: USER_STATUS_COLORS.idle, display: 'inline-block' }} /> {USER_STATUS_LABELS.idle}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: USER_STATUS_COLORS.offline, display: 'inline-block' }} /> {USER_STATUS_LABELS.offline}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <button className="github-modal-btn-primary" onClick={handleSave} style={{ marginTop: 16 }}>
          Save
        </button>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
