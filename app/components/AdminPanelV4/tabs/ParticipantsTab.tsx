import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { computeReactionRegion } from "../../../utils/voteRegion";
import type { ReactionAnchors, ReactionRegion } from "../../../utils/voteRegion";
import type { ReactionLabelSet } from "../../../voteLabels";
import type { MomentSnapshot, PushTarget } from "../types";
import ParticipantRow from "../ParticipantRow";

interface ParticipantsTabProps {
  connectedUsers: Set<string>;
  seenUsers: Set<string>;
  setSeenUsers: (v: Set<string>) => void;
  liveCursors: Map<string, { x: number; y: number }>;
  participantGrouping: 'none' | 'valence' | 'feedbackStars';
  setParticipantGrouping: (v: 'none' | 'valence' | 'feedbackStars') => void;
  moments: MomentSnapshot[];
  selectedMomentId: string | null;
  setSelectedMomentId: (v: string | null) => void;
  collapsedGroups: Set<string>;
  setCollapsedGroups: Dispatch<SetStateAction<Set<string>>>;
  openMenuUserId: string | null;
  setOpenMenuUserId: (v: string | null | ((prev: string | null) => string | null)) => void;
  openMenuGroupKey: string | null;
  setOpenMenuGroupKey: (v: string | null | ((prev: string | null) => string | null)) => void;
  setPushTarget: (v: PushTarget | null) => void;
  setPendingInterfaceName: (v: string) => void;
  onSendHaptic: (target: PushTarget) => void;
  onSendPopup: (target: PushTarget) => void;
  feedbackStars: Record<string, number>;
  interfaceAcceptances: { userId: string; interfaceName: string }[];
  activeLabels: ReactionLabelSet;
  activeAnchors: ReactionAnchors;
  room: string;
  selfUserId?: string;
}

