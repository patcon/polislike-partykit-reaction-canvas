import type * as Party from "partykit/server";
import { computeReactionRegion, DEFAULT_ANCHORS as REACTION_DEFAULT_ANCHORS } from './lib/reactionRegion';
import type { ReactionAnchors } from './lib/reactionRegion';
import { SERVER_CURSOR_BATCH_MS } from '../app/utils/cursor';
import { PLUGIN_MAP } from '../plugins/index';
import type { PluginContext, PluginConnection } from '../plugins/types';
import { getSoccerBallState, getSoccerScore } from '../plugins/soccer/server';
import type {
  CursorEvent, PersistedState, ClientEvent,
  PlaybackCursorBroadcastEvent,
  SetTimecodeEvent, SetRecordingStateEvent, SetRoomLabelsEvent, SetRoomAnchorsEvent,
  SetRoomAvatarStyleEvent, SetScreenPanelEvent, SetNowLabelEvent, SetImageUrlEvent,
  SetUserCapEvent, TriggerActivityEvent, SubmitGithubUsernameEvent, SubmitFeedbackStarsEvent,
  SetSocialConfigEvent, SetGreeterConfigEvent, PushInterfaceEvent, AcceptInterfaceEvent,
  PushHapticEvent, RegisterCustomAvatarEvent, SetColorCursorsByVoteEvent,
  SetDefaultCursorColorEvent, SetOwnValenceDisplayEvent, SetValenceInputModeEvent,
  RecordInvitationsEvent,
  SetArrivalCapacityEvent,
} from './types';

export default class Server implements Party.Server {
  private connectionUserMap = new Map<string, string>(); // connectionId -> userId
  private adminConnectionIds = new Set<string>();
  private viewerConnectionIds = new Set<string>();
  private userCap: number | null = null;
  private savedTimecode: number = 0;
  private recordingState: boolean = false;
  private roomLabels: { positive: string; negative: string; neutral: string } | null = { positive: 'Agree', negative: 'Disagree', neutral: 'Pass' };
  private roomAnchors: ReactionAnchors | null = null;
  private roomAvatarStyle: string | null = null;
  private screenPanelsByName: Record<string, string> = { personal: 'canvas' };
  private roomImageUrl: string = '';
  private nowLabel: string = '';
  private msgCount = 0;
  private msgRateInterval?: NodeJS.Timeout;
  private githubSubmissions: { username: string; displayName: string | null; avatarUrl: string | null; timestamp: number }[] = [];
  private cursorPositions = new Map<string, { x: number; y: number }>();
  private pendingCursorUpdates = new Map<string, CursorEvent>();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
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
private pluginStates = new Map<string, unknown>(
    Object.entries(PLUGIN_MAP)
      .filter(([, p]) => p.server)
      .map(([id, p]) => [id, p.server!.createState()]),
  );

  constructor(readonly room: Party.Room) {}

  private makePluginContext(): PluginContext {
    return {
      broadcast: (msg) => this.room.broadcast(msg),
      sendToUser: (userId, msg) => {
        for (const conn of this.getTargetConnections(userId)) conn.send(msg);
      },
      getCursorPositions: () => this.cursorPositions,
      persistState: () => this.persistState(),
    };
  }

  private makePluginConn(conn: Party.Connection): PluginConnection {
    return { id: conn.id, userId: this.connectionUserMap.get(conn.id) ?? conn.id, send: (msg) => conn.send(msg) };
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
    return { pluginStates };
  }

  private applyPersistedState(saved: Partial<PersistedState>): void {
    if (saved.pluginStates) {
      for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
        if (plugin.server?.applyPersistedState && saved.pluginStates[id] !== undefined) {
          plugin.server.applyPersistedState(this.pluginStates.get(id), saved.pluginStates[id]);
        }
      }
    }
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

    // Send welcome message with current state
    this.sendCurrentState(conn, isViewer, vCount, connectedUserIds);

