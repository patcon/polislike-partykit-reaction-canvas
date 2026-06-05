import type * as Party from "partykit/server";
import type { ActivityMode, StoryTracerPoint, StoryTracerMeta, MapProjection } from "../app/types";
import { computeReactionRegion, DEFAULT_ANCHORS as REACTION_DEFAULT_ANCHORS } from './lib/reactionRegion';
import type { ReactionAnchors } from './lib/reactionRegion';
import { getCurrentActiveStatementId, computeNextDisplayTimestamp, computeClearedQueue } from './lib/queueLogic';
import { SoccerPhysicsEngine } from './lib/soccerPhysics';
import { GhostCursorManager } from './lib/ghostCursors';

interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
}

interface CursorEvent {
  type: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

interface PolisStatement {
  txt: string;
  tid: number;
  created?: string;
  quote_src_url?: string | null;
  is_seed?: boolean;
  is_meta?: boolean;
  lang?: string;
  pid?: number;
  velocity?: number;
  mod?: number;
  active?: boolean;
  agree_count?: number;
  disagree_count?: number;
  pass_count?: number;
  count?: number;
  conversation_id?: string;
}

interface DefaultStatement {
  txt: string;
  tid: number;
  timecode?: number;
}

interface QueueItem {
  statementId: number;
  displayTimestamp: number; // timestamp when this should become active
}

interface StatementEvent {
  type: 'setActiveStatement';
  statementId: number;
}

interface QueueStatementEvent {
  type: 'queueStatement';
  statementId: number;
}

interface ClearQueueEvent {
  type: 'clearQueue';
}

interface UpdateStatementsPoolEvent {
  type: 'updateStatementsPool';
  json?: any[];
  conversationId?: string;
  baseUrl?: string;
}

interface GhostCursorSettingEvent {
  type: 'setGhostCursors';
  enabled: boolean;
}

interface SetTimecodeEvent {
  type: 'setTimecode';
  timecode: number;
}

interface SetRecordingStateEvent {
  type: 'setRecordingState';
  recording: boolean;
}

interface SetRoomLabelsEvent {
  type: 'setRoomLabels';
  labels: { positive: string; negative: string; neutral: string } | null;
}

interface SetRoomAnchorsEvent {
  type: 'setRoomAnchors';
  anchors: ReactionAnchors | null;
}

interface SetRoomAvatarStyleEvent {
  type: 'setRoomAvatarStyle';
  avatarStyle: string | null;
}

interface SetActivityEvent {
  type: 'setActivity';
  activity: ActivityMode;
}

interface SetImageUrlEvent {
  type: 'setImageUrl';
  url: string;
}

interface ResetSoccerScoreEvent {
  type: 'resetSoccerScore';
}

interface SetUserCapEvent {
  type: 'setUserCap';
  cap: number | null;
}

interface TriggerActivityEvent {
  type: 'triggerActivity';
  activityName: 'githubUsername' | 'feedbackStars';
  targetUserId?: string;
  targetRegion?: 'positive' | 'negative' | 'neutral' | null;
  targetUserIds?: string[];
}

interface SubmitFeedbackStarsEvent {
  type: 'submitFeedbackStars';
  userId: string;
  stars: number;
  timestamp: number;
}

interface SetSocialConfigEvent {
  type: 'setSocialConfig';
  config: { default: string; twitter: string; bluesky: string; mastodon: string } | null;
}

interface SetGreeterConfigEvent {
  type: 'setGreeterConfig';
  config: { eventUrl: string } | null;
}

interface SubmitGithubUsernameEvent {
  type: 'submitGithubUsername';
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  timestamp: number;
}

interface RequestJoinEvent {
  type: 'requestJoin';
}

interface PlaybackCursorBroadcastEvent {
  type: 'playbackCursorBroadcast';
  cursorType: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

interface PushInterfaceEvent {
  type: 'pushInterface';
  targetUserId?: string;
  targetRegion?: 'positive' | 'negative' | 'neutral' | null;
  targetUserIds?: string[];
  interfaceName: string;
  payload?: Record<string, unknown>;
}

interface AcceptInterfaceEvent {
  type: 'acceptInterface';
  interfaceName: string;
}

interface ClearPushedInterfacesEvent {
  type: 'clearPushedInterfaces';
}

interface PushHapticEvent {
  type: 'pushHaptic';
  targetUserId?: string;
  targetRegion?: 'positive' | 'negative' | 'neutral' | null;
  targetUserIds?: string[];
}

interface Vote {
  userId: string;
  statementId: number;
  vote: number; // +1 for agree, -1 for disagree, 0 for pass
  timestamp: number;
}

interface SetNowLabelEvent {
  type: 'setNowLabel';
  label: string;
}

interface RecordInvitationsEvent {
  type: 'recordInvitations';
  edges: Array<[string, string]>; // [inviterId, inviteeId]
}

interface RegisterCustomAvatarEvent {
  type: 'registerCustomAvatar';
  userId: string;
  photoUrl: string;
}

interface SetColorCursorsByVoteEvent {
  type: 'setColorCursorsByVote';
  enabled: boolean;
}

interface SetDefaultCursorColorEvent {
  type: 'setDefaultCursorColor';
  color: string;
}

interface SetOwnValenceDisplayEvent {
  type: 'setOwnValenceDisplay';
  mode: 'background' | 'labels' | 'none';
}

interface SetValenceInputModeEvent {
  type: 'setValenceInputMode';
  mode: 'touch' | 'orientation-horizontal' | 'orientation-vertical' | 'orientation-rotation';
}

interface StrokeSegmentEvent {
  type: 'strokeSegment';
  userId: string;
  strokeId: string;
  points: Array<{ x: number; y: number }>;
  isFinal: boolean;
}

interface ClearSignatureEvent {
  type: 'clearSignature';
  userId: string;
}

interface PersistedState {
  roomSocialConfig: { default: string; twitter: string; bluesky: string; mastodon: string } | null;
  stenoVtt: string;
  storyTracerPoints?: StoryTracerPoint[] | null;
  storyTracerMeta?: StoryTracerMeta | null;
  greeterConfig?: { eventUrl: string } | null;
  mapProjection?: MapProjection | null;
}

interface StenoStartRecordingEvent { type: 'stenoStartRecording'; userId: string }
interface StenoStopRecordingEvent  { type: 'stenoStopRecording';  userId: string }
interface StenoAppendTextEvent     { type: 'stenoAppendText';     userId: string; text: string }
interface StenoSetTextEvent        { type: 'stenoSetText';        userId: string; text: string }

interface StoryTracerSetPointsEvent  { type: 'storyTracerSetPoints';  userId: string; points: StoryTracerPoint[]; meta: StoryTracerMeta }
interface StoryTracerClearPointsEvent { type: 'storyTracerClearPoints'; userId: string }

interface MapProjectionSetEvent   { type: 'mapProjectionSet';   userId: string; projection: MapProjection }
interface MapProjectionClearEvent { type: 'mapProjectionClear'; userId: string }

interface JoinCallQueueEvent   { type: 'joinCallQueue' }
interface LeaveCallQueueEvent  { type: 'leaveCallQueue' }
interface WebRTCOfferEvent     { type: 'webrtcOffer';   targetUserId: string; offer: unknown }
interface WebRTCAnswerEvent    { type: 'webrtcAnswer';  targetUserId: string; answer: unknown }
interface WebRTCIceEvent       { type: 'webrtcIce';     targetUserId: string; candidate: unknown }
interface HangUpCallEvent      { type: 'hangUp';        targetUserId: string }
interface SetCallAlgorithmEvent { type: 'setCallAlgorithm'; algorithm: string }
interface SetArrivalCapacityEvent { type: 'setArrivalCapacity'; capacity: number }

interface NeighborEdgeEvent      { type: 'neighborEdge';         from: string; toCode: string }
interface RequestNeighborEdgesEvent { type: 'requestNeighborEdges' }
interface ClearNeighborEdgesEvent   { type: 'clearNeighborEdges' }

interface SetLightColorEvent { type: 'setLightColor'; color: string; brightness: number }

type ClientEvent =CursorEvent | StatementEvent | QueueStatementEvent | ClearQueueEvent | UpdateStatementsPoolEvent | GhostCursorSettingEvent | SetTimecodeEvent | SetRecordingStateEvent | SetRoomLabelsEvent | SetRoomAnchorsEvent | SetRoomAvatarStyleEvent | SetActivityEvent | SetImageUrlEvent | ResetSoccerScoreEvent | SetUserCapEvent | RequestJoinEvent | PlaybackCursorBroadcastEvent | TriggerActivityEvent | SubmitGithubUsernameEvent | SubmitFeedbackStarsEvent | SetSocialConfigEvent | SetGreeterConfigEvent | PushInterfaceEvent | AcceptInterfaceEvent | ClearPushedInterfacesEvent | PushHapticEvent | SetNowLabelEvent | RecordInvitationsEvent | RegisterCustomAvatarEvent | SetColorCursorsByVoteEvent | SetDefaultCursorColorEvent | SetOwnValenceDisplayEvent | SetValenceInputModeEvent | StrokeSegmentEvent | ClearSignatureEvent | StenoStartRecordingEvent | StenoStopRecordingEvent | StenoAppendTextEvent | StenoSetTextEvent | StoryTracerSetPointsEvent | StoryTracerClearPointsEvent | MapProjectionSetEvent | MapProjectionClearEvent | JoinCallQueueEvent | LeaveCallQueueEvent | WebRTCOfferEvent | WebRTCAnswerEvent | WebRTCIceEvent | HangUpCallEvent | SetCallAlgorithmEvent | SetArrivalCapacityEvent | NeighborEdgeEvent | RequestNeighborEdgesEvent | ClearNeighborEdgesEvent | SetLightColorEvent;


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
  private greeterConfig: { eventUrl: string } | null = null;
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

