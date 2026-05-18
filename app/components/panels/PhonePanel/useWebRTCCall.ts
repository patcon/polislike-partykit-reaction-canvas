import { useRef, useState, useCallback } from 'react';

export type CallState = 'idle' | 'queued' | 'connecting' | 'connected' | 'reconnecting';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useWebRTCCall(
  sendRef: React.MutableRefObject<(msg: object) => void>,
  localStream: MediaStream | null,
) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [rtcConnectionState, setRtcConnectionState] = useState<string>('—');
  const [iceConnectionState, setIceConnectionState] = useState<string>('—');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;

  const closePc = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    setPeerId(null);
    peerIdRef.current = null;
    setCallState('idle');
    setRtcConnectionState('—');
    setIceConnectionState('—');
  }, []);

  const createPc = useCallback((peer: string) => {
    const outStream = new MediaStream();
    setRemoteStream(outStream);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;
    peerIdRef.current = peer;
    setPeerId(peer);

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
    }

    pc.ontrack = (e) => {
      for (const stream of e.streams) {
        for (const track of stream.getTracks()) {
          if (!outStream.getTracks().includes(track)) outStream.addTrack(track);
        }
      }
      setRemoteStream(new MediaStream(outStream.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendRef.current({ type: 'webrtcIce', targetUserId: peer, candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      setRtcConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePc();
      }
    };

    pc.oniceconnectionstatechange = () => {
      setIceConnectionState(pc.iceConnectionState);
    };

    return pc;
  }, [sendRef, closePc]);

  const joinQueue = useCallback(() => {
    sendRef.current({ type: 'joinCallQueue' });
  }, [sendRef]);

  const cancelQueue = useCallback(() => {
    sendRef.current({ type: 'leaveCallQueue' });
    setCallState('idle');
  }, [sendRef]);

  const hangUp = useCallback(() => {
    if (peerIdRef.current) {
      sendRef.current({ type: 'hangUp', targetUserId: peerIdRef.current });
    }
    closePc();
  }, [sendRef, closePc]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  const handleServerMessage = useCallback(async (data: Record<string, unknown>) => {
    if (data.type === 'callQueued') {
      setCallState('queued');
    } else if (data.type === 'callPaired') {
      const peer = data.peerId as string;
      const role = data.role as 'initiator' | 'receiver';
      setCallState('connecting');
      const pc = createPc(peer);
      if (role === 'initiator') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendRef.current({ type: 'webrtcOffer', targetUserId: peer, offer: { type: offer.type, sdp: offer.sdp } });
      }
    } else if (data.type === 'webrtcOffer') {
      const peer = data.fromUserId as string;
      const offer = data.offer as RTCSessionDescriptionInit;
      const pc = pcRef.current ?? createPc(peer);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendRef.current({ type: 'webrtcAnswer', targetUserId: peer, answer: { type: answer.type, sdp: answer.sdp } });
    } else if (data.type === 'webrtcAnswer') {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit));
      }
    } else if (data.type === 'webrtcIce') {
      if (pcRef.current && data.candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
      }
    } else if (data.type === 'peerReconnecting') {
      setCallState('reconnecting');
    } else if (data.type === 'callResumed') {
      const peer = data.peerId as string;
      if (pcRef.current) {
        // PC still exists — WebRTC survived (may be 'disconnected' transiently, not yet 'failed').
        // Restore UI state; onconnectionstatechange will call closePc() if it truly fails.
        peerIdRef.current = peer;
        setPeerId(peer);
        setCallState('connected');
      } else {
        // closePc() already ran (connection went 'failed') — inform server and stay idle
        sendRef.current({ type: 'hangUp', targetUserId: peer });
      }
    } else if (data.type === 'hangUp') {
      closePc();
    }
  }, [createPc, sendRef, closePc]);

  return { callState, peerId, remoteStream, isMuted, rtcConnectionState, iceConnectionState, joinQueue, cancelQueue, hangUp, toggleMute, handleServerMessage };
}
