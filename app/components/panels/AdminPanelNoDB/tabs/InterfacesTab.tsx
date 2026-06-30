import { useState } from "react";
import { IoMdSettings } from "react-icons/io";
import { FaCheckCircle, FaCircle } from "react-icons/fa";
import QRWithCopy from '../../../shared/QRWithCopy';
import { appendSelfToChain } from "../../../../utils/inviteChain";
import { PANEL_REGISTRY } from "../../../../panelRegistry";
import { PLUGIN_MAP } from "../../../../../plugins/index";
import { SCREENS } from "../../../../screens";

interface InterfacesTabProps {
  screenPanels: Record<string, string>;
  sendScreenPanel: (screenName: string, act: string) => void;
  setCanvasSettingsOpen: (v: boolean) => void;
  setActiveConfigPlugin: (id: string) => void;
  onClearRoleAssignments: () => void;
  userId?: string;
  selfChain?: string[];
}

const QR_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    <line x1="14" y1="17.5" x2="21" y2="17.5" /><line x1="17.5" y1="14" x2="17.5" y2="21" />
  </svg>
);

const SHARE_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

function buildInterfaceUrl(deletes: string[], sets: Record<string, string>): string {
  const p = new URLSearchParams(window.location.search);
  for (const k of deletes) p.delete(k);
  for (const [k, v] of Object.entries(sets)) p.set(k, v);
  const qs = p.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

function getPatchUrl(interfaceName: string, userId?: string, selfChain?: string[]): string {
  const sets: Record<string, string> = { addInterface: interfaceName };
  if (userId && selfChain !== undefined) {
    sets.inviteChain = appendSelfToChain(selfChain, userId).join(',');
  }
  return buildInterfaceUrl(['forceView', 'admin', 'interface'], sets);
}

function getScreenUrl(interfaceName: string, extraParams?: Record<string, string>): string {
  return buildInterfaceUrl(['forceView', 'admin', 'addInterface'], { interface: interfaceName, ...extraParams });
}


export default function InterfacesTab({
  screenPanels,
  sendScreenPanel,
  setCanvasSettingsOpen,
  setActiveConfigPlugin,
  onClearRoleAssignments, userId, selfChain,
}: InterfacesTabProps) {
  const [patchInterface, setPatchInterface] = useState<string | null>(null);
  const [screenShareTarget, setScreenShareTarget] = useState<string | null>(null);
  const patchUrl = patchInterface ? getPatchUrl(patchInterface, userId, selfChain) : '';
  const shareScreen = screenShareTarget ? SCREENS.find(s => s.name === screenShareTarget) ?? null : null;

  const thStyle = { color: '#666', fontWeight: 500, padding: '0 8px 8px', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const };

  return (
    <div>
      <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>All settings here are shared with all participants in real time.</p>

      {/* ── Interface table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th colSpan={SCREENS.length} style={{ ...thStyle, padding: '0 8px 4px', color: '#555', letterSpacing: '0.08em' }}>Screens</th>
            <th style={{ textAlign: 'left', color: '#666', fontWeight: 500, padding: '0 8px 8px 0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }} rowSpan={2}>Interface</th>
            <th style={{ ...thStyle, width: 36, padding: '0 4px 8px' }} rowSpan={2}></th>
            <th style={{ ...thStyle, width: 56, padding: '0 0 8px 8px' }} rowSpan={2}>Panel Share</th>
          </tr>
          <tr>
            {SCREENS.map(screen => (
              <th key={screen.name} style={{ ...thStyle, width: 56, padding: '0 8px 8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span>{screen.label}</span>
                  <button
                    style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: 2, lineHeight: 0 }}
                    title={`Share ${screen.label} Screen URL`}
                    aria-label={`Share ${screen.label} Screen URL`}
                    onClick={() => setScreenShareTarget(screen.name)}
                  >
                    {SHARE_ICON}
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PANEL_REGISTRY.map(({ id, label, description, canStandalone, canScreenMount, needsLifecycle, requiresHttps }) => {
            const isPersonalActive = (screenPanels['personal'] ?? 'canvas') === id;
            const hasConfig = id === 'canvas' || !!PLUGIN_MAP[id]?.configModal;
            return (
              <tr key={id} style={{ borderTop: '1px solid #2a2a2a' }}>
                {SCREENS.map(screen => {
                  const isActive = (screenPanels[screen.name] ?? 'canvas') === id;
                  // A panel needing server lifecycle activation can only mount on a lifecycle screen.
                  const blocked = !!needsLifecycle && !screen.lifecycle;
                  const mountable = canScreenMount && !blocked;
                  return (
                    <td key={screen.name} style={{ textAlign: 'center', padding: '10px 8px' }}>
                      {mountable ? (
                        <button
                          onClick={() => sendScreenPanel(screen.name, id as string)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, color: isActive ? '#eee' : '#555' }}
                          aria-label={`Switch ${screen.label} screen to ${label}`}
                          aria-pressed={isActive}
                        >
                          {isActive ? <FaCheckCircle size={14} /> : <FaCircle size={14} />}
                        </button>
                      ) : (
                        <span
                          style={{ color: '#3a3a3a', fontSize: 11 }}
                          title={blocked ? `${label} needs an interactive screen` : undefined}
                        >—</span>
                      )}
                    </td>
                  );
                })}
                {/* Description */}
                <td style={{ padding: '10px 8px 10px 0' }}>
                  <span style={{ fontWeight: isPersonalActive ? 600 : 400, color: isPersonalActive ? '#eee' : '#bbb' }}>{label}</span>
                  <span style={{ color: '#666', marginLeft: 8 }}>{description}</span>
                  {requiresHttps && !window.isSecureContext && (
                    <span title="SSL required — some features unavailable on HTTP" style={{ marginLeft: 6, color: '#f90', fontSize: 12, cursor: 'default' }}>⚠ SSL required</span>
                  )}
                </td>
                {/* Gear */}
                <td style={{ textAlign: 'center', padding: '10px 4px' }}>
                  {hasConfig ? (
                    <button
                      className="image-canvas-config-link"
                      style={{ marginLeft: 0, padding: 4 }}
                      onClick={e => { e.preventDefault(); id === 'canvas' ? setCanvasSettingsOpen(true) : setActiveConfigPlugin(id); }}
                      aria-label={`Configure ${label}`}
                    >
                      <IoMdSettings size={15} />
                    </button>
                  ) : (
                    <span style={{ color: '#333', lineHeight: 0, display: 'inline-flex', padding: 4 }} aria-hidden="true">
                      <IoMdSettings size={15} />
                    </span>
                  )}
                </td>
                {/* Panel Share */}
                <td style={{ textAlign: 'center', padding: '10px 0 10px 8px' }}>
                  {canStandalone ? (
                    <button
                      onClick={() => setPatchInterface(id)}
                      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, lineHeight: 0 }}
                      title="Share panel URL"
                      aria-label={`Share ${label} interface URL`}
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

      {/* Role assignments */}
      <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 20 }}>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>Role assignments</p>
        <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Push interface invitations to participants from the People tab. Use this to revoke all pushed roles.</p>
        <button className="v3-admin-btn v3-admin-btn--destructive" onClick={onClearRoleAssignments}>Clear all role assignments</button>
      </div>

      {/* Panel Share dialog — share URL for standalone interfaces */}
      {patchInterface && (
        <div className="share-qr-modal" onClick={() => setPatchInterface(null)}>
          <div className="share-qr-modal-card" onClick={e => e.stopPropagation()}>
            <p className="share-qr-modal-title">{PANEL_REGISTRY.find(r => r.id === patchInterface)?.label} — add without push</p>
            <QRWithCopy url={patchUrl} />
            <button className="share-qr-modal-close" onClick={() => setPatchInterface(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Screen share dialog — direct URL to a named screen */}
      {shareScreen && (
        <div className="share-qr-modal" onClick={() => setScreenShareTarget(null)}>
          <div className="share-qr-modal-card" onClick={e => e.stopPropagation()}>
            <p className="share-qr-modal-title">
              {shareScreen.label} Screen — share link
            </p>
            <QRWithCopy url={getScreenUrl(shareScreen.name, shareScreen.shareParams)} />
            <button className="share-qr-modal-close" onClick={() => setScreenShareTarget(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
