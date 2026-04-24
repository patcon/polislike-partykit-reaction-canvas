import { useState, useEffect, useRef } from "react";
import usePartySocket from "partysocket/react";
import ImageConfigModal from "../ImageConfigModal";
import SocialConfigModal from "../SocialConfigModal";
import { useAnchors } from "./hooks/useAnchors";
import { useLabels } from "./hooks/useLabels";
import { useRoomConfig } from "./hooks/useRoomConfig";
import { useRecording } from "./hooks/useRecording";
import { usePlayback } from "./hooks/usePlayback";
import { useParticipants } from "./hooks/useParticipants";
import OfferInterfaceModal from "./OfferInterfaceModal";
import HapticConfirmModal from "./HapticConfirmModal";
import SendPopupModal from "./SendPopupModal";
import RecordTab from "./tabs/RecordTab";
import LabelsTab from "./tabs/LabelsTab";
import AnchorsTab from "./tabs/AnchorsTab";
import AvatarsTab from "./tabs/AvatarsTab";
import InterfacesTab from "./tabs/InterfacesTab";
import EventsTab from "./tabs/EventsTab";
import ParticipantsTab from "./tabs/ParticipantsTab";
import MomentsTab from "./tabs/MomentsTab";
import type { AdminTab, GithubSubmission, PushTarget } from "./types";
import type { ReactionAnchors } from "../../utils/voteRegion";
import type { ReactionLabelSet } from "../../voteLabels";

const ALL_TABS: AdminTab[] = ['record', 'labels', 'anchors', 'avatars', 'interfaces', 'events', 'participants', 'moments'];

interface AdminPanelV4Props {
  room: string;
  selfUserId?: string;
}

