import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { IoMdSettings } from "react-icons/io";
import type { ActivityMode } from "../../../types";

interface InterfacesTabProps {
  activity: ActivityMode;
  soccerScore: { left: number; right: number };
  sendActivity: (act: ActivityMode) => void;
  resetSoccerScore: () => void;
  setImageConfigOpen: (v: boolean) => void;
  setSocialConfigOpen: (v: boolean) => void;
  setCanvasSettingsOpen: (v: boolean) => void;
  onClearRoleAssignments: () => void;
}

const QR_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    <line x1="14" y1="17.5" x2="21" y2="17.5" /><line x1="17.5" y1="14" x2="17.5" y2="21" />
  </svg>
);

function getPatchUrl(interfaceName: string): string {
  const p = new URLSearchParams(window.location.search);
  p.delete('forceView');
  p.delete('admin');
  p.set('interface', interfaceName);
  const qs = p.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

const ROWS: { id: ActivityMode; label: string; desc: string; patchable: boolean }[] = [
  { id: 'canvas',       label: 'Reaction Canvas', desc: 'Standard reaction canvas',                       patchable: false },
  { id: 'image-canvas', label: 'Image Canvas',    desc: 'React over a shared background image',           patchable: false },
  { id: 'soccer',       label: 'Soccer',          desc: 'Top-down physics ball — kick with your cursor',  patchable: false },
  { id: 'social',       label: 'Social Sharing',  desc: 'Bluesky · Twitter / X · Mastodon',              patchable: true  },
];

export default function InterfacesTab({
  activity, soccerScore,
  sendActivity, resetSoccerScore,
  setImageConfigOpen, setSocialConfigOpen, setCanvasSettingsOpen,
  onClearRoleAssignments,
}: InterfacesTabProps) {
  const [patchDialogOpen, setPatchDialogOpen] = useState(false);
  const patchUrl = getPatchUrl('social');

  return (
    <div>
      <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>All settings here are shared with all participants in real time.</p>

      {/* ── Interface table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: '#666', fontWeight: 500, padding: '0 8px 8px 0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Interface</th>
            <th style={{ color: '#666', fontWeight: 500, padding: '0 8px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', width: 48, textAlign: 'center' }}>Solo</th>
            <th style={{ color: '#444', fontWeight: 500, padding: '0 8px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', width: 64, textAlign: 'center' }}>Commons</th>
            <th style={{ color: '#666', fontWeight: 500, padding: '0 0 8px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', width: 48, textAlign: 'center' }}>Share</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ id, label, desc, patchable }) => {
            const isActive = activity === id;
            return (
              <tr key={id} style={{ borderTop: '1px solid #2a2a2a' }}>
                {/* Description */}
                <td style={{ padding: '10px 8px 10px 0' }}>
                  <label style={{ cursor: 'pointer', display: 'block' }} htmlFor={`activity-${id}`}>
                    <span style={{ fontWeight: isActive ? 600 : 400, color: isActive ? '#eee' : '#bbb' }}>{label}</span>
                    <span style={{ color: '#666', marginLeft: 8 }}>{desc}</span>
                    {id === 'canvas' && (
                      <button className="image-canvas-config-link" onClick={e => { e.preventDefault(); setCanvasSettingsOpen(true); }}><IoMdSettings /></button>
                    )}
                    {id === 'image-canvas' && (
                      <button className="image-canvas-config-link" onClick={e => { e.preventDefault(); setImageConfigOpen(true); }}><IoMdSettings /></button>
                    )}
                    {id === 'social' && (
                      <button className="image-canvas-config-link" onClick={e => { e.preventDefault(); setSocialConfigOpen(true); }}><IoMdSettings /></button>
                    )}
                  </label>
                </td>
                {/* Solo */}
                <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                  <input
                    id={`activity-${id}`}
                    type="radio"
                    name="activity"
                    value={id}
                    checked={isActive}
                    onChange={() => sendActivity(id)}
                  />
                </td>
                {/* Commons — placeholder */}
                <td style={{ textAlign: 'center', padding: '10px 8px', color: '#3a3a3a' }}>—</td>
                {/* Patch */}
                <td style={{ textAlign: 'center', padding: '10px 0 10px 8px' }}>
                  {patchable ? (
                    <button
                      onClick={() => setPatchDialogOpen(true)}
                      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, lineHeight: 0 }}
                      title="Share patch URL"
                      aria-label="Share social interface URL"
                    >
                      {QR_ICON}
                    </button>
                  ) : (
                    <span style={{ color: '#333', display: 'inline-block', lineHeight: 0, padding: 4 }} aria-hidden="true">
                      {QR_ICON}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Soccer score — shown when soccer is active */}
      {activity === 'soccer' && (
        <div style={{ marginTop: 20, borderTop: '1px solid #444', paddingTop: 16 }}>
          <p style={{ marginBottom: 10, fontWeight: 600 }}>Soccer settings:</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
            <span style={{ color: '#aaa', fontSize: 15 }}>Score:</span>
            <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#eee' }}>
              {soccerScore.left} – {soccerScore.right}
            </span>
          </div>
          <button className="v3-admin-btn v3-admin-btn--destructive" onClick={resetSoccerScore}>Reset Score</button>
        </div>
      )}

      {/* Role assignments */}
      <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 20 }}>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>Role assignments</p>
        <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Push interface invitations to participants from the People tab. Use this to revoke all pushed roles.</p>
        <button className="v3-admin-btn v3-admin-btn--destructive" onClick={onClearRoleAssignments}>Clear all role assignments</button>
      </div>

      {/* Patch dialog — social sharing URL */}
      {patchDialogOpen && (
        <div className="share-qr-modal" onClick={() => setPatchDialogOpen(false)}>
          <div className="share-qr-modal-card" onClick={e => e.stopPropagation()}>
            <p className="share-qr-modal-title">Social Sharing — add without push</p>
            <div className="v2-mobile-gate-qr">
              <QRCodeSVG value={patchUrl} size={220} />
            </div>
            <p className="share-qr-modal-url">{patchUrl}</p>
            <button className="share-qr-modal-close" onClick={() => setPatchDialogOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
