import { memo } from "react";
import { computeReactionRegion } from "../../../utils/voteRegion";
import type { ReactionAnchors, ReactionRegion } from "../../../utils/voteRegion";
import type { ReactionLabelSet } from "../../../voteLabels";
import type { MomentSnapshot } from "../types";

interface MomentsTabProps {
  moments: MomentSnapshot[];
  setMoments: (v: MomentSnapshot[]) => void;
  seenUsers: Set<string>;
  connectedUsers: Set<string>;
  liveCursors: Map<string, { x: number; y: number }>;
  momentLabelInput: string;
  setMomentLabelInput: (v: string) => void;
  expandedMoments: Set<string>;
  setExpandedMoments: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  editingMomentId: string | null;
  setEditingMomentId: (v: string | null) => void;
  editingMomentLabel: string;
  setEditingMomentLabel: (v: string) => void;
  snapMoment: () => void;
  activeLabels: ReactionLabelSet;
  activeAnchors: ReactionAnchors;
  room: string;
}

function MomentsTabInner({
  moments, setMoments,
  seenUsers, connectedUsers, liveCursors,
  momentLabelInput, setMomentLabelInput,
  expandedMoments, setExpandedMoments,
  editingMomentId, setEditingMomentId,
  editingMomentLabel, setEditingMomentLabel,
  snapMoment, activeLabels, activeAnchors, room,
}: MomentsTabProps) {
  const toggleExpanded = (id: string) => {
    setExpandedMoments(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const nowCounts = { positive: 0, negative: 0, neutral: 0, lurking: 0 };
  for (const userId of seenUsers) {
    const cursor = liveCursors.get(userId);
    const r = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null;
    if (r === 'positive') nowCounts.positive++;
    else if (r === 'negative') nowCounts.negative++;
    else if (r === 'neutral') nowCounts.neutral++;
    else nowCounts.lurking++;
  }
  const isEditingNow = editingMomentId === '__now__';
  const nowExpanded = expandedMoments.has('__now__');

  return (
    <div>
      {/* "Now" card */}
      <div style={{ border: '2px solid #1a7a3c', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#162b1e', cursor: 'pointer' }}
          onClick={() => toggleExpanded('__now__')}
        >
          <span style={{ fontSize: 10, color: '#4c4', width: 12, textAlign: 'center', flexShrink: 0 }}>{nowExpanded ? '▼' : '▶'}</span>
          {isEditingNow ? (
            <input
              autoFocus
              value={momentLabelInput}
              onChange={e => setMomentLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingMomentId(null); }}
              onBlur={() => setEditingMomentId(null)}
              onClick={e => e.stopPropagation()}
              placeholder="Label for next snap…"
              style={{ flex: 1, background: '#1e3828', color: '#eee', border: '1px solid #2a6040', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}
            />
          ) : (
            <span style={{ flex: 1, fontSize: 13, color: momentLabelInput ? '#cec' : '#7c7', fontStyle: momentLabelInput ? 'normal' : 'italic', fontWeight: 600 }}>
              {momentLabelInput || 'Now'}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setEditingMomentId('__now__'); }}
            style={{ background: 'none', border: 'none', color: '#4a4', cursor: 'pointer', fontSize: 11, padding: '0 4px', flexShrink: 0 }}
            title="Set label"
          >✏</button>
        </div>
        <div style={{ display: 'flex', gap: 16, padding: '6px 30px', background: '#111e16', fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#4c4' }}>{activeLabels.positive}: {nowCounts.positive}</span>
          <span style={{ color: '#c44' }}>{activeLabels.negative}: {nowCounts.negative}</span>
          <span style={{ color: '#88a' }}>{activeLabels.neutral}: {nowCounts.neutral}</span>
          {nowCounts.lurking > 0 && <span style={{ color: '#555' }}>Lurking: {nowCounts.lurking}</span>}
        </div>
        {nowExpanded && (
          <div style={{ padding: '8px 10px 12px', background: '#0e1a12' }}>
            {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
              const members = [...seenUsers].filter(userId => {
                const cursor = liveCursors.get(userId);
                return (cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null) === region;
              });
              const groupLabel = region === null ? 'Lurking' : activeLabels[region];
              return (
                <div key={String(region)} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    {groupLabel} ({members.length})
                  </div>
                  {members.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#2a4a2a', fontStyle: 'italic', paddingLeft: 8 }}>empty</div>
                  ) : members.map(userId => {
                    const online = connectedUsers.has(userId);
                    const regionColor = region === 'positive' ? '#4a4' : region === 'negative' ? '#a44' : region === 'neutral' ? '#66a' : '#555';
                    return (
                      <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: online ? regionColor : '#333', display: 'inline-block' }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userId}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        <button
          onClick={snapMoment}
          style={{ display: 'block', width: '100%', padding: '12px', background: '#1a7a3c', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Snap Moment
        </button>
      </div>

      {moments.length === 0 ? (
        <p style={{ color: '#666', fontSize: 13 }}>No moments captured yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {moments.map(moment => {
            const counts = { positive: 0, negative: 0, neutral: 0, lurking: 0 };
            for (const r of Object.values(moment.regions)) {
              if (r === 'positive') counts.positive++;
              else if (r === 'negative') counts.negative++;
              else if (r === 'neutral') counts.neutral++;
              else counts.lurking++;
            }
            const expanded = expandedMoments.has(moment.id);
            const isEditing = editingMomentId === moment.id;
            return (
              <div key={moment.id} style={{ border: '1px solid #333', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#1e1e1e', cursor: 'pointer' }}
                  onClick={() => toggleExpanded(moment.id)}
                >
                  <span style={{ fontSize: 10, color: '#666', width: 12, textAlign: 'center', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingMomentLabel}
                      onChange={e => setEditingMomentLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const updated = moments.map(m => m.id === moment.id ? { ...m, label: editingMomentLabel.trim() || m.label } : m);
                          setMoments(updated);
                          localStorage.setItem(`v4-moments-${room}`, JSON.stringify(updated));
                          setEditingMomentId(null);
                        } else if (e.key === 'Escape') {
                          setEditingMomentId(null);
                        }
                      }}
                      onBlur={() => setEditingMomentId(null)}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, background: '#2a2a2a', color: '#eee', border: '1px solid #555', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, color: '#ddd' }}>{moment.label}</span>
                  )}
                  <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>{new Date(moment.timestamp).toLocaleTimeString()}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingMomentId(moment.id); setEditingMomentLabel(moment.label); }}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, padding: '0 4px', flexShrink: 0 }}
                    title="Rename"
                  >✏</button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${moment.label}"?`)) {
                        const updated = moments.filter(m => m.id !== moment.id);
                        setMoments(updated);
                        localStorage.setItem(`v4-moments-${room}`, JSON.stringify(updated));
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: '#633', cursor: 'pointer', fontSize: 11, padding: '0 4px', flexShrink: 0 }}
                    title="Delete"
                  >✕</button>
                </div>
                <div style={{ display: 'flex', gap: 16, padding: '6px 30px', background: '#181818', fontSize: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: '#4c4' }}>{activeLabels.positive}: {counts.positive}</span>
                  <span style={{ color: '#c44' }}>{activeLabels.negative}: {counts.negative}</span>
                  <span style={{ color: '#88a' }}>{activeLabels.neutral}: {counts.neutral}</span>
                  {counts.lurking > 0 && <span style={{ color: '#555' }}>Lurking: {counts.lurking}</span>}
                </div>
                {expanded && (
                  <div style={{ padding: '8px 10px 12px', background: '#151515' }}>
                    {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
                      const members = Object.entries(moment.regions)
                        .filter(([, r]) => (r ?? null) === region)
                        .map(([uid]) => uid);
                      const groupLabel = region === null ? 'Lurking' : activeLabels[region];
                      return (
                        <div key={String(region)} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                            {groupLabel} ({members.length})
                          </div>
                          {members.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#444', fontStyle: 'italic', paddingLeft: 8 }}>empty</div>
                          ) : members.map(userId => {
                            const online = connectedUsers.has(userId);
                            const regionColor = region === 'positive' ? '#4a4' : region === 'negative' ? '#a44' : region === 'neutral' ? '#66a' : '#555';
                            return (
                              <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: online ? regionColor : '#333', display: 'inline-block' }} />
                                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aaa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userId}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default memo(MomentsTabInner);
