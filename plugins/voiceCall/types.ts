export type VoiceCallPluginState = {
  callQueue: string[];
  callPairs: Map<string, string>;
  callAlgorithm: string;
};

export interface JoinCallQueueEvent      { type: 'joinCallQueue' }
export interface LeaveCallQueueEvent     { type: 'leaveCallQueue' }
export interface WebRTCOfferEvent        { type: 'webrtcOffer';  targetUserId: string; offer: unknown }
export interface WebRTCAnswerEvent       { type: 'webrtcAnswer'; targetUserId: string; answer: unknown }
export interface WebRTCIceEvent          { type: 'webrtcIce';    targetUserId: string; candidate: unknown }
export interface HangUpCallEvent         { type: 'hangUp';       targetUserId: string }
export interface SetCallAlgorithmEvent   { type: 'setCallAlgorithm'; algorithm: string }
