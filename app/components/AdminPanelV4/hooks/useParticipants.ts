import { useState, useRef, useEffect } from "react";
import { generateUUID } from "../../../utils/userId";
import { computeReactionRegion } from "../../../utils/voteRegion";
import type { ReactionAnchors } from "../../../utils/voteRegion";
import type { MomentSnapshot, PushTarget } from "../types";
import type PartySocket from "partysocket";

export function useParticipants(socket: PartySocket, room: string, activeAnchors: ReactionAnchors) {
  const [connectedUsers, setConnectedUsers]   = useState<Set<string>>(new Set());
  const [seenUsers, setSeenUsers]             = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`v4-seen-users-${room}`) ?? '[]');
      return new Set(Array.isArray(stored) ? stored : []);
    } catch { return new Set(); }
  });
  const [liveCursors, setLiveCursors]         = useState<Map<string, { x: number; y: number }>>(new Map());
  const [participantGrouping, setParticipantGrouping] = useState<'none' | 'valence' | 'feedbackStars'>('valence');
  const [moments, setMoments]                 = useState<MomentSnapshot[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`v4-moments-${room}`) ?? '[]');
    } catch { return []; }
  });
  const [momentLabelInput, setMomentLabelInput]   = useState('');
  const [expandedMoments, setExpandedMoments]     = useState<Set<string>>(new Set());
  const [editingMomentId, setEditingMomentId]     = useState<string | null>(null);
  const [editingMomentLabel, setEditingMomentLabel] = useState('');
  const [selectedMomentId, setSelectedMomentId]   = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups]     = useState<Set<string>>(new Set());
  const [pushTarget, setPushTarget]               = useState<PushTarget | null>(null);
  const [pendingInterfaceName, setPendingInterfaceName] = useState('social');
  const [interfaceAcceptances, setInterfaceAcceptances] = useState<{ userId: string; interfaceName: string }[]>([]);
  const [openMenuUserId, setOpenMenuUserId]       = useState<string | null>(null);
  const [openMenuGroupKey, setOpenMenuGroupKey]   = useState<string | null>(null);
  const [feedbackStars, setFeedbackStars]         = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`v4-feedback-stars-${room}`) ?? '{}');
    } catch { return {}; }
  });

  const staleTimersRef    = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activeAnchorsRef  = useRef<ReactionAnchors>(activeAnchors);
  activeAnchorsRef.current = activeAnchors;

  useEffect(() => {
    if (!openMenuUserId && !openMenuGroupKey) return;
    const handler = () => { setOpenMenuUserId(null); setOpenMenuGroupKey(null); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [openMenuUserId, openMenuGroupKey]);

  const addSeenUser = (userId: string) => {
    setSeenUsers(prev => {
      if (prev.has(userId)) return prev;
      const next = new Set([...prev, userId]);
      localStorage.setItem(`v4-seen-users-${room}`, JSON.stringify([...next]));
      return next;
    });
  };

  const snapMoment = () => {
    const regions: Record<string, 'positive' | 'negative' | 'neutral' | null> = {};
    for (const userId of seenUsers) {
      const cursor = liveCursors.get(userId);
      regions[userId] = cursor ? computeReactionRegion(cursor.x, cursor.y, activeAnchorsRef.current) : null;
    }
    const newMoment: MomentSnapshot = {
      id: generateUUID(),
      label: momentLabelInput.trim() || `Moment ${moments.length + 1}`,
      timestamp: Date.now(),
      regions,
    };
    const updated = [newMoment, ...moments];
    setMoments(updated);
    localStorage.setItem(`v4-moments-${room}`, JSON.stringify(updated));
    setMomentLabelInput('');
    setEditingMomentId(null);
  };

  const applyConnected = (data: Record<string, unknown>) => {
    if (Array.isArray(data.connectedUserIds) && (data.connectedUserIds as string[]).length > 0) {
      const ids = data.connectedUserIds as string[];
      setConnectedUsers(prev => new Set([...prev, ...ids]));
      setSeenUsers(prev => {
        const next = new Set([...prev, ...ids]);
        localStorage.setItem(`v4-seen-users-${room}`, JSON.stringify([...next]));
        return next;
      });
    }
  };

  const handleSocketEvent = (data: Record<string, unknown>) => {
    if (data.type === 'feedbackStarsSubmitted') {
      const userId = data.userId as string;
      const stars = data.stars as number;
      setFeedbackStars(prev => {
        const next = { ...prev, [userId]: stars };
        localStorage.setItem(`v4-feedback-stars-${room}`, JSON.stringify(next));
        return next;
      });
      return;
    }

    if (data.type === 'interfaceAccepted') {
      setInterfaceAcceptances(prev => [...prev, { userId: data.userId as string, interfaceName: data.interfaceName as string }]);
      return;
    }

    if (data.type === 'userJoined' || data.type === 'userLeft') {
      if (data.type === 'userJoined') {
        setConnectedUsers(prev => new Set([...prev, data.userId as string]));
        addSeenUser(data.userId as string);
      } else {
        setConnectedUsers(prev => { const s = new Set(prev); s.delete(data.userId as string); return s; });
        setLiveCursors(prev => { const m = new Map(prev); m.delete(data.userId as string); return m; });
        clearTimeout(staleTimersRef.current.get(data.userId as string));
        staleTimersRef.current.delete(data.userId as string);
      }
    }

    if (data.type === 'move' || data.type === 'touch') {
      const { userId: cursorUserId, x: cx, y: cy } = data.position as { userId: string; x: number; y: number };
      setConnectedUsers(prev => new Set([...prev, cursorUserId]));
      addSeenUser(cursorUserId);
      setLiveCursors(prev => new Map(prev).set(cursorUserId, { x: cx, y: cy }));
      clearTimeout(staleTimersRef.current.get(cursorUserId));
      staleTimersRef.current.set(cursorUserId, setTimeout(() => {
        setLiveCursors(prev => { const m = new Map(prev); m.delete(cursorUserId); return m; });
        staleTimersRef.current.delete(cursorUserId);
      }, 3000));
    }

    if (data.type === 'remove') {
      const { userId: removedId } = data.position as { userId: string };
      setLiveCursors(prev => { const m = new Map(prev); m.delete(removedId); return m; });
      clearTimeout(staleTimersRef.current.get(removedId));
      staleTimersRef.current.delete(removedId);
    }
  };

  return {
    connectedUsers,
    seenUsers, setSeenUsers,
    liveCursors,
    participantGrouping, setParticipantGrouping,
    moments, setMoments,
    momentLabelInput, setMomentLabelInput,
    expandedMoments, setExpandedMoments,
    editingMomentId, setEditingMomentId,
    editingMomentLabel, setEditingMomentLabel,
    selectedMomentId, setSelectedMomentId,
    collapsedGroups, setCollapsedGroups,
    pushTarget, setPushTarget,
    pendingInterfaceName, setPendingInterfaceName,
    interfaceAcceptances,
    openMenuUserId, setOpenMenuUserId,
    openMenuGroupKey, setOpenMenuGroupKey,
    feedbackStars,
    snapMoment,
    applyConnected,
    handleSocketEvent,
  };
}