function ParticipantsTabInner({
  connectedUsers, seenUsers, setSeenUsers, liveCursors,
  participantGrouping, setParticipantGrouping,
  moments, selectedMomentId, setSelectedMomentId,
  collapsedGroups, setCollapsedGroups,
  openMenuUserId, setOpenMenuUserId,
  openMenuGroupKey, setOpenMenuGroupKey,
  setPushTarget, setPendingInterfaceName, onSendHaptic, onSendPopup,
  feedbackStars,
  interfaceAcceptances, activeLabels, activeAnchors, room, selfUserId,
}: ParticipantsTabProps) {
  const offerInterface = (target: PushTarget) => {
    setPushTarget(target);
    setPendingInterfaceName('social');
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ color: '#aaa', fontSize: 13 }}>Group by:</label>
        <select
          value={participantGrouping}
          onChange={e => setParticipantGrouping(e.target.value as 'none' | 'valence' | 'feedbackStars')}
          style={{ background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 8px', borderRadius: 4 }}
        >
          <option value="valence">Valence</option>
          <option value="feedbackStars">Feedback Stars</option>
          <option value="none">None</option>
        </select>
        {participantGrouping === 'valence' && moments.length > 0 && (
          <select
            value={selectedMomentId ?? ''}
            onChange={e => setSelectedMomentId(e.target.value || null)}
            style={{ background: '#222', color: '#eee', border: '1px solid #555', padding: '4px 8px', borderRadius: 4 }}
          >
            <option value="">Now</option>
            {moments.map(m => (
              <option key={m.id} value={m.id}>{m.label} ({new Date(m.timestamp).toLocaleTimeString()})</option>
            ))}
          </select>
        )}
      </div>

      {seenUsers.size === 0 ? (
        <p style={{ color: '#666', fontSize: 13 }}>No participants seen yet.</p>
      ) : participantGrouping === 'none' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...seenUsers].map(userId => {
            const online = connectedUsers.has(userId);
            const cursor = liveCursors.get(userId);
            const region = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null;
            return (
              <ParticipantRow
                key={userId}
                userId={userId}
                region={region}
                labels={activeLabels}
                online={online}
                isSelf={userId === selfUserId}
                isMenuOpen={openMenuUserId === userId}
                onMenuToggle={() => setOpenMenuUserId(prev => prev === userId ? null : userId)}
                onOfferInterface={() => { setOpenMenuUserId(null); offerInterface({ kind: 'user', userId }); }}
                onSendHaptic={() => { setOpenMenuUserId(null); onSendHaptic({ kind: 'user', userId }); }}
                onSendPopup={() => { setOpenMenuUserId(null); onSendPopup({ kind: 'user', userId }); }}
              />
            );
          })}
        </div>
      ) : participantGrouping === 'feedbackStars' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[5, 4, 3, 2, 1, 0, -1].map(stars => {
            const groupKey = `feedback-${stars}`;
            const groupLabel = stars === -1 ? 'No response' : '★'.repeat(stars) + '☆'.repeat(5 - stars);
            const members = [...seenUsers].filter(userId =>
              stars === -1 ? feedbackStars[userId] === undefined : feedbackStars[userId] === stars
            );
            const collapsed = collapsedGroups.has(groupKey);
            return (
              <div key={groupKey}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 6, paddingRight: 10 }}>
                  <button onClick={() => toggleGroupCollapse(groupKey)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0 }}>
                    {collapsed ? '▶' : '▼'}
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.08em', flex: 1, cursor: 'pointer' }} onClick={() => toggleGroupCollapse(groupKey)}>
                    {groupLabel} ({members.length})
                  </span>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpenMenuGroupKey(prev => prev === groupKey ? null : groupKey)}
                      style={{ fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'pointer' }}
                    >
                      ···
                    </button>
                    {openMenuGroupKey === groupKey && (
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#252525', border: '1px solid #444', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 160 }}>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => { setOpenMenuGroupKey(null); offerInterface({ kind: 'users', userIds: members, label: groupLabel }); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                        >
                          Offer interface…
                        </button>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => { setOpenMenuGroupKey(null); onSendHaptic({ kind: 'users', userIds: members, label: groupLabel }); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                        >
                          Send buzz…
                        </button>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => { setOpenMenuGroupKey(null); onSendPopup({ kind: 'users', userIds: members, label: groupLabel }); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                        >
                          Send popup…
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {!collapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {members.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                        <span style={{ width: 8, height: 8, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', fontStyle: 'italic', flex: 1 }}>empty</span>
                      </div>
                    ) : members.map(userId => {
                      const online = connectedUsers.has(userId);
                      const cursor = liveCursors.get(userId);
                      const region = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchors) : null;
                      return (
                        <ParticipantRow
                          key={userId}
                          userId={userId}
                          region={region}
                          labels={activeLabels}
                          online={online}
                          isSelf={userId === selfUserId}
                          isMenuOpen={openMenuUserId === userId}
                          onMenuToggle={() => setOpenMenuUserId(prev => prev === userId ? null : userId)}
                          onOfferInterface={() => { setOpenMenuUserId(null); offerInterface({ kind: 'user', userId }); }}
                          onSendHaptic={() => { setOpenMenuUserId(null); onSendHaptic({ kind: 'user', userId }); }}
                          onSendPopup={() => { setOpenMenuUserId(null); onSendPopup({ kind: 'user', userId }); }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : selectedMomentId !== null ? (
        (() => {
          const chosenMoment = moments.find(m => m.id === selectedMomentId);
          if (!chosenMoment) return <p style={{ color: '#666', fontSize: 13 }}>Select a moment above to group participants.</p>;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
                const groupKey = `moment-${String(region)}`;
                const members = [...seenUsers].filter(userId => (chosenMoment.regions[userId] ?? null) === region);
                const groupLabel = region === null ? 'Lurking' : activeLabels[region];
                const collapsed = collapsedGroups.has(groupKey);
                return (
                  <div key={groupKey}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 6, paddingRight: 10 }}>
                      <button onClick={() => toggleGroupCollapse(groupKey)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0 }}>
                        {collapsed ? '▶' : '▼'}
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, cursor: 'pointer' }} onClick={() => toggleGroupCollapse(groupKey)}>
                        {groupLabel} ({members.length})
                      </span>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setOpenMenuGroupKey(prev => prev === groupKey ? null : groupKey)}
                          style={{ fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'pointer' }}
                        >
                          ···
                        </button>
                        {openMenuGroupKey === groupKey && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#252525', border: '1px solid #444', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 160 }}>
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onClick={() => { setOpenMenuGroupKey(null); offerInterface({ kind: 'users', userIds: members, label: groupLabel }); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                            >
                              Offer interface…
                            </button>
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onClick={() => { setOpenMenuGroupKey(null); onSendHaptic({ kind: 'users', userIds: members, label: groupLabel }); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                            >
                              Send buzz…
                            </button>
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onClick={() => { setOpenMenuGroupKey(null); onSendPopup({ kind: 'users', userIds: members, label: groupLabel }); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                            >
                              Send popup…
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {!collapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {members.length === 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                            <span style={{ width: 8, height: 8, flexShrink: 0 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', fontStyle: 'italic', flex: 1 }}>empty</span>
                          </div>
                        ) : members.map(userId => {
                          const online = connectedUsers.has(userId);
                          return (
                            <ParticipantRow
                              key={userId}
                              userId={userId}
                              region={region}
                              labels={activeLabels}
                              online={online}
                              isSelf={userId === selfUserId}
                              isMenuOpen={openMenuUserId === userId}
                              onMenuToggle={() => setOpenMenuUserId(prev => prev === userId ? null : userId)}
                              onOfferInterface={() => { setOpenMenuUserId(null); offerInterface({ kind: 'user', userId }); }}
                              onSendHaptic={() => { setOpenMenuUserId(null); onSendHaptic({ kind: 'user', userId }); }}
                              onSendPopup={() => { setOpenMenuUserId(null); onSendPopup({ kind: 'user', userId }); }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(['positive', 'negative', 'neutral', null] as (ReactionRegion | null)[]).map(region => {
            const groupKey = String(region);
            const members = [...connectedUsers].filter(userId => {
              const cursor = liveCursors.get(userId);
              if (!cursor) return region === null;
              return computeReactionRegion(cursor.x, cursor.y, activeAnchors) === region;
            });
            const offlineMembers = [...seenUsers].filter(userId => !connectedUsers.has(userId));
            const groupLabel = region === null ? 'Lurking' : activeLabels[region];
            const collapsed = collapsedGroups.has(groupKey);
            return (
              <div key={groupKey}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: collapsed ? 0 : 6, paddingRight: 10 }}>
                  <button onClick={() => toggleGroupCollapse(groupKey)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0 }}>
                    {collapsed ? '▶' : '▼'}
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, cursor: 'pointer' }} onClick={() => toggleGroupCollapse(groupKey)}>
                    {groupLabel} ({members.length}{region === null && offlineMembers.length > 0 ? ` + ${offlineMembers.length} offline` : ''})
                  </span>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpenMenuGroupKey(prev => prev === groupKey ? null : groupKey)}
                      style={{ fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'pointer' }}
                    >
                      ···
                    </button>
                    {openMenuGroupKey === groupKey && (
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2, background: '#252525', border: '1px solid #444', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 160 }}>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => { setOpenMenuGroupKey(null); offerInterface({ kind: 'users', userIds: members, label: groupLabel }); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                        >
                          Offer interface…
                        </button>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => { setOpenMenuGroupKey(null); onSendHaptic({ kind: 'users', userIds: members, label: groupLabel }); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                        >
                          Send buzz…
                        </button>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => { setOpenMenuGroupKey(null); onSendPopup({ kind: 'users', userIds: members, label: groupLabel }); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: '#ddd', fontSize: 13, cursor: 'pointer' }}
                        >
                          Send popup…
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {!collapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {members.length === 0 && (region !== null || offlineMembers.length === 0) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                        <span style={{ width: 8, height: 8, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', fontStyle: 'italic', flex: 1 }}>empty</span>
                        <button disabled style={{ opacity: 0, fontSize: 11, padding: '2px 8px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, cursor: 'not-allowed' }}>···</button>
                      </div>
                    ) : null}
                    {members.map(userId => (
                      <ParticipantRow
                        key={userId}
                        userId={userId}
                        region={region}
                        labels={activeLabels}
                        online={true}
                        isSelf={userId === selfUserId}
                        isMenuOpen={openMenuUserId === userId}
                        onMenuToggle={() => setOpenMenuUserId(prev => prev === userId ? null : userId)}
                        onOfferInterface={() => { setOpenMenuUserId(null); offerInterface({ kind: 'user', userId }); }}
                        onSendHaptic={() => { setOpenMenuUserId(null); onSendHaptic({ kind: 'user', userId }); }}
                        onSendPopup={() => { setOpenMenuUserId(null); onSendPopup({ kind: 'user', userId }); }}
                      />
                    ))}
                    {region === null && offlineMembers.map(userId => (
                      <ParticipantRow key={userId} userId={userId} region={null} labels={activeLabels} online={false} isSelf={userId === selfUserId} isMenuOpen={false} onMenuToggle={() => {}} onOfferInterface={() => {}} onSendHaptic={() => {}} onSendPopup={() => {}} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {seenUsers.size > 0 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              localStorage.removeItem(`v4-seen-users-${room}`);
              setSeenUsers(new Set());
            }}
            style={{ fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
          >
            Clear history
          </button>
        </div>
      )}

      {interfaceAcceptances.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #333', paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Acceptances</div>
          {interfaceAcceptances.map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: '#6c6', fontFamily: 'monospace', padding: '2px 0' }}>
              ✓ {a.userId} accepted "{a.interfaceName}"
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ParticipantsTabInner);
