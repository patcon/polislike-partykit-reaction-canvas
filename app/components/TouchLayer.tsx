import { useRef, useEffect, useState } from "react";
import usePartySocket from "partysocket/react";

interface CursorPosition {
  x: number; // Normalized coordinates (0-100)
  y: number; // Normalized coordinates (0-100)
  timestamp: number;
  userId: string;
}

interface CursorEvent {
  type: 'move' | 'touch' | 'remove';
  position: CursorPosition;
}

interface ServerMessage {
  type: 'connected' | 'activeStatementChanged';
  connectionId?: string;
  activeStatementId?: number;
  statementId?: number;
}

type VoteState = 'agree' | 'disagree' | 'pass' | null;

interface TouchLayerProps {
  room: string;
  onActiveStatementChange: (statementId: number) => void;
  onVoteStateChange: (voteState: VoteState) => void;
  userId: string;
  voteStateRef?: React.MutableRefObject<VoteState>;
  onBackgroundColorChange: (voteState: VoteState) => void;
}

export default function TouchLayer({ 
  room, 
  onActiveStatementChange, 
  onVoteStateChange, 
  userId, 
  voteStateRef,
  onBackgroundColorChange
}: TouchLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [userVoteState, setUserVoteState] = useState<VoteState>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 140 // Canvas height is viewport minus statement panel height
  });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMovedDuringTouch, setHasMovedDuringTouch] = useState(false);
  const currentVoteStateRef = useRef<VoteState>(null);

  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        // Handle server messages (connected, activeStatementChanged)
        if (data.type === 'connected' && data.activeStatementId) {
          onActiveStatementChange(data.activeStatementId);
        } else if (data.type === 'activeStatementChanged') {
          onActiveStatementChange(data.statementId);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
  });

  const sendCursorEvent = (type: CursorEvent['type'], position: CursorPosition) => {
    const event: CursorEvent = { type, position };
    socket.send(JSON.stringify(event));
  };

  const getCursorPosition = (e: React.MouseEvent | React.TouchEvent): CursorPosition => {
    const layer = layerRef.current;
    if (!layer) return { x: 0, y: 0, timestamp: Date.now(), userId };

    const rect = layer.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      // For touch events, prioritize touches over changedTouches for active touches
      // Use the first available touch from either touches or changedTouches
      const touch = (e.touches && e.touches.length > 0) ? e.touches[0] :
                   (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;

      if (!touch) return { x: 0, y: 0, timestamp: Date.now(), userId };

      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convert to normalized coordinates (0-100)
    const pixelX = clientX - rect.left;
    const pixelY = clientY - rect.top;
    const normalizedX = (pixelX / dimensions.width) * 100;
    const normalizedY = (pixelY / dimensions.height) * 100;

    return {
      x: normalizedX,
      y: normalizedY,
      timestamp: Date.now(),
      userId
    };
  };

  const getVoteFromPosition = (normalizedX: number, normalizedY: number): VoteState => {
    // Input coordinates are already normalized (0-100), convert to 0-1 range for calculations
    const x = normalizedX / 100;
    const y = normalizedY / 100;

    // Define triangle vertices based on vote label positions
    // AGREE: top-right, DISAGREE: bottom-left, PASS: bottom-right
    const agree = { x: 1, y: 0 };     // top-right
    const disagree = { x: 0, y: 1 };  // bottom-left
    const pass = { x: 1, y: 1 };      // bottom-right

    // Calculate barycentric coordinates for the triangle
    // This gives us the proportional "weight" of each vertex for any point in the triangle
    const denominator = (disagree.y - pass.y) * (agree.x - pass.x) + (pass.x - disagree.x) * (agree.y - pass.y);

    // Avoid division by zero (degenerate triangle)
    if (Math.abs(denominator) < 1e-10) {
      // Fallback to simple distance if triangle is degenerate
      const distanceToAgree = Math.sqrt(Math.pow(x - agree.x, 2) + Math.pow(y - agree.y, 2));
      const distanceToDisagree = Math.sqrt(Math.pow(x - disagree.x, 2) + Math.pow(y - disagree.y, 2));
      const distanceToPass = Math.sqrt(Math.pow(x - pass.x, 2) + Math.pow(y - pass.y, 2));

      const minDistance = Math.min(distanceToAgree, distanceToDisagree, distanceToPass);
      if (minDistance === distanceToAgree) return 'agree';
      if (minDistance === distanceToDisagree) return 'disagree';
      if (minDistance === distanceToPass) return 'pass';
      return null;
    }

    // Calculate barycentric coordinates (weights for each vertex)
    const wAgree = ((disagree.y - pass.y) * (x - pass.x) + (pass.x - disagree.x) * (y - pass.y)) / denominator;
    const wDisagree = ((pass.y - agree.y) * (x - pass.x) + (agree.x - pass.x) * (y - pass.y)) / denominator;
    const wPass = 1 - wAgree - wDisagree;

    // The barycentric coordinates represent the "influence" or "weight" of each vertex
    // The vertex with the highest weight is the closest in terms of triangle geometry
    const maxWeight = Math.max(wAgree, wDisagree, wPass);

    // Simply return the option with highest weight - no dead zones
    if (maxWeight === wAgree) return 'agree';
    if (maxWeight === wDisagree) return 'disagree';
    if (maxWeight === wPass) return 'pass';

    return null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const position = getCursorPosition(e);
    sendCursorEvent('move', position);

    // Update vote state based on cursor position
    const voteState = getVoteFromPosition(position.x, position.y);
    setUserVoteState(voteState);
    currentVoteStateRef.current = voteState;
    if (voteStateRef) voteStateRef.current = voteState;
    onVoteStateChange(voteState);
    onBackgroundColorChange(voteState);
  };

  const handleMouseLeave = () => {
    // Send remove event when mouse leaves the canvas
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);

    // Reset vote state when mouse leaves
    setUserVoteState(null);
    currentVoteStateRef.current = null;
    if (voteStateRef) voteStateRef.current = null;
    onVoteStateChange(null);
    onBackgroundColorChange(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    // Mark that we've moved during this touch interaction
    setHasMovedDuringTouch(true);

    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);

    // Update vote state without triggering React re-render during drag
    const voteState = getVoteFromPosition(position.x, position.y);
    currentVoteStateRef.current = voteState;
    if (voteStateRef) voteStateRef.current = voteState;
    onBackgroundColorChange(voteState);
    // Don't call setUserVoteState or onVoteStateChange during drag to avoid interrupting touch
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setHasMovedDuringTouch(false);
    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);

    // Store initial vote state but don't trigger re-renders during touch start
    const voteState = getVoteFromPosition(position.x, position.y);
    currentVoteStateRef.current = voteState;
    if (voteStateRef) voteStateRef.current = voteState;
    onBackgroundColorChange(voteState);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);

    // Send remove event when touch ends
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);

    // Reset vote state when touch ends
    currentVoteStateRef.current = null;
    if (voteStateRef) voteStateRef.current = null;
    setUserVoteState(null);
    onBackgroundColorChange(null);
    onVoteStateChange(null);

    setHasMovedDuringTouch(false);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const statementPanelHeight = window.innerWidth <= 768 ? 120 : 140;
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - statementPanelHeight
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={layerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10, // Higher z-index to capture events
        touchAction: 'none',
        cursor: 'default',
        pointerEvents: 'auto',
        backgroundColor: 'transparent' // Completely transparent
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    />
  );
}