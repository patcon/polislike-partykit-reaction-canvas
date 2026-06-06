import type * as Party from "partykit/server";
import type { ActivityMode, StoryTracerPoint, StoryTracerMeta, MapProjection } from "../app/types";
import { computeReactionRegion, DEFAULT_ANCHORS as REACTION_DEFAULT_ANCHORS } from './lib/reactionRegion';
import type { ReactionAnchors } from './lib/reactionRegion';
import { getCurrentActiveStatementId, computeNextDisplayTimestamp, computeClearedQueue } from './lib/queueLogic';
import type { QueueItem } from './lib/queueLogic';
import { GhostCursorManager } from './lib/ghostCursors';
import { PLUGIN_MAP } from '../plugins/index';
import type { PluginContext } from '../plugins/types';
import { getSoccerBallState, getSoccerScore } from '../plugins/soccer/server';
import type {
  CursorEvent, PolisStatement, Vote, PersistedState, ClientEvent,
  PlaybackCursorBroadcastEvent, StatementEvent, UpdateStatementsPoolEvent,
  SetTimecodeEvent, SetRecordingStateEvent, SetRoomLabelsEvent, SetRoomAnchorsEvent,
  SetRoomAvatarStyleEvent, SetActivityEvent, SetNowLabelEvent, SetImageUrlEvent,
  SetUserCapEvent, TriggerActivityEvent, SubmitGithubUsernameEvent, SubmitFeedbackStarsEvent,
  SetSocialConfigEvent, SetGreeterConfigEvent, PushInterfaceEvent, AcceptInterfaceEvent,
  PushHapticEvent, RegisterCustomAvatarEvent, SetColorCursorsByVoteEvent,
  SetDefaultCursorColorEvent, SetOwnValenceDisplayEvent, SetValenceInputModeEvent,
  RecordInvitationsEvent, StenoStartRecordingEvent, StenoStopRecordingEvent,
  StenoAppendTextEvent, StenoSetTextEvent, StoryTracerSetPointsEvent, MapProjectionSetEvent,
  WebRTCOfferEvent, WebRTCAnswerEvent, WebRTCIceEvent, HangUpCallEvent,
  SetCallAlgorithmEvent, SetArrivalCapacityEvent, NeighborEdgeEvent, SetLightColorEvent,
} from './types';

export default class Server implements Party.Server {
  private activeStatementId: number = 1;
  private allSelectedStatements: QueueItem[] = [];
  private statementsPool: PolisStatement[] = [];
  private votes: Vote[] = [];
  private connectionUserMap = new Map<string, string>(); // connectionId -> userId
  private adminConnectionIds = new Set<string>();
  private viewerConnectionIds = new Set<string>();
  private userCap: number | null = null;
  private savedTimecode: number = 0;
  private recordingState: boolean = false;
  private roomLabels: { positive: string; negative: string; neutral: string } | null = { positive: 'Agree', negative: 'Disagree', neutral: 'Pass' };
  private roomAnchors: ReactionAnchors | null = null;
  private roomAvatarStyle: string | null = null;
  private currentActivity: ActivityMode = 'canvas';
  private roomImageUrl: string = '';
  private nowLabel: string = '';
  private roomSocialConfig: { default: string; twitter: string; bluesky: string; mastodon: string } | null = null;
  private msgCount = 0;
  private msgRateInterval?: NodeJS.Timeout;
  private githubSubmissions: { username: string; displayName: string | null; avatarUrl: string | null; timestamp: number }[] = [];
  private cursorPositions = new Map<string, { x: number; y: number }>();
  private inviteEdges = new Map<string, string>(); // inviteeId -> inviterId
  private customAvatars = new Map<string, string>(); // userId -> photoUrl
  private colorCursorsByVote: boolean = false;
  private defaultCursorColor: string = '#d4d4d4';
  private ownValenceDisplay: 'background' | 'labels' | 'none' = 'labels';
  private valenceInputMode: 'touch' | 'orientation-horizontal' | 'orientation-vertical' | 'orientation-rotation' = 'touch';
  private roomHost: string | null = null;
  private readonly BAT_SIGNAL_FIBONACCI = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  private maxParticipantCount = 0;
  private lastFibNotifiedIndex = -1;
  private stenoVtt: string = 'WEBVTT\n';
  private stenoLockUserId: string | null = null;
  private storyTracerPoints: StoryTracerPoint[] | null = null;
  private storyTracerMeta: StoryTracerMeta | null = null;
  private mapProjection: MapProjection | null = null;
  private callQueue: string[] = [];
  private callPairs: Map<string, string> = new Map();
  private callAlgorithm: string = 'first-available';
  private arrivalCapacity: number = 50;
  private neighborCodes = new Map<string, string>(); // userId → 4-digit code
  private neighborEdges = new Set<string>();          // canonical "userA|userB" strings
  private lightColor: { color: string; brightness: number } = { color: '#000000', brightness: 100 };

  private pluginStates = new Map<string, unknown>(
    Object.entries(PLUGIN_MAP)
      .filter(([, p]) => p.server)
      .map(([id, p]) => [id, p.server!.createState()]),
  );
  private ghosts = new GhostCursorManager(
    (msg) => this.room.broadcast(msg),
    () => this.allSelectedStatements,
  );

  constructor(readonly room: Party.Room) {}

  private makePluginContext(): PluginContext {
    return {
      broadcast: (msg) => this.room.broadcast(msg),
      getCursorPositions: () => this.cursorPositions,
      persistState: () => this.persistState(),
    };
  }

  private get persistenceEnabled(): boolean {
    return this.room.env.DISABLE_STORAGE_PERSISTENCE !== 'true';
  }