export default function AdminPanelV4({ room, selfUserId }: AdminPanelV4Props) {
  const tabStorageKey = `v4-admin-tab-${room}`;
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const saved = localStorage.getItem(tabStorageKey);
    return (ALL_TABS as string[]).includes(saved ?? '') ? (saved as AdminTab) : 'record';
  });
  const switchTab = (tab: AdminTab) => { setActiveTab(tab); localStorage.setItem(tabStorageKey, tab); };
  const [presenceCount, setPresenceCount]     = useState<number>(0);
  const [githubSubmissions, setGithubSubmissions] = useState<GithubSubmission[]>([]);
  const [pendingHapticTarget, setPendingHapticTarget] = useState<PushTarget | null>(null);
  const [pendingPopupTarget, setPendingPopupTarget]   = useState<PushTarget | null>(null);

  // Mic state for Moments tab voice annotation
  type MicState = 'idle' | 'requesting' | 'ready' | 'recording' | 'error';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognitionCtor: (new () => any) | null = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
  const [micState, setMicState] = useState<MicState>(SpeechRecognitionCtor ? 'idle' : 'error');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const micRecognitionRef = useRef<any>(null);
  // Stable ref so onresult always calls the latest setter without recreating the recognition instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMicResultRef = useRef<(e: any) => void>(() => {});
  onMicResultRef.current = (e: any) => participants.setMomentLabelInput(e.results[0][0].transcript); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const r = new SpeechRecognitionCtor();
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => onMicResultRef.current(e); // eslint-disable-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setMicState('error');
      else setMicState('ready');
    };
    r.onend = () => setMicState(s => s === 'error' ? 'error' : 'ready');
    micRecognitionRef.current = r;
    // Skip "Enable mic" step if permission was already granted in a prior session
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(s => { if (s.state === 'granted') setMicState('ready'); })
      .catch(() => {});
    return () => { try { r.abort(); } catch {} };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // getUserMedia + immediate track stop: requests permission without holding the mic stream open
  const requestMicAccess = () => {
    setMicState('requesting');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); setMicState('ready'); })
      .catch(() => setMicState('error'));
  };
  const startMicRecording = () => {
    try { micRecognitionRef.current?.start(); setMicState('recording'); } catch {}
  };
  const stopMicRecording = () => { try { micRecognitionRef.current?.stop(); } catch {} };

  // Ref-based dispatch so all hooks see the same handler regardless of creation order
  const dispatchRef = useRef<(data: Record<string, unknown>) => void>(() => {});

  const socket = usePartySocket({
    host: window.location.port === '1999' ? `${window.location.hostname}:1999` : window.location.hostname,
    room,
    query: { isAdmin: 'true' },
    onMessage(evt) {
      try {
        dispatchRef.current(JSON.parse(evt.data));
      } catch (e) {
        console.error('AdminPanelV4: failed to parse message', e);
      }
    },
  });

  const anchors      = useAnchors(socket);
  const labels       = useLabels(socket);
  const roomConfig   = useRoomConfig(socket);
  const recording    = useRecording(socket, room);
  const playback     = usePlayback(socket, anchors.activeAnchors);
  const participants = useParticipants(socket, room, anchors.activeAnchors);

  // Keep dispatch ref fresh on every render so handlers always see the latest state
  dispatchRef.current = (data) => {
    if (data.type === 'presenceCount') {
      setPresenceCount(data.count as number);
      return;
    }
    if (data.type === 'connected') {
      if (data.recordingState !== undefined) recording.setServerRecording(data.recordingState as boolean);
      if ('roomLabels' in data) labels.applyServerLabels(data.roomLabels as ReactionLabelSet | null);
      if ('roomAnchors' in data) anchors.applyServerAnchors(data.roomAnchors as ReactionAnchors | null);
      roomConfig.applyConnected(data);
      participants.applyConnected(data);
      return;
    }
    if (data.type === 'githubUsernameSubmitted') {
      setGithubSubmissions(prev => [...prev, {
        username: data.username as string,
        displayName: (data.displayName as string | null) ?? null,
        avatarUrl: (data.avatarUrl as string | null) ?? null,
        timestamp: data.timestamp as number,
      }]);
      return;
    }
    labels.handleSocketEvent(data);
    anchors.handleSocketEvent(data);
    roomConfig.handleSocketEvent(data);
    recording.handleSocketEvent(data);
    participants.handleSocketEvent(data);
  };

  const tabLabel = (tab: AdminTab): string => {
    if (tab === 'events') return githubSubmissions.length > 0 ? `Events (${githubSubmissions.length})` : 'Events';
    if (tab === 'participants') return participants.connectedUsers.size > 0 ? `People (${participants.connectedUsers.size})` : 'People';
    if (tab === 'moments') return participants.moments.length > 0 ? `Moments (${participants.moments.length})` : 'Moments';
    if (tab === 'interfaces') return 'Interface';
    if (tab === 'record') return 'Record';
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  const downloadGithubSubmissions = () => {
    const blob = new Blob([JSON.stringify(githubSubmissions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-submissions-${room}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="v3-admin-panel"
      style={{ padding: 0, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* === PERSISTENT HEADER === */}
      <div style={{ flexShrink: 0, borderBottom: '2px solid #444' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#eee', flexShrink: 0 }}>V4 Admin</span>
            <span style={{ color: '#555', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {room}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
            {recording.isRecording && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f55', letterSpacing: '0.05em' }}>● REC</span>
            )}
            {participants.connectedUsers.size > 0 && (
              <span style={{ fontSize: 12, color: '#666' }}>{participants.connectedUsers.size} online</span>
            )}
          </div>
        </div>

        <div className="admin-v4-tab-bar" style={{ display: 'flex', overflowX: 'auto' }}>
          {ALL_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              style={{
                padding: '8px 16px',
                background: activeTab === tab ? '#333' : 'transparent',
                color: activeTab === tab ? '#eee' : '#888',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #aaa' : '2px solid transparent',
                marginBottom: -2,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      {/* === TAB CONTENT === */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 16px' }}>
        {activeTab === 'record' && (
          <RecordTab
            userCap={roomConfig.userCap}
            capInput={roomConfig.capInput}
            setCapInput={roomConfig.setCapInput}
            presenceCount={presenceCount}
            sendUserCap={roomConfig.sendUserCap}
            onRemoveCap={() => { roomConfig.setCapInput(''); socket.send(JSON.stringify({ type: 'setUserCap', cap: null })); }}
            isRecording={recording.isRecording}
            serverRecording={recording.serverRecording}
            mode={recording.mode}
            eventCount={recording.eventCount}
            displayEvents={recording.displayEvents}
            MAX_TABLE_ROWS={recording.MAX_TABLE_ROWS}
            startRecording={recording.startRecording}
            stopRecording={recording.stopRecording}
            downloadEvents={recording.downloadEvents}
            clearEvents={recording.clearEvents}
            handleModeChange={recording.handleModeChange}
            playbackData={playback.playbackData}
            isPlaying={playback.isPlaying}
            isPaused={playback.isPaused}
            playbackElapsed={playback.playbackElapsed}
            sortedEventsRef={playback.sortedEventsRef}
            handlePlaybackFile={playback.handlePlaybackFile}
            playPlayback={playback.playPlayback}
            pausePlayback={playback.pausePlayback}
            stopPlayback={playback.stopPlayback}
            seekPlayback={playback.seekPlayback}
          />
        )}
        {activeTab === 'labels' && (
          <LabelsTab
            labelSelected={labels.labelSelected}
            setLabelSelected={labels.setLabelSelected}
            customPositive={labels.customPositive}
            setCustomPositive={labels.setCustomPositive}
            customNegative={labels.customNegative}
            setCustomNegative={labels.setCustomNegative}
            customNeutral={labels.customNeutral}
            setCustomNeutral={labels.setCustomNeutral}
            customHistory={labels.customHistory}
            setCustomHistory={labels.setCustomHistory}
            selectPreset={labels.selectPreset}
            sendLabels={labels.sendLabels}
          />
        )}
        {activeTab === 'anchors' && (
          <AnchorsTab
            positiveX={anchors.positiveX} setPositiveX={anchors.setPositiveX}
            positiveY={anchors.positiveY} setPositiveY={anchors.setPositiveY}
            negativeX={anchors.negativeX} setNegativeX={anchors.setNegativeX}
            negativeY={anchors.negativeY} setNegativeY={anchors.setNegativeY}
            neutralX={anchors.neutralX}   setNeutralX={anchors.setNeutralX}
            neutralY={anchors.neutralY}   setNeutralY={anchors.setNeutralY}
            sendAnchors={anchors.sendAnchors}
            resetAnchors={anchors.resetAnchors}
          />
        )}
        {activeTab === 'avatars' && (
          <AvatarsTab
            avatarStyle={roomConfig.avatarStyle}
            sendAvatarStyle={roomConfig.sendAvatarStyle}
          />
        )}
        {activeTab === 'interfaces' && (
          <InterfacesTab
            activity={roomConfig.activity}
            soccerScore={roomConfig.soccerScore}
            sendActivity={roomConfig.sendActivity}
            resetSoccerScore={roomConfig.resetSoccerScore}
            setImageConfigOpen={roomConfig.setImageConfigOpen}
            setSocialConfigOpen={roomConfig.setSocialConfigOpen}
            onClearRoleAssignments={() => socket.send(JSON.stringify({ type: 'clearPushedInterfaces' }))}
          />
        )}
        {activeTab === 'events' && (
          <EventsTab
            githubSubmissions={githubSubmissions}
            setGithubSubmissions={setGithubSubmissions}
            downloadGithubSubmissions={downloadGithubSubmissions}
          />
        )}
        {activeTab === 'participants' && (
          <ParticipantsTab
            connectedUsers={participants.connectedUsers}
            seenUsers={participants.seenUsers}
            setSeenUsers={participants.setSeenUsers}
            liveCursors={participants.liveCursors}
            participantGrouping={participants.participantGrouping}
            setParticipantGrouping={participants.setParticipantGrouping}
            moments={participants.moments}
            selectedMomentId={participants.selectedMomentId}
            setSelectedMomentId={participants.setSelectedMomentId}
            collapsedGroups={participants.collapsedGroups}
            setCollapsedGroups={participants.setCollapsedGroups}
            openMenuUserId={participants.openMenuUserId}
            setOpenMenuUserId={participants.setOpenMenuUserId}
            openMenuGroupKey={participants.openMenuGroupKey}
            setOpenMenuGroupKey={participants.setOpenMenuGroupKey}
            setPushTarget={participants.setPushTarget}
            setPendingInterfaceName={participants.setPendingInterfaceName}
            onSendHaptic={setPendingHapticTarget}
            onSendPopup={setPendingPopupTarget}
            feedbackStars={participants.feedbackStars}
            setFeedbackStars={participants.setFeedbackStars}
            interfaceAcceptances={participants.interfaceAcceptances}
            activeLabels={labels.activeLabels}
            activeAnchors={anchors.activeAnchors}
            room={room}
            selfUserId={selfUserId}
          />
        )}
        {activeTab === 'moments' && (
          <MomentsTab
            moments={participants.moments}
            setMoments={participants.setMoments}
            seenUsers={participants.seenUsers}
            connectedUsers={participants.connectedUsers}
            liveCursors={participants.liveCursors}
            momentLabelInput={participants.momentLabelInput}
            setMomentLabelInput={participants.setMomentLabelInput}
            expandedMoments={participants.expandedMoments}
            setExpandedMoments={participants.setExpandedMoments}
            editingMomentId={participants.editingMomentId}
            setEditingMomentId={participants.setEditingMomentId}
            editingMomentLabel={participants.editingMomentLabel}
            setEditingMomentLabel={participants.setEditingMomentLabel}
            snapMoment={participants.snapMoment}
            activeLabels={labels.activeLabels}
            activeAnchors={anchors.activeAnchors}
            room={room}
          />
        )}
      </div>

      {/* === MOMENTS MIC BUTTON === */}
      {activeTab === 'moments' && (
        <div style={{ flexShrink: 0, borderTop: '1px solid #222', padding: '8px 16px calc(8px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            disabled={micState === 'requesting' || micState === 'error'}
            onClick={micState === 'idle' ? requestMicAccess : undefined}
            onPointerDown={micState === 'ready' ? startMicRecording : undefined}
            onPointerUp={micState === 'recording' ? stopMicRecording : undefined}
            onPointerLeave={micState === 'recording' ? stopMicRecording : undefined}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 8,
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: micState === 'requesting' || micState === 'error' ? 'not-allowed' : 'pointer',
              background: micState === 'recording' ? '#7a1a1a' : micState === 'ready' ? '#1a3a1a' : '#222',
              color: micState === 'error' ? '#666' : micState === 'recording' ? '#faa' : micState === 'ready' ? '#4c4' : '#aaa',
              transition: 'background 0.15s',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {micState === 'idle' && '🎤 Enable mic'}
            {micState === 'requesting' && 'Requesting mic…'}
            {micState === 'ready' && '🎤 Hold to speak'}
            {micState === 'recording' && '● Release to set label'}
            {micState === 'error' && '🎤 Mic unavailable'}
          </button>
          <span style={{ fontSize: 11, color: '#555', textAlign: 'center', visibility: micState === 'error' ? 'visible' : 'hidden' }}>
            {SpeechRecognitionCtor ? 'Check browser mic permissions' : 'Speech recognition not supported in this browser'}
          </span>
        </div>
      )}

      {/* === MODALS === */}
      {pendingHapticTarget && (
        <HapticConfirmModal
          pushTarget={pendingHapticTarget}
          activeLabels={labels.activeLabels}
          onSend={() => {
            const msg: Record<string, unknown> = { type: 'pushHaptic' };
            if (pendingHapticTarget.kind === 'user') msg.targetUserId = pendingHapticTarget.userId;
            else if (pendingHapticTarget.kind === 'users') msg.targetUserIds = pendingHapticTarget.userIds;
            else if (pendingHapticTarget.kind === 'region') msg.targetRegion = pendingHapticTarget.region;
            socket.send(JSON.stringify(msg));
            setPendingHapticTarget(null);
          }}
          onClose={() => setPendingHapticTarget(null)}
        />
      )}
      {participants.pushTarget && (
        <OfferInterfaceModal
          pushTarget={participants.pushTarget}
          pendingInterfaceName={participants.pendingInterfaceName}
          setPendingInterfaceName={participants.setPendingInterfaceName}
          activeLabels={labels.activeLabels}
          onSend={msg => socket.send(JSON.stringify(msg))}
          onClose={() => { participants.setPushTarget(null); participants.setPendingInterfaceName('social'); }}
        />
      )}
      {pendingPopupTarget && (
        <SendPopupModal
          pushTarget={pendingPopupTarget}
          activeLabels={labels.activeLabels}
          onSend={(activityName) => {
            const msg: Record<string, unknown> = { type: 'triggerActivity', activityName };
            if (pendingPopupTarget.kind === 'user') msg.targetUserId = pendingPopupTarget.userId;
            else if (pendingPopupTarget.kind === 'users') msg.targetUserIds = pendingPopupTarget.userIds;
            else if (pendingPopupTarget.kind === 'region') msg.targetRegion = pendingPopupTarget.region;
            socket.send(JSON.stringify(msg));
            setPendingPopupTarget(null);
          }}
          onClose={() => setPendingPopupTarget(null)}
        />
      )}
      {roomConfig.imageConfigOpen && (
        <ImageConfigModal
          currentUrl={roomConfig.roomImageUrl}
          onSubmit={roomConfig.sendImageUrl}
          onClose={() => roomConfig.setImageConfigOpen(false)}
        />
      )}
      {roomConfig.socialConfigOpen && (
        <SocialConfigModal
          current={roomConfig.roomSocialConfig}
          onSubmit={roomConfig.sendSocialConfig}
          onClose={() => roomConfig.setSocialConfigOpen(false)}
        />
      )}
    </div>
  );
}