  private soccer = new SoccerPhysicsEngine(
    (msg) => this.room.broadcast(msg),
    () => this.cursorPositions,
  );
  private ghosts = new GhostCursorManager(
    (msg) => this.room.broadcast(msg),
    () => this.allSelectedStatements,
  );

  constructor(readonly room: Party.Room) {}

  private get persistenceEnabled(): boolean {
    return this.room.env.DISABLE_STORAGE_PERSISTENCE !== 'true';
  }

  async onStart() {
    if (!this.persistenceEnabled) return;
    const saved = await this.room.storage.get<PersistedState>("state");
    if (saved) this.applyPersistedState(saved);
  }

  private getPersistedState(): PersistedState {
    return {
      roomSocialConfig: this.roomSocialConfig,
      stenoVtt: this.stenoVtt,
      storyTracerPoints: this.storyTracerPoints,
      storyTracerMeta: this.storyTracerMeta,
      greeterConfig: this.greeterConfig,
      mapProjection: this.mapProjection,
    };
  }

  private applyPersistedState(saved: Partial<PersistedState>): void {
    if (saved.roomSocialConfig !== undefined) this.roomSocialConfig = saved.roomSocialConfig;
    if (saved.stenoVtt !== undefined) this.stenoVtt = saved.stenoVtt;
    if (saved.storyTracerPoints !== undefined) this.storyTracerPoints = saved.storyTracerPoints ?? null;
    if (saved.storyTracerMeta !== undefined) this.storyTracerMeta = saved.storyTracerMeta ?? null;
    if (saved.greeterConfig !== undefined) this.greeterConfig = saved.greeterConfig ?? null;
    if (saved.mapProjection !== undefined) this.mapProjection = saved.mapProjection ?? null;
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
      greeterConfig: this.greeterConfig,
      ballState: this.currentActivity === 'soccer' ? this.soccer.ballState : null,
      soccerScore: this.soccer.score,
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

      if (event.type === 'playbackCursorBroadcast') {
        // Admin replaying recorded events — broadcast to ALL clients (including sender)
        // so the admin's own "Peek Canvas" tab also sees playback cursors
        this.room.broadcast(JSON.stringify({
          type: event.cursorType,
          position: {
            ...event.position,
            isPlayback: true,
          },
        }));
      } else if ('position' in event) {
        // Handle cursor events
        const isFirstAppearance = (event.type === 'move' || event.type === 'touch') && !this.cursorPositions.has(event.position.userId);
        if (isFirstAppearance) console.log(`Cursor appeared for ${event.position.userId} via ${event.type}`);
        else if (event.type === 'remove') console.log(`Cursor removed for ${event.position.userId}`);
        // Track cursor positions for soccer physics
        if (event.type === 'move' || event.type === 'touch') {
          this.cursorPositions.set(event.position.userId, { x: event.position.x, y: event.position.y });
        } else if (event.type === 'remove') {
          this.cursorPositions.delete(event.position.userId);
        }
        // Broadcast the cursor event to all other connections
        this.room.broadcast(message, [sender.id]);
      } else if (event.type === 'setActiveStatement') {
        // Handle immediate statement change events (legacy support)
        console.log(`Statement change from ${sender.id}:`, event.statementId);
        this.activeStatementId = event.statementId;
        // Broadcast the statement change to all connections
        this.room.broadcast(JSON.stringify({
          type: 'activeStatementChanged',
          statementId: this.activeStatementId
        }));
      } else if (event.type === 'queueStatement') {
        // Handle queuing statement events
        console.log(`Queue statement from ${sender.id}:`, event.statementId);
        this.queueStatement(event.statementId);
      } else if (event.type === 'clearQueue') {
        // Handle clearing the queue
        console.log(`Clear queue from ${sender.id}`);
        this.clearQueue();
      } else if (event.type === 'updateStatementsPool') {
        // Handle statements pool updates from client
        if (event.conversationId) {
          console.log(`Statements pool update from ${sender.id} via Polis conversation:`, event.conversationId);
          this.updateStatementsPool(undefined, event.conversationId, event.baseUrl);
        } else if (event.json) {
          console.log(`Statements pool update from ${sender.id} via JSON data:`, event.json.length, 'items');
          this.updateStatementsPool(event.json);
        } else {
          console.log(`Invalid statements pool update from ${sender.id}: no json or conversationId provided`);
        }
      } else if (event.type === 'setGhostCursors') {
        // Handle ghost cursor setting changes
        console.log(`Ghost cursor setting from ${sender.id}:`, event.enabled);
        this.ghosts.setEnabled(event.enabled);
      } else if (event.type === 'setTimecode') {
        this.savedTimecode = event.timecode;
        this.room.broadcast(JSON.stringify({ type: 'timecodeUpdate', timecode: this.savedTimecode }));
      } else if (event.type === 'setRecordingState') {
        this.recordingState = event.recording;
        this.room.broadcast(JSON.stringify({ type: 'recordingStateChanged', recording: this.recordingState }));
      } else if (event.type === 'setRoomLabels') {
        this.roomLabels = event.labels;
        this.room.broadcast(JSON.stringify({ type: 'roomLabelsChanged', labels: this.roomLabels }));
      } else if (event.type === 'setRoomAnchors') {
        this.roomAnchors = event.anchors;
        this.room.broadcast(JSON.stringify({ type: 'roomAnchorsChanged', anchors: this.roomAnchors }));
      } else if (event.type === 'setRoomAvatarStyle') {
        this.roomAvatarStyle = event.avatarStyle;
        this.room.broadcast(JSON.stringify({ type: 'roomAvatarStyleChanged', avatarStyle: this.roomAvatarStyle }));
      } else if (event.type === 'setActivity') {
        this.currentActivity = event.activity;
        if (event.activity === 'soccer') {
          this.soccer.start();
        } else {
          this.soccer.stop();
        }
        this.room.broadcast(JSON.stringify({
          type: 'activityChanged',
          activity: this.currentActivity,
          ball: this.currentActivity === 'soccer' ? this.soccer.ballState : null,
          score: this.soccer.score,
        }));
      } else if (event.type === 'setNowLabel') {
        this.nowLabel = event.label;
        this.room.broadcast(JSON.stringify({ type: 'nowLabelChanged', label: this.nowLabel }));
      } else if (event.type === 'setImageUrl') {
        this.roomImageUrl = event.url;
        this.room.broadcast(JSON.stringify({ type: 'imageUrlChanged', url: this.roomImageUrl }));
      } else if (event.type === 'resetSoccerScore') {
        this.soccer.resetScore();
      } else if (event.type === 'setUserCap') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        this.userCap = event.cap;
        this.room.broadcast(JSON.stringify({ type: 'userCapChanged', cap: this.userCap }));
      } else if (event.type === 'triggerActivity') {
        const msg = JSON.stringify({ type: 'activityTriggered', activityName: event.activityName });
        const hasTarget = event.targetUserId !== undefined || event.targetRegion !== undefined || event.targetUserIds !== undefined;
        if (hasTarget) {
          const targets = this.getTargetConnections(event.targetUserId, event.targetRegion, event.targetUserIds);
          for (const conn of targets) conn.send(msg);
        } else {
          this.room.broadcast(msg);
        }
      } else if (event.type === 'submitGithubUsername') {
        const submission = {
          username: event.username,
          displayName: event.displayName,
          avatarUrl: event.avatarUrl,
          timestamp: event.timestamp || Date.now(),
        };
        this.githubSubmissions.push(submission);
        // Broadcast to admins so they see it live
        this.room.broadcast(JSON.stringify({ type: 'githubUsernameSubmitted', ...submission }));
      } else if (event.type === 'submitFeedbackStars') {
        this.room.broadcast(JSON.stringify({ type: 'feedbackStarsSubmitted', userId: event.userId, stars: event.stars, timestamp: event.timestamp || Date.now() }));
      } else if (event.type === 'setSocialConfig') {
        this.roomSocialConfig = event.config;
        this.room.broadcast(JSON.stringify({ type: 'socialConfigChanged', config: this.roomSocialConfig }));
        void this.persistState();
      } else if (event.type === 'setGreeterConfig') {
        this.greeterConfig = event.config;
        this.room.broadcast(JSON.stringify({ type: 'greeterConfigChanged', config: this.greeterConfig }));
      } else if (event.type === 'requestJoin') {
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
      } else if (event.type === 'clearPushedInterfaces') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        this.room.broadcast(JSON.stringify({ type: 'pushedInterfacesCleared' }));
      } else if (event.type === 'pushInterface') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        const targets = this.getTargetConnections(event.targetUserId, event.targetRegion, event.targetUserIds);
        const msg = JSON.stringify({ type: 'interfacePushed', interfaceName: event.interfaceName, payload: event.payload ?? {} });
        for (const conn of targets) conn.send(msg);
      } else if (event.type === 'pushHaptic') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        const targets = this.getTargetConnections(event.targetUserId, event.targetRegion, event.targetUserIds);
        const msg = JSON.stringify({ type: 'hapticPushed' });
        for (const conn of targets) conn.send(msg);
      } else if (event.type === 'acceptInterface') {
        const userId = this.connectionUserMap.get(sender.id);
        if (!userId) return;
        const msg = JSON.stringify({ type: 'interfaceAccepted', userId, interfaceName: event.interfaceName });
        for (const conn of this.room.getConnections()) {
          if (this.adminConnectionIds.has(conn.id)) conn.send(msg);
        }
      } else if (event.type === 'setOwnValenceDisplay') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        this.ownValenceDisplay = event.mode;
        this.room.broadcast(JSON.stringify({ type: 'ownValenceDisplayChanged', ownValenceDisplay: this.ownValenceDisplay }));
      } else if (event.type === 'setValenceInputMode') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        this.valenceInputMode = event.mode;
        this.room.broadcast(JSON.stringify({ type: 'valenceInputModeChanged', valenceInputMode: this.valenceInputMode }));
      } else if (event.type === 'setDefaultCursorColor') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        this.defaultCursorColor = event.color;
        this.room.broadcast(JSON.stringify({ type: 'defaultCursorColorChanged', defaultCursorColor: this.defaultCursorColor }));
      } else if (event.type === 'setColorCursorsByVote') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        this.colorCursorsByVote = event.enabled;
        this.room.broadcast(JSON.stringify({ type: 'colorCursorsByVoteChanged', colorCursorsByVote: this.colorCursorsByVote }));
      } else if (event.type === 'registerCustomAvatar') {
        this.customAvatars.set(event.userId, event.photoUrl);
        this.room.broadcast(JSON.stringify({ type: 'customAvatarsChanged', customAvatars: Object.fromEntries(this.customAvatars) }));
      } else if (event.type === 'recordInvitations') {
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
      } else if (event.type === 'strokeSegment') {
        this.room.broadcast(message);
      } else if (event.type === 'clearSignature') {
        this.room.broadcast(JSON.stringify({ type: 'signatureCleared', userId: event.userId }));
      } else if (event.type === 'stenoStartRecording') {
        if (this.stenoLockUserId !== null && this.stenoLockUserId !== event.userId) {
          sender.send(JSON.stringify({ type: 'stenoLockDenied', lockHolderUserId: this.stenoLockUserId }));
          return;
        }
        this.stenoLockUserId = event.userId;
        this.room.broadcast(JSON.stringify({ type: 'stenoLockAcquired', userId: event.userId }));
      } else if (event.type === 'stenoStopRecording') {
        if (this.stenoLockUserId !== event.userId) return;
        this.stenoLockUserId = null;
        this.room.broadcast(JSON.stringify({ type: 'stenoLockReleased', userId: event.userId }));
      } else if (event.type === 'stenoAppendText') {
        if (this.stenoLockUserId !== event.userId) return;
        this.stenoVtt += '\n' + event.text + '\n';
        this.room.broadcast(JSON.stringify({ type: 'stenoTextChanged', text: this.stenoVtt }));
        void this.persistState();
      } else if (event.type === 'stenoSetText') {
        if (this.stenoLockUserId !== null && this.stenoLockUserId !== event.userId) return;
        this.stenoVtt = event.text;
        this.room.broadcast(JSON.stringify({ type: 'stenoTextChanged', text: this.stenoVtt }));
        void this.persistState();
      } else if (event.type === 'storyTracerSetPoints') {
        this.storyTracerPoints = event.points;
        this.storyTracerMeta = event.meta;
        void this.persistState();
        this.room.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: event.points, meta: event.meta }));
      } else if (event.type === 'storyTracerClearPoints') {
        this.storyTracerPoints = null;
        this.storyTracerMeta = null;
        void this.persistState();
        this.room.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: null, meta: null }));
      } else if (event.type === 'mapProjectionSet') {
        this.mapProjection = event.projection;
        void this.persistState();
        this.room.broadcast(JSON.stringify({ type: 'mapProjectionChanged', projection: event.projection }));
      } else if (event.type === 'mapProjectionClear') {
        this.mapProjection = null;
        void this.persistState();
        this.room.broadcast(JSON.stringify({ type: 'mapProjectionChanged', projection: null }));
      } else if (event.type === 'joinCallQueue') {
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
      } else if (event.type === 'leaveCallQueue') {
        const senderId = this.connectionUserMap.get(sender.id);
        if (!senderId) return;
        const idx = this.callQueue.indexOf(senderId);
        if (idx !== -1) this.callQueue.splice(idx, 1);
      } else if (event.type === 'webrtcOffer' || event.type === 'webrtcAnswer' || event.type === 'webrtcIce') {
        const senderId = this.connectionUserMap.get(sender.id);
        if (!senderId) return;
        const parsed = JSON.parse(message) as Record<string, unknown>;
        for (const conn of this.getTargetConnections(event.targetUserId)) {
          conn.send(JSON.stringify({ ...parsed, fromUserId: senderId }));
        }
      } else if (event.type === 'hangUp') {
        const senderId = this.connectionUserMap.get(sender.id);
        if (!senderId) return;
        this.callPairs.delete(senderId);
        const peerId = event.targetUserId;
        this.callPairs.delete(peerId);
        for (const conn of this.getTargetConnections(peerId)) {
          conn.send(JSON.stringify({ type: 'hangUp', fromUserId: senderId }));
        }
      } else if (event.type === 'setCallAlgorithm') {
        if (this.adminConnectionIds.has(sender.id)) {
          this.callAlgorithm = event.algorithm;
        }
      } else if (event.type === 'setArrivalCapacity') {
        if (!this.adminConnectionIds.has(sender.id)) return;
        this.arrivalCapacity = event.capacity;
        this.room.broadcast(JSON.stringify({ type: 'arrivalCapacityChanged', capacity: this.arrivalCapacity }));
      } else if (event.type === 'neighborEdge') {
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
      } else if (event.type === 'requestNeighborEdges') {
        const edges = [...this.neighborEdges].map(e => { const [userA, userB] = e.split('|'); return { userA, userB }; });
        const allCodes = Object.fromEntries(this.neighborCodes);
        sender.send(JSON.stringify({ type: 'neighborEdgesSnapshot', edges, allCodes }));
      } else if (event.type === 'clearNeighborEdges') {
        this.neighborEdges.clear();
        this.room.broadcast(JSON.stringify({ type: 'neighborEdgesCleared' }));
      } else if (event.type === 'setLightColor') {
        this.lightColor = { color: event.color, brightness: event.brightness };
        this.room.broadcast(JSON.stringify({ type: 'lightColor', color: event.color, brightness: event.brightness }));
      }
    } catch (e) {
      console.error('Failed to parse event:', e);
    }
  }

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