  async onStart() {
    if (!this.persistenceEnabled) return;
    const saved = await this.room.storage.get<PersistedState>("state");
    if (saved) this.applyPersistedState(saved);
  }

  private getPersistedState(): PersistedState {
    const pluginStates: Record<string, unknown> = {};
    for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
      if (plugin.server?.getPersistedState) {
        pluginStates[id] = plugin.server.getPersistedState(this.pluginStates.get(id));
      }
    }
    return {
      roomSocialConfig: this.roomSocialConfig,
      stenoVtt: this.stenoVtt,
      storyTracerPoints: this.storyTracerPoints,
      storyTracerMeta: this.storyTracerMeta,
      mapProjection: this.mapProjection,
      pluginStates,
    };
  }

  private applyPersistedState(saved: Partial<PersistedState>): void {
    if (saved.roomSocialConfig !== undefined) this.roomSocialConfig = saved.roomSocialConfig;
    if (saved.stenoVtt !== undefined) this.stenoVtt = saved.stenoVtt;
    if (saved.storyTracerPoints !== undefined) this.storyTracerPoints = saved.storyTracerPoints ?? null;
    if (saved.storyTracerMeta !== undefined) this.storyTracerMeta = saved.storyTracerMeta ?? null;
    if (saved.mapProjection !== undefined) this.mapProjection = saved.mapProjection ?? null;
    if (saved.pluginStates) {
      for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
        if (plugin.server?.applyPersistedState && saved.pluginStates[id] !== undefined) {
          plugin.server.applyPersistedState(this.pluginStates.get(id), saved.pluginStates[id]);
        }
      }
    }
  }

  private generateNeighborCode(): string {
    const used = new Set(this.neighborCodes.values());
    let code: string;
    do {
      code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    } while (used.has(code));
    return code;
  }

  private async persistState(): Promise<void> {
    if (!this.persistenceEnabled) return;
    await this.room.storage.put<PersistedState>("state", this.getPersistedState());
  }

  private participantCount(): number {
    return new Set(
      [...this.connectionUserMap.entries()]
        .filter(([connId]) => !this.adminConnectionIds.has(connId) && !this.viewerConnectionIds.has(connId))
        .map(([, userId]) => userId)
    ).size;
  }

  private viewerCount(): number {
    return this.viewerConnectionIds.size;
  }

  private getTargetConnections(targetUserId?: string, targetRegion?: 'positive' | 'negative' | 'neutral' | null, targetUserIds?: string[]): Party.Connection[] {
    const anchors = this.roomAnchors ?? REACTION_DEFAULT_ANCHORS;
    return [...this.room.getConnections()].filter(conn => {
      if (this.adminConnectionIds.has(conn.id)) return false;
      const userId = this.connectionUserMap.get(conn.id);
      if (!userId) return false;
      if (targetUserId !== undefined) return userId === targetUserId;
      if (targetUserIds !== undefined) return targetUserIds.includes(userId);
      const pos = this.cursorPositions.get(userId);
      if (!pos) return targetRegion === null;
      return computeReactionRegion(pos.x, pos.y, anchors) === targetRegion;
    });
  }

  private async sendTelegramBatSignal(count: number): Promise<void> {
    const token = this.room.env.TELEGRAM_BOT_TOKEN as string | undefined;
    const chatId = this.room.env.TELEGRAM_CHAT_ID as string | undefined;
    if (!token || !chatId) {
      console.log(`[bat-signal] room=${this.room.id} skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set`);
      return;
    }

    const host = this.roomHost; // always set by first connection; bat signal only fires with N+ connections
    if (!host) return;
    const roomUrl = `https://${host}/?room=${encodeURIComponent(this.room.id)}`;
    const text = `👀 ${count} devices in the reaction canvas — ${roomUrl}`;

    console.log(`[bat-signal] room=${this.room.id} firing → ${roomUrl}`);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    }).then(res => {
      if (!res.ok) console.log(`[bat-signal] room=${this.room.id} Telegram error: ${res.status}`);
    }).catch(err => {
      console.log(`[bat-signal] room=${this.room.id} fetch failed: ${err}`);
    });
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    const url = new URL(ctx.request.url);
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${url.pathname}`
    );

    if (!this.roomHost) this.roomHost = url.host;

    const isAdmin = url.searchParams.get('isAdmin') === 'true';
    if (isAdmin) {
      this.adminConnectionIds.add(conn.id);
    }

    const prevCount = this.participantCount();

    // Determine viewer status before adding to connectionUserMap
    const isViewer = !isAdmin && this.userCap !== null && prevCount >= this.userCap;

    const userId = url.searchParams.get('userId') ?? conn.id;
    this.connectionUserMap.set(conn.id, userId);
    if (!this.neighborCodes.has(userId)) {
      this.neighborCodes.set(userId, this.generateNeighborCode());
    }
    if (isViewer) {
      this.viewerConnectionIds.add(conn.id);
    }

    const count = this.participantCount();
    const vCount = this.viewerCount();

    if (!isAdmin && !isViewer && count > this.maxParticipantCount) {
      this.maxParticipantCount = count;
      for (let i = this.lastFibNotifiedIndex + 1; i < this.BAT_SIGNAL_FIBONACCI.length; i++) {
        if (this.BAT_SIGNAL_FIBONACCI[i] <= this.maxParticipantCount) {
          this.lastFibNotifiedIndex = i;
          void this.sendTelegramBatSignal(this.maxParticipantCount);
        } else {
          break;
        }
      }
    }
    // Send directly to new connection (broadcast may not include it)
    conn.send(JSON.stringify({ type: 'presenceCount', count, viewerCount: vCount }));
    // Notify all other connections
    this.room.broadcast(JSON.stringify({ type: 'presenceCount', count, viewerCount: vCount }), [conn.id]);
    // Notify admins of the arrival (exclude the new connection itself)
    if (!isAdmin) {
      this.room.broadcast(JSON.stringify({ type: 'userJoined', userId, isViewer }), [conn.id]);
    }

    // Unique participant userIds currently connected (for admin snapshot on join)
    const connectedUserIds = [...new Set(
      [...this.connectionUserMap.entries()]
        .filter(([cid]) => cid !== conn.id && !this.adminConnectionIds.has(cid))
        .map(([, uid]) => uid)
    )];

    // Send welcome message with current active statement, queue info, and statements pool
    conn.send(JSON.stringify({
      type: 'connected',
      connectionId: conn.id,
      activeStatementId: this.activeStatementId,
      allSelectedStatements: this.allSelectedStatements,
      statementsPool: this.statementsPool,
      currentTime: Date.now(),
      ghostCursorsEnabled: this.ghosts.enabled,
      timecode: this.savedTimecode,
      recordingState: this.recordingState,
      roomLabels: this.roomLabels,
      roomAnchors: this.roomAnchors,
      roomAvatarStyle: this.roomAvatarStyle,
      currentActivity: this.currentActivity,
      roomImageUrl: this.roomImageUrl,
      nowLabel: this.nowLabel,
      roomSocialConfig: this.roomSocialConfig,
      ballState: this.currentActivity === 'soccer' ? getSoccerBallState(this.pluginStates.get('soccer')) : null,
      soccerScore: getSoccerScore(this.pluginStates.get('soccer')),
      isViewer,
      userCap: this.userCap,
      viewerCount: vCount,
      connectedUserIds,
      inviteEdges: Object.fromEntries(this.inviteEdges),
      customAvatars: Object.fromEntries(this.customAvatars),
      colorCursorsByVote: this.colorCursorsByVote,
      defaultCursorColor: this.defaultCursorColor,
      ownValenceDisplay: this.ownValenceDisplay,
      valenceInputMode: this.valenceInputMode,
      stenoVtt: this.stenoVtt,
      stenoLockUserId: this.stenoLockUserId,
      storyTracerPoints: this.storyTracerPoints,
      storyTracerMeta: this.storyTracerMeta,
      mapProjection: this.mapProjection,
      callAlgorithm: this.callAlgorithm,
      arrivalCapacity: this.arrivalCapacity,
      myNeighborCode: this.neighborCodes.get(userId) ?? null,
      lightColor: this.lightColor,
    }));

    const pluginCtx = this.makePluginContext();
    for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
      if (plugin.server) plugin.server.onConnect(conn, pluginCtx, this.pluginStates.get(id), this.currentActivity);
    }
  }

  onClose(conn: Party.Connection) {
    const userId = this.connectionUserMap.get(conn.id);
    const isAdmin = this.adminConnectionIds.has(conn.id);
    const wasViewer = this.viewerConnectionIds.has(conn.id);

    this.adminConnectionIds.delete(conn.id);
    this.viewerConnectionIds.delete(conn.id);
    this.connectionUserMap.delete(conn.id);

    // Only treat the user as gone if this was their last connection
    const userStillConnected = userId
      ? [...this.connectionUserMap.values()].some(uid => uid === userId)
      : false;

    if (userId && !userStillConnected) {
      this.cursorPositions.delete(userId);
      this.neighborCodes.delete(userId);
    }

    if (!isAdmin && userId && !userStillConnected) {
      this.room.broadcast(JSON.stringify({ type: 'userLeft', userId, wasViewer }));
      if (this.stenoLockUserId === userId) {
        this.stenoLockUserId = null;
        this.room.broadcast(JSON.stringify({ type: 'stenoLockReleased', userId }));
      }
      // Call queue cleanup
      const qIdx = this.callQueue.indexOf(userId);
      if (qIdx !== -1) this.callQueue.splice(qIdx, 1);
      const peerId = this.callPairs.get(userId);
      if (peerId) {
        this.callPairs.delete(userId);
        this.callPairs.delete(peerId);
        for (const conn of this.getTargetConnections(peerId)) {
          conn.send(JSON.stringify({ type: 'hangUp', fromUserId: userId }));
        }
      }
    }

    const count = this.participantCount();
    this.room.broadcast(JSON.stringify({ type: 'presenceCount', count, viewerCount: this.viewerCount() }));
  }

  onMessage(message: string, sender: Party.Connection) {
    // Set DEBUG=true in .env (local) or via `partykit env add` to log incoming message rate.
    // Useful for measuring real client send rates before tuning perf thresholds.
    if (this.room.env.DEBUG === 'true') {
      this.msgCount++;
      if (!this.msgRateInterval) {
        this.msgRateInterval = setInterval(() => {
          const avgMs = this.msgCount > 0 ? Math.round(1000 / this.msgCount) : null;
          console.log(`[msg-rate] room=${this.room.id} ${this.msgCount} msg/s (~${avgMs ?? '∞'}ms between msgs)`);
          this.msgCount = 0;
        }, 1000);
      }
    }

    try {
      const event: ClientEvent = JSON.parse(message);

      // Plugin message router — runs before the main switch; return early if handled
      const pluginCtx = this.makePluginContext();
      for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
        if (plugin.server?.onMessage(event.type, event, sender, pluginCtx, this.pluginStates.get(id), this.currentActivity)) return;
      }

      switch (event.type) {
        case 'playbackCursorBroadcast': this.handlePlaybackCursorBroadcast(event); break;
        case 'move':
        case 'touch':
        case 'remove': this.handleCursorEvent(event, message, sender); break;
        case 'setActiveStatement': this.handleSetActiveStatement(event, sender); break;
        case 'queueStatement': this.queueStatement(event.statementId); break;
        case 'clearQueue': this.clearQueue(); break;
        case 'updateStatementsPool': this.handleUpdateStatementsPool(event, sender); break;
        case 'setGhostCursors': this.ghosts.setEnabled(event.enabled); break;
        case 'setTimecode': this.handleSetTimecode(event); break;
        case 'setRecordingState': this.handleSetRecordingState(event); break;
        case 'setRoomLabels': this.handleSetRoomLabels(event); break;
        case 'setRoomAnchors': this.handleSetRoomAnchors(event); break;
        case 'setRoomAvatarStyle': this.handleSetRoomAvatarStyle(event); break;
        case 'setActivity': this.handleSetActivity(event); break;
        case 'setNowLabel': this.handleSetNowLabel(event); break;
        case 'setImageUrl': this.handleSetImageUrl(event); break;
        case 'setUserCap': this.handleSetUserCap(event, sender); break;
        case 'triggerActivity': this.handleTriggerActivity(event); break;
        case 'submitGithubUsername': this.handleSubmitGithubUsername(event); break;
        case 'submitFeedbackStars': this.handleSubmitFeedbackStars(event); break;
        case 'setSocialConfig': this.handleSetSocialConfig(event); break;
        case 'requestJoin': this.handleRequestJoin(sender); break;
        case 'clearPushedInterfaces': this.handleClearPushedInterfaces(sender); break;
        case 'pushInterface': this.handlePushInterface(event, sender); break;
        case 'pushHaptic': this.handlePushHaptic(event, sender); break;
        case 'acceptInterface': this.handleAcceptInterface(event, sender); break;
        case 'setOwnValenceDisplay': this.handleSetOwnValenceDisplay(event, sender); break;
        case 'setValenceInputMode': this.handleSetValenceInputMode(event, sender); break;
        case 'setDefaultCursorColor': this.handleSetDefaultCursorColor(event, sender); break;
        case 'setColorCursorsByVote': this.handleSetColorCursorsByVote(event, sender); break;
        case 'registerCustomAvatar': this.handleRegisterCustomAvatar(event); break;
        case 'recordInvitations': this.handleRecordInvitations(event); break;
        case 'strokeSegment': this.room.broadcast(message); break;
        case 'clearSignature': this.room.broadcast(JSON.stringify({ type: 'signatureCleared', userId: event.userId })); break;
        case 'stenoStartRecording': this.handleStenoStartRecording(event, sender); break;
        case 'stenoStopRecording': this.handleStenoStopRecording(event); break;
        case 'stenoAppendText': this.handleStenoAppendText(event); break;
        case 'stenoSetText': this.handleStenoSetText(event); break;
        case 'storyTracerSetPoints': this.handleStoryTracerSetPoints(event); break;
        case 'storyTracerClearPoints': this.handleStoryTracerClearPoints(); break;
        case 'mapProjectionSet': this.handleMapProjectionSet(event); break;
        case 'mapProjectionClear': this.handleMapProjectionClear(); break;
        case 'joinCallQueue': this.handleJoinCallQueue(sender); break;
        case 'leaveCallQueue': this.handleLeaveCallQueue(sender); break;
        case 'webrtcOffer':
        case 'webrtcAnswer':
        case 'webrtcIce': this.handleWebrtcSignaling(event, sender); break;
        case 'hangUp': this.handleHangUp(event, sender); break;
        case 'setCallAlgorithm': this.handleSetCallAlgorithm(event, sender); break;
        case 'setArrivalCapacity': this.handleSetArrivalCapacity(event, sender); break;
        case 'neighborEdge': this.handleNeighborEdge(event, sender); break;
        case 'requestNeighborEdges': this.handleRequestNeighborEdges(sender); break;
        case 'clearNeighborEdges': this.handleClearNeighborEdges(); break;
        case 'setLightColor': this.handleSetLightColor(event); break;
      }
    } catch (e) {
      console.error('Failed to parse event:', e);
    }
  }

  // --- Cursor handlers ---

  private handlePlaybackCursorBroadcast(event: PlaybackCursorBroadcastEvent): void {
    // Admin replaying recorded events — broadcast to ALL clients (including sender)
    // so the admin's own "Peek Canvas" tab also sees playback cursors
    this.room.broadcast(JSON.stringify({
      type: event.cursorType,
      position: { ...event.position, isPlayback: true },
    }));
  }

  private handleCursorEvent(event: CursorEvent, message: string, sender: Party.Connection): void {
    const isFirstAppearance = (event.type === 'move' || event.type === 'touch') && !this.cursorPositions.has(event.position.userId);
    if (isFirstAppearance) console.log(`Cursor appeared for ${event.position.userId} via ${event.type}`);
    else if (event.type === 'remove') console.log(`Cursor removed for ${event.position.userId}`);
    if (event.type === 'move' || event.type === 'touch') {
      this.cursorPositions.set(event.position.userId, { x: event.position.x, y: event.position.y });
    } else if (event.type === 'remove') {
      this.cursorPositions.delete(event.position.userId);
    }
    this.room.broadcast(message, [sender.id]);
  }

  // --- Statement / queue handlers ---

  private handleSetActiveStatement(event: StatementEvent, sender: Party.Connection): void {
    console.log(`Statement change from ${sender.id}:`, event.statementId);
    this.activeStatementId = event.statementId;
    this.room.broadcast(JSON.stringify({ type: 'activeStatementChanged', statementId: this.activeStatementId }));
  }

  private handleUpdateStatementsPool(event: UpdateStatementsPoolEvent, sender: Party.Connection): void {
    if (event.conversationId) {
      console.log(`Statements pool update from ${sender.id} via Polis conversation:`, event.conversationId);
      void this.updateStatementsPool(undefined, event.conversationId, event.baseUrl);
    } else if (event.json) {
      console.log(`Statements pool update from ${sender.id} via JSON data:`, event.json.length, 'items');
      void this.updateStatementsPool(event.json);
    } else {
      console.log(`Invalid statements pool update from ${sender.id}: no json or conversationId provided`);
    }
  }

  // --- Room config handlers ---

  private handleSetTimecode(event: SetTimecodeEvent): void {
    this.savedTimecode = event.timecode;
    this.room.broadcast(JSON.stringify({ type: 'timecodeUpdate', timecode: this.savedTimecode }));
  }

  private handleSetRecordingState(event: SetRecordingStateEvent): void {
    this.recordingState = event.recording;
    this.room.broadcast(JSON.stringify({ type: 'recordingStateChanged', recording: this.recordingState }));
  }

  private handleSetRoomLabels(event: SetRoomLabelsEvent): void {
    this.roomLabels = event.labels;
    this.room.broadcast(JSON.stringify({ type: 'roomLabelsChanged', labels: this.roomLabels }));
  }

  private handleSetRoomAnchors(event: SetRoomAnchorsEvent): void {
    this.roomAnchors = event.anchors;
    this.room.broadcast(JSON.stringify({ type: 'roomAnchorsChanged', anchors: this.roomAnchors }));
  }

  private handleSetRoomAvatarStyle(event: SetRoomAvatarStyleEvent): void {
    this.roomAvatarStyle = event.avatarStyle;
    this.room.broadcast(JSON.stringify({ type: 'roomAvatarStyleChanged', avatarStyle: this.roomAvatarStyle }));
  }

  private handleSetNowLabel(event: SetNowLabelEvent): void {
    this.nowLabel = event.label;
    this.room.broadcast(JSON.stringify({ type: 'nowLabelChanged', label: this.nowLabel }));
  }

  private handleSetImageUrl(event: SetImageUrlEvent): void {
    this.roomImageUrl = event.url;
    this.room.broadcast(JSON.stringify({ type: 'imageUrlChanged', url: this.roomImageUrl }));
  }

  private handleSetActivity(event: SetActivityEvent): void {
    const prevActivity = this.currentActivity;
    this.currentActivity = event.activity;
    const ctx = this.makePluginContext();

    const prevPlugin = PLUGIN_MAP[prevActivity];
    if (prevPlugin?.server) prevPlugin.server.onDeactivate(ctx, this.pluginStates.get(prevActivity));

    const nextPlugin = PLUGIN_MAP[this.currentActivity];
    if (nextPlugin?.server) nextPlugin.server.onActivate(ctx, this.pluginStates.get(this.currentActivity));

    const soccerState = this.pluginStates.get('soccer');
    this.room.broadcast(JSON.stringify({
      type: 'activityChanged',
      activity: this.currentActivity,
      ball: this.currentActivity === 'soccer' ? getSoccerBallState(soccerState) : null,
      score: getSoccerScore(soccerState),
    }));
  }

  // --- Admin / access handlers ---

  private handleSetUserCap(event: SetUserCapEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.userCap = event.cap;
    this.room.broadcast(JSON.stringify({ type: 'userCapChanged', cap: this.userCap }));
  }

  private handleRequestJoin(sender: Party.Connection): void {
    if (!this.viewerConnectionIds.has(sender.id)) return;
    if (this.userCap !== null && this.participantCount() >= this.userCap) {
      sender.send(JSON.stringify({ type: 'joinDenied' }));
      return;
    }
    this.viewerConnectionIds.delete(sender.id);
    const count = this.participantCount();
    const vCount = this.viewerCount();
    sender.send(JSON.stringify({ type: 'joinApproved' }));
    this.room.broadcast(JSON.stringify({ type: 'presenceCount', count, viewerCount: vCount }), [sender.id]);
    sender.send(JSON.stringify({ type: 'presenceCount', count, viewerCount: vCount }));
  }

  private handleClearPushedInterfaces(sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.room.broadcast(JSON.stringify({ type: 'pushedInterfacesCleared' }));
  }

  private handlePushInterface(event: PushInterfaceEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    const targets = this.getTargetConnections(event.targetUserId, event.targetRegion, event.targetUserIds);
    const msg = JSON.stringify({ type: 'interfacePushed', interfaceName: event.interfaceName, payload: event.payload ?? {} });
    for (const conn of targets) conn.send(msg);
  }

  private handlePushHaptic(event: PushHapticEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    const targets = this.getTargetConnections(event.targetUserId, event.targetRegion, event.targetUserIds);
    const msg = JSON.stringify({ type: 'hapticPushed' });
    for (const conn of targets) conn.send(msg);
  }

  private handleAcceptInterface(event: AcceptInterfaceEvent, sender: Party.Connection): void {
    const userId = this.connectionUserMap.get(sender.id);
    if (!userId) return;
    const msg = JSON.stringify({ type: 'interfaceAccepted', userId, interfaceName: event.interfaceName });
    for (const conn of this.room.getConnections()) {
      if (this.adminConnectionIds.has(conn.id)) conn.send(msg);
    }
  }

  private handleTriggerActivity(event: TriggerActivityEvent): void {
    const msg = JSON.stringify({ type: 'activityTriggered', activityName: event.activityName });
    const hasTarget = event.targetUserId !== undefined || event.targetRegion !== undefined || event.targetUserIds !== undefined;
    if (hasTarget) {
      const targets = this.getTargetConnections(event.targetUserId, event.targetRegion, event.targetUserIds);
      for (const conn of targets) conn.send(msg);
    } else {
      this.room.broadcast(msg);
    }
  }

  // --- Viz / display handlers ---

  private handleSetOwnValenceDisplay(event: SetOwnValenceDisplayEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.ownValenceDisplay = event.mode;
    this.room.broadcast(JSON.stringify({ type: 'ownValenceDisplayChanged', ownValenceDisplay: this.ownValenceDisplay }));
  }

  private handleSetValenceInputMode(event: SetValenceInputModeEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.valenceInputMode = event.mode;
    this.room.broadcast(JSON.stringify({ type: 'valenceInputModeChanged', valenceInputMode: this.valenceInputMode }));
  }

  private handleSetDefaultCursorColor(event: SetDefaultCursorColorEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.defaultCursorColor = event.color;
    this.room.broadcast(JSON.stringify({ type: 'defaultCursorColorChanged', defaultCursorColor: this.defaultCursorColor }));
  }

  private handleSetColorCursorsByVote(event: SetColorCursorsByVoteEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.colorCursorsByVote = event.enabled;
    this.room.broadcast(JSON.stringify({ type: 'colorCursorsByVoteChanged', colorCursorsByVote: this.colorCursorsByVote }));
  }

  // --- Social / submission handlers ---

  private handleSubmitGithubUsername(event: SubmitGithubUsernameEvent): void {
    const submission = {
      username: event.username,
      displayName: event.displayName,
      avatarUrl: event.avatarUrl,
      timestamp: event.timestamp || Date.now(),
    };
    this.githubSubmissions.push(submission);
    this.room.broadcast(JSON.stringify({ type: 'githubUsernameSubmitted', ...submission }));
  }

  private handleSubmitFeedbackStars(event: SubmitFeedbackStarsEvent): void {
    this.room.broadcast(JSON.stringify({ type: 'feedbackStarsSubmitted', userId: event.userId, stars: event.stars, timestamp: event.timestamp || Date.now() }));
  }

  private handleSetSocialConfig(event: SetSocialConfigEvent): void {
    this.roomSocialConfig = event.config;
    this.room.broadcast(JSON.stringify({ type: 'socialConfigChanged', config: this.roomSocialConfig }));
    void this.persistState();
  }

  private handleRegisterCustomAvatar(event: RegisterCustomAvatarEvent): void {
    this.customAvatars.set(event.userId, event.photoUrl);
    this.room.broadcast(JSON.stringify({ type: 'customAvatarsChanged', customAvatars: Object.fromEntries(this.customAvatars) }));
  }

  private handleRecordInvitations(event: RecordInvitationsEvent): void {
    const newEdges: Array<[string, string]> = [];
    for (const [inviterId, inviteeId] of event.edges) {
      if (!this.inviteEdges.has(inviteeId)) {
        this.inviteEdges.set(inviteeId, inviterId);
        newEdges.push([inviterId, inviteeId]);
      }
    }
    if (newEdges.length > 0) {
      this.room.broadcast(JSON.stringify({ type: 'inviteEdges', edges: newEdges }));
    }
  }

  // --- Steno handlers ---

  private handleStenoStartRecording(event: StenoStartRecordingEvent, sender: Party.Connection): void {
    if (this.stenoLockUserId !== null && this.stenoLockUserId !== event.userId) {
      sender.send(JSON.stringify({ type: 'stenoLockDenied', lockHolderUserId: this.stenoLockUserId }));
      return;
    }
    this.stenoLockUserId = event.userId;
    this.room.broadcast(JSON.stringify({ type: 'stenoLockAcquired', userId: event.userId }));
  }

  private handleStenoStopRecording(event: StenoStopRecordingEvent): void {
    if (this.stenoLockUserId !== event.userId) return;
    this.stenoLockUserId = null;
    this.room.broadcast(JSON.stringify({ type: 'stenoLockReleased', userId: event.userId }));
  }

  private handleStenoAppendText(event: StenoAppendTextEvent): void {
    if (this.stenoLockUserId !== event.userId) return;
    this.stenoVtt += '\n' + event.text + '\n';
    this.room.broadcast(JSON.stringify({ type: 'stenoTextChanged', text: this.stenoVtt }));
    void this.persistState();
  }

  private handleStenoSetText(event: StenoSetTextEvent): void {
    if (this.stenoLockUserId !== null && this.stenoLockUserId !== event.userId) return;
    this.stenoVtt = event.text;
    this.room.broadcast(JSON.stringify({ type: 'stenoTextChanged', text: this.stenoVtt }));
    void this.persistState();
  }

  // --- StoryTracer / Map handlers ---

  private handleStoryTracerSetPoints(event: StoryTracerSetPointsEvent): void {
    this.storyTracerPoints = event.points;
    this.storyTracerMeta = event.meta;
    void this.persistState();
    this.room.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: event.points, meta: event.meta }));
  }

  private handleStoryTracerClearPoints(): void {
    this.storyTracerPoints = null;
    this.storyTracerMeta = null;
    void this.persistState();
    this.room.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: null, meta: null }));
  }

  private handleMapProjectionSet(event: MapProjectionSetEvent): void {
    this.mapProjection = event.projection;
    void this.persistState();
    this.room.broadcast(JSON.stringify({ type: 'mapProjectionChanged', projection: event.projection }));
  }

  private handleMapProjectionClear(): void {
    this.mapProjection = null;
    void this.persistState();
    this.room.broadcast(JSON.stringify({ type: 'mapProjectionChanged', projection: null }));
  }

  // --- Voice call handlers ---

  private handleJoinCallQueue(sender: Party.Connection): void {
    const senderId = this.connectionUserMap.get(sender.id);
    if (!senderId) return;
    if (this.callPairs.has(senderId)) return; // already in a call
    if (this.callQueue.length > 0) {
      const waiterId = this.callQueue.shift()!;
      this.callPairs.set(waiterId, senderId);
      this.callPairs.set(senderId, waiterId);
      for (const conn of this.getTargetConnections(waiterId)) {
        conn.send(JSON.stringify({ type: 'callPaired', role: 'initiator', peerId: senderId }));
      }
      sender.send(JSON.stringify({ type: 'callPaired', role: 'receiver', peerId: waiterId }));
    } else {
      this.callQueue.push(senderId);
      sender.send(JSON.stringify({ type: 'callQueued' }));
    }
  }

  private handleLeaveCallQueue(sender: Party.Connection): void {
    const senderId = this.connectionUserMap.get(sender.id);
    if (!senderId) return;
    const idx = this.callQueue.indexOf(senderId);
    if (idx !== -1) this.callQueue.splice(idx, 1);
  }

  private handleWebrtcSignaling(event: WebRTCOfferEvent | WebRTCAnswerEvent | WebRTCIceEvent, sender: Party.Connection): void {
    const senderId = this.connectionUserMap.get(sender.id);
    if (!senderId) return;
    for (const conn of this.getTargetConnections(event.targetUserId)) {
      conn.send(JSON.stringify({ ...event, fromUserId: senderId }));
    }
  }

  private handleHangUp(event: HangUpCallEvent, sender: Party.Connection): void {
    const senderId = this.connectionUserMap.get(sender.id);
    if (!senderId) return;
    this.callPairs.delete(senderId);
    const peerId = event.targetUserId;
    this.callPairs.delete(peerId);
    for (const conn of this.getTargetConnections(peerId)) {
      conn.send(JSON.stringify({ type: 'hangUp', fromUserId: senderId }));
    }
  }

  private handleSetCallAlgorithm(event: SetCallAlgorithmEvent, sender: Party.Connection): void {
    if (this.adminConnectionIds.has(sender.id)) {
      this.callAlgorithm = event.algorithm;
    }
  }

  private handleSetArrivalCapacity(event: SetArrivalCapacityEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.arrivalCapacity = event.capacity;
    this.room.broadcast(JSON.stringify({ type: 'arrivalCapacityChanged', capacity: this.arrivalCapacity }));
  }

  // --- Neighbor handlers ---

  private handleNeighborEdge(event: NeighborEdgeEvent, sender: Party.Connection): void {
    const fromUserId = this.connectionUserMap.get(sender.id);
    if (!fromUserId) return;
    const toCode = event.toCode;
    if (this.neighborCodes.get(fromUserId) === toCode) {
      sender.send(JSON.stringify({ type: 'neighborEdgeError', reason: 'self' }));
      return;
    }
    let toUserId: string | null = null;
    for (const [uid, code] of this.neighborCodes) {
      if (code === toCode) { toUserId = uid; break; }
    }
    if (!toUserId) {
      sender.send(JSON.stringify({ type: 'neighborEdgeError', reason: 'not_found' }));
      return;
    }
    const canonical = [fromUserId, toUserId].sort().join('|');
    if (this.neighborEdges.has(canonical)) {
      sender.send(JSON.stringify({ type: 'neighborEdgeError', reason: 'duplicate' }));
      return;
    }
    this.neighborEdges.add(canonical);
    const [userA, userB] = canonical.split('|');
    this.room.broadcast(JSON.stringify({ type: 'neighborEdgeAdded', userA, userB }));
  }

  private handleRequestNeighborEdges(sender: Party.Connection): void {
    const edges = [...this.neighborEdges].map(e => { const [userA, userB] = e.split('|'); return { userA, userB }; });
    const allCodes = Object.fromEntries(this.neighborCodes);
    sender.send(JSON.stringify({ type: 'neighborEdgesSnapshot', edges, allCodes }));
  }

  private handleClearNeighborEdges(): void {
    this.neighborEdges.clear();
    this.room.broadcast(JSON.stringify({ type: 'neighborEdgesCleared' }));
  }

  // --- Light handler ---

  private handleSetLightColor(event: SetLightColorEvent): void {
    this.lightColor = { color: event.color, brightness: event.brightness };
    this.room.broadcast(JSON.stringify({ type: 'lightColor', color: event.color, brightness: event.brightness }));
  }

  // --- Core statement/queue methods ---

  private queueStatement(statementId: number) {
    const now = Date.now();
    const displayTimestamp = computeNextDisplayTimestamp(this.allSelectedStatements, now);
    this.allSelectedStatements.push({ statementId, displayTimestamp });
    this.room.broadcast(JSON.stringify({
      type: 'queueUpdated',
      allSelectedStatements: this.allSelectedStatements,
      currentTime: Date.now(),
    }));
  }

  private getCurrentActiveStatementId(): number {
    return getCurrentActiveStatementId(this.allSelectedStatements, Date.now());
  }

  private clearQueue() {
    this.allSelectedStatements = computeClearedQueue(this.allSelectedStatements, Date.now());
    this.room.broadcast(JSON.stringify({
      type: 'queueUpdated',
      allSelectedStatements: this.allSelectedStatements,
      currentTime: Date.now()
    }));
  }

  private async updateStatementsPool(json?: any[], conversationId?: string, baseUrl?: string) {
    try {
      let newStatements: PolisStatement[] = [];

      if (conversationId) {
        const polisBaseUrl = baseUrl || 'https://pol.is';
        const polisUrl = `${polisBaseUrl}/api/v3/comments?conversation_id=${conversationId}&moderation=true&include_voting_patterns=true`;
        console.log(`Fetching statements from Polis API for conversation: ${conversationId}`);
        console.log(`Fetching from: ${polisUrl}`);

        const response = await fetch(polisUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch from Polis API: ${response.status}`);
        }
        const data = await response.json();

        // Data is already in PolisStatement format from the API
        if (Array.isArray(data)) {
          newStatements = data;
          console.log(`Loaded ${newStatements.length} statements from Polis API`);
        } else {
          throw new Error('Invalid Polis API response - expected array');
        }
      } else if (json) {
        console.log(`Processing JSON data with ${json.length} items`);

        // Convert DefaultStatement format to PolisStatement format
        if (Array.isArray(json)) {
          newStatements = json.map((item: any): PolisStatement => ({
            txt: item.text || item.txt,
            tid: item.statementId || item.tid,
            created: item.created || new Date().toISOString(),
            is_seed: item.is_seed || false,
            is_meta: item.is_meta || false,
            lang: item.lang || 'en',
            pid: item.pid || 0
          }));
        } else {
          throw new Error('Invalid JSON format - expected array');
        }
      } else {
        throw new Error('Either json or conversationId must be provided');
      }

      // Update the statements pool with new data
      this.statementsPool = newStatements;
      console.log(`Statements pool updated with ${newStatements.length} statements`);

      // Broadcast the updated statements pool to all connected clients
      this.room.broadcast(JSON.stringify({
        type: 'statementsPoolUpdated',
        statementsPool: this.statementsPool,
        currentTime: Date.now()
      }));
    } catch (error) {
      console.error('Error updating statements pool:', error);
      // Broadcast error to clients
      this.room.broadcast(JSON.stringify({
        type: 'statementsPoolError',
        error: error instanceof Error ? error.message : 'Unknown error',
        currentTime: Date.now()
      }));
    }
  }

  async onRequest(request: Party.Request) {
    const url = new URL(request.url);
    console.log(`[VOTE] Incoming request: ${request.method} ${url.pathname}`);

    if (request.method === "POST" && url.pathname.endsWith("/storyTracerSetPoints")) {
      try {
        const body = await request.json<{ userId: string; points: StoryTracerPoint[]; meta: StoryTracerMeta }>()
        this.storyTracerPoints = body.points
        this.storyTracerMeta = body.meta
        void this.persistState()
        this.room.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: body.points, meta: body.meta }))
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
      } catch (err) {
        console.error('[storyTracer] error processing setPoints:', err)
        return new Response('Invalid request', { status: 400 })
      }
    }

    if (request.method === "POST" && url.pathname.endsWith("/vote")) {
      console.log(`[VOTE] Processing vote submission...`);
      try {
        const voteData = await request.json<Vote>();
        console.log(`[VOTE] Received vote data:`, JSON.stringify(voteData, null, 2));

        // Validate vote data
        if (!voteData.userId || typeof voteData.statementId !== 'number' ||
            typeof voteData.vote !== 'number' || ![-1, 0, 1].includes(voteData.vote)) {
          console.log(`[VOTE] Invalid vote data - validation failed:`, {
            hasUserId: !!voteData.userId,
            statementIdType: typeof voteData.statementId,
            voteType: typeof voteData.vote,
            voteValue: voteData.vote,
            isValidVoteValue: [-1, 0, 1].includes(voteData.vote)
          });
          return new Response("Invalid vote data", { status: 400 });
        }

        // Add timestamp if not provided
        if (!voteData.timestamp) {
          voteData.timestamp = Date.now();
          console.log(`[VOTE] Added timestamp: ${voteData.timestamp}`);
        }

        // Store the vote
        this.votes.push(voteData);
        console.log(`[VOTE] Vote stored successfully. Total votes: ${this.votes.length}`);
        console.log(`[VOTE] Vote details: User ${voteData.userId} voted ${voteData.vote} (${voteData.vote === 1 ? 'AGREE' : voteData.vote === -1 ? 'DISAGREE' : 'PASS'}) on statement ${voteData.statementId} at ${new Date(voteData.timestamp).toISOString()}`);

        return new Response(JSON.stringify({ success: true, voteCount: this.votes.length }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error("[VOTE] Error processing vote:", error);
        console.error("[VOTE] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
        return new Response("Error processing vote", { status: 500 });
      }
    }

    if (request.method === "GET" && url.pathname.endsWith("/votes")) {
      console.log(`[VOTE] Retrieving votes for admin panel. Total votes: ${this.votes.length}`);
      // Return all votes for admin panel
      return new Response(JSON.stringify(this.votes), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "DELETE" && url.pathname.endsWith("/votes")) {
      console.log(`[VOTE] Clearing all votes. Previous count: ${this.votes.length}`);
      // Clear all votes
      this.votes = [];
      console.log(`[VOTE] All votes cleared successfully`);
      return new Response(JSON.stringify({ success: true, message: "All votes cleared" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "GET" && url.pathname.endsWith("/github-submissions")) {
      return new Response(JSON.stringify(this.githubSubmissions), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "DELETE" && url.pathname.endsWith("/github-submissions")) {
      this.githubSubmissions = [];
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Default response
    console.log(`[VOTE] Default response for ${request.method} ${url.pathname}`);
    return new Response("Cursor tracking server is running", {
      headers: { "Content-Type": "text/plain" }
    });
  }
}

Server satisfies Party.Worker;