    const pluginCtx = this.makePluginContext();
    const pluginConn = this.makePluginConn(conn);
    for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
      if (plugin.server) plugin.server.onConnect(pluginConn, pluginCtx, this.pluginStates.get(id), this.screenPanelsByName['personal'] ?? 'canvas');
    }
  }

  onClose(conn: Party.Connection) {
    const userId = this.connectionUserMap.get(conn.id);
    const isAdmin = this.adminConnectionIds.has(conn.id);
    const wasViewer = this.viewerConnectionIds.has(conn.id);
    // Capture pluginConn before deleting from connectionUserMap — makePluginConn
    // reads the map, so it must run while the entry is still present.
    const pluginConn = this.makePluginConn(conn);

    this.adminConnectionIds.delete(conn.id);
    this.viewerConnectionIds.delete(conn.id);
    this.connectionUserMap.delete(conn.id);

    // Only treat the user as gone if this was their last connection
    const userStillConnected = userId
      ? [...this.connectionUserMap.values()].some(uid => uid === userId)
      : false;

    if (userId && !userStillConnected) {
      this.cursorPositions.delete(userId);
    }

    if (!isAdmin && userId && !userStillConnected) {
      this.room.broadcast(JSON.stringify({ type: 'userLeft', userId, wasViewer }));
    }

    const count = this.participantCount();
    this.room.broadcast(JSON.stringify({ type: 'presenceCount', count, viewerCount: this.viewerCount() }));

    const pluginCtx = this.makePluginContext();
    for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
      if (plugin.server?.onClose) plugin.server.onClose(pluginConn, pluginCtx, this.pluginStates.get(id));
    }
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
      const pluginConn = this.makePluginConn(sender);
      for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
        if (plugin.server?.onMessage(event.type, event, pluginConn, pluginCtx, this.pluginStates.get(id), this.screenPanelsByName['personal'] ?? 'canvas')) return;
      }

      switch (event.type) {
        case 'playbackCursorBroadcast': this.handlePlaybackCursorBroadcast(event); break;
        case 'move':
        case 'touch':
        case 'remove': this.handleCursorEvent(event, message, sender); break;
        case 'setTimecode': this.handleSetTimecode(event); break;
        case 'setRecordingState': this.handleSetRecordingState(event); break;
        case 'setRoomLabels': this.handleSetRoomLabels(event); break;
        case 'setRoomAnchors': this.handleSetRoomAnchors(event); break;
        case 'setRoomAvatarStyle': this.handleSetRoomAvatarStyle(event); break;
        case 'setScreenPanel': this.handleSetScreenPanel(event); break;
        case 'setNowLabel': this.handleSetNowLabel(event); break;
        case 'setImageUrl': this.handleSetImageUrl(event); break;
        case 'setUserCap': this.handleSetUserCap(event, sender); break;
        case 'triggerActivity': this.handleTriggerActivity(event); break;
        case 'submitGithubUsername': this.handleSubmitGithubUsername(event); break;
        case 'submitFeedbackStars': this.handleSubmitFeedbackStars(event); break;
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
        case 'getState': this.handleGetState(sender); break;
      }
    } catch (e) {
      console.error('Failed to parse event:', e);
    }
  }

  // --- Cursor handlers ---

  private flushCursorBatch(): void {
    if (this.pendingCursorUpdates.size === 0) return;
    const cursors = [...this.pendingCursorUpdates.values()];
    this.pendingCursorUpdates.clear();
    this.batchTimer = null;
    this.room.broadcast(JSON.stringify({ type: 'cursorBatch', cursors }));
  }

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
    if (SERVER_CURSOR_BATCH_MS > 0) {
      this.pendingCursorUpdates.set(event.position.userId, event);
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.flushCursorBatch(), SERVER_CURSOR_BATCH_MS);
      }
    } else {
      this.room.broadcast(message, [sender.id]);
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

  private handleSetScreenPanel(event: SetScreenPanelEvent): void {
    const screenName = event.screenName ?? 'personal';
    const prevPanel = this.screenPanelsByName[screenName] ?? 'canvas';
    this.screenPanelsByName[screenName] = event.screenPanel;
    const ctx = this.makePluginContext();

    // Plugin lifecycle hooks only fire for the personal screen — commons and any
    // future screens share panels freely without server-side plugin activation.
    if (screenName === 'personal') {
      const prevPlugin = PLUGIN_MAP[prevPanel];
      if (prevPlugin?.server) prevPlugin.server.onDeactivate(ctx, this.pluginStates.get(prevPanel));

      const nextPlugin = PLUGIN_MAP[event.screenPanel];
      if (nextPlugin?.server) nextPlugin.server.onActivate(ctx, this.pluginStates.get(event.screenPanel));
    }

    const soccerState = this.pluginStates.get('soccer');
    const personalPanel = this.screenPanelsByName['personal'] ?? 'canvas';
    this.room.broadcast(JSON.stringify({
      type: 'screenPanelChanged',
      screenName,
      screenPanel: event.screenPanel,
      ball: personalPanel === 'soccer' ? getSoccerBallState(soccerState) : null,
      score: getSoccerScore(soccerState),
    }));
  }

  // --- Admin / access handlers ---

  private handleSetUserCap(event: SetUserCapEvent, sender: Party.Connection): void {
    if (!this.adminConnectionIds.has(sender.id)) return;
    this.userCap = event.cap;
    this.room.broadcast(JSON.stringify({ type: 'userCapChanged', cap: this.userCap }));
  }

  private sendCurrentState(conn: Party.Connection, isViewer: boolean, vCount: number, connectedUserIds: string[]): void {
    conn.send(JSON.stringify({
      type: 'connected',
      connectionId: conn.id,
      timecode: this.savedTimecode,
      recordingState: this.recordingState,
      roomLabels: this.roomLabels,
      roomAnchors: this.roomAnchors,
      roomAvatarStyle: this.roomAvatarStyle,
      currentScreenPanel: this.screenPanelsByName['personal'] ?? 'canvas',
      currentScreenPanels: this.screenPanelsByName,
      roomImageUrl: this.roomImageUrl,
      nowLabel: this.nowLabel,
      ballState: (this.screenPanelsByName['personal'] ?? 'canvas') === 'soccer' ? getSoccerBallState(this.pluginStates.get('soccer')) : null,
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
    }));
  }

  private handleGetState(sender: Party.Connection): void {
    const isViewer = this.viewerConnectionIds.has(sender.id);
    const vCount = this.viewerCount();
    const connectedUserIds = [...new Set(
      [...this.connectionUserMap.entries()]
        .filter(([cid]) => cid !== sender.id && !this.adminConnectionIds.has(cid))
        .map(([, uid]) => uid)
    )];
    this.sendCurrentState(sender, isViewer, vCount, connectedUserIds);
    const count = this.participantCount();
    sender.send(JSON.stringify({ type: 'presenceCount', count, viewerCount: vCount }));
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

  async onRequest(request: Party.Request) {
    const url = new URL(request.url);

    // Delegate to plugins first
    const pluginCtx = this.makePluginContext();
    for (const [id, plugin] of Object.entries(PLUGIN_MAP)) {
      if (plugin.server?.onRequest) {
        const res = await plugin.server.onRequest(request, pluginCtx, this.pluginStates.get(id)!);
        if (res) return res;
      }
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

    if (request.method === "GET" && url.pathname.endsWith("/debug-state")) {
      const raw = await this.room.storage.get<PersistedState>("state");
      const debugReplacer = (_k: string, v: unknown) => {
        if (v instanceof Map) return Object.fromEntries(v);
        if (v instanceof Set) return [...v];
        return v;
      };
      return new Response(JSON.stringify({ raw, inMemoryPluginStates: Object.fromEntries(this.pluginStates) }, debugReplacer, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "DELETE" && url.pathname.endsWith("/debug-state")) {
      await this.room.storage.delete("state");
      return new Response(JSON.stringify({ success: true, message: "Persisted state deleted from storage" }), {
        headers: { "Content-Type": "application/json" },
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
