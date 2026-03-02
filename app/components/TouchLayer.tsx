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

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

interface TouchLayerProps {
  room: string;
  onActiveStatementChange: (statementId: number) => void;
  onReactionStateChange: (reactionState: ReactionState) => void;
  userId: string;
  reactionStateRef?: React.MutableRefObject<ReactionState>;
  onBackgroundColorChange: (reactionState: ReactionState) => void;
  heightOffset?: number; // Pixels to subtract from window.innerHeight (default: statement panel height)
  onTouchPosition?: (pos: { x: number; y: number } | null) => void; // Pixel coords relative to layer
  getTimecode?: () => number; // Returns current video timecode to send on lift
}

export default function TouchLayer({
  room,
  onActiveStatementChange,
  onReactionStateChange,
  userId,
  reactionStateRef,
  onBackgroundColorChange,
  heightOffset,
  onTouchPosition,
  getTimecode,
}: TouchLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [userReactionState, setUserReactionState] = useState<ReactionState>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - (heightOffset ?? 140)
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const lastTouchTimeRef = useRef(0); // Used to suppress synthesized mouse events after touch
  const currentReactionStateRef = useRef<ReactionState>(null);
  const lastPositionRef = useRef<CursorPosition | null>(null);

  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    query: { userId },
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

  const sendTimecode = () => {
    if (getTimecode) {
      socket.send(JSON.stringify({ type: 'setTimecode', timecode: getTimecode() }));
    }
  };

  // Heartbeat: re-send position every 2s while holding still, so Canvas's 3s staleness
  // timeout doesn't remove the cursor and incorrectly signal that the user lifted their finger.
  // Covers both touch (isDragging) and mouse hover (isMouseOver, for desktop debugging).
  useEffect(() => {
    if (!isDragging && !isMouseOver) return;
    const interval = setInterval(() => {
      if (lastPositionRef.current) {
        sendCursorEvent('touch', { ...lastPositionRef.current, timestamp: Date.now() });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isDragging, isMouseOver]);

  const getPixelPosition = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const layer = layerRef.current;
    if (!layer) return null;
    const rect = layer.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches.length > 0 ? e.touches[0] : e.changedTouches[0] ?? null;
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

  const getReactionFromPosition = (normalizedX: number, normalizedY: number): ReactionState => {
    // Input coordinates are already normalized (0-100), convert to 0-1 range for calculations
    const x = normalizedX / 100;
    const y = normalizedY / 100;

    // Define triangle vertices based on reaction label positions
    // POSITIVE: top-right, NEGATIVE: bottom-left, NEUTRAL: bottom-right
    const positive = { x: 1, y: 0 };  // top-right
    const negative = { x: 0, y: 1 };  // bottom-left
    const neutral  = { x: 1, y: 1 };  // bottom-right

    // Calculate barycentric coordinates for the triangle
    // This gives us the proportional "weight" of each vertex for any point in the triangle
    const denominator = (negative.y - neutral.y) * (positive.x - neutral.x) + (neutral.x - negative.x) * (positive.y - neutral.y);

    // Avoid division by zero (degenerate triangle)
    if (Math.abs(denominator) < 1e-10) {
      // Fallback to simple distance if triangle is degenerate
      const distanceToPositive = Math.sqrt(Math.pow(x - positive.x, 2) + Math.pow(y - positive.y, 2));
      const distanceToNegative = Math.sqrt(Math.pow(x - negative.x, 2) + Math.pow(y - negative.y, 2));
      const distanceToNeutral  = Math.sqrt(Math.pow(x - neutral.x,  2) + Math.pow(y - neutral.y,  2));

      const minDistance = Math.min(distanceToPositive, distanceToNegative, distanceToNeutral);
      if (minDistance === distanceToPositive) return 'positive';
      if (minDistance === distanceToNegative) return 'negative';
      if (minDistance === distanceToNeutral)  return 'neutral';
      return null;
    }

    // Calculate barycentric coordinates (weights for each vertex)
    const wPositive = ((negative.y - neutral.y) * (x - neutral.x) + (neutral.x - negative.x) * (y - neutral.y)) / denominator;
    const wNegative = ((neutral.y - positive.y) * (x - neutral.x) + (positive.x - neutral.x) * (y - neutral.y)) / denominator;
    const wNeutral  = 1 - wPositive - wNegative;

    // The vertex with the highest weight is the closest in terms of triangle geometry
    const maxWeight = Math.max(wPositive, wNegative, wNeutral);

    // Simply return the option with highest weight - no dead zones
    if (maxWeight === wPositive) return 'positive';
    if (maxWeight === wNegative) return 'negative';
    if (maxWeight === wNeutral)  return 'neutral';

    return null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Ignore synthesized mouse events that browsers fire ~300ms after a touch interaction.
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    const position = getCursorPosition(e);
    lastPositionRef.current = position;
    setIsMouseOver(true);
    sendCursorEvent('move', position);
    onTouchPosition?.(getPixelPosition(e));

    // Update reaction state based on cursor position
    const reactionState = getReactionFromPosition(position.x, position.y);
    setUserReactionState(reactionState);
    currentReactionStateRef.current = reactionState;
    if (reactionStateRef) reactionStateRef.current = reactionState;
    onReactionStateChange(reactionState);
    onBackgroundColorChange(reactionState);
  };

  const handleMouseLeave = () => {
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    setIsMouseOver(false);
    lastPositionRef.current = null;
    sendTimecode();
    // Send remove event when mouse leaves the canvas
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);
    onTouchPosition?.(null);

    // Reset reaction state when mouse leaves
    setUserReactionState(null);
    currentReactionStateRef.current = null;
    if (reactionStateRef) reactionStateRef.current = null;
    onReactionStateChange(null);
    onBackgroundColorChange(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const position = getCursorPosition(e);
    lastPositionRef.current = position;
    sendCursorEvent('touch', position);
    onTouchPosition?.(getPixelPosition(e));

    // Update reaction state without triggering React re-render during drag
    const reactionState = getReactionFromPosition(position.x, position.y);
    currentReactionStateRef.current = reactionState;
    if (reactionStateRef) reactionStateRef.current = reactionState;
    onBackgroundColorChange(reactionState);
    // Don't call setUserReactionState or onReactionStateChange during drag to avoid interrupting touch
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    setIsDragging(true);
    const position = getCursorPosition(e);
    lastPositionRef.current = position;
    sendCursorEvent('touch', position);
    onTouchPosition?.(getPixelPosition(e));

    const reactionState = getReactionFromPosition(position.x, position.y);
    currentReactionStateRef.current = reactionState;
    if (reactionStateRef) reactionStateRef.current = reactionState;
    onBackgroundColorChange(reactionState);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    setIsDragging(false);
    lastPositionRef.current = null;
    sendTimecode();
    onTouchPosition?.(null);

    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);

    currentReactionStateRef.current = null;
    if (reactionStateRef) reactionStateRef.current = null;
    setUserReactionState(null);
    onBackgroundColorChange(null);
    onReactionStateChange(null);
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const offset = heightOffset ?? (window.innerWidth <= 768 ? 120 : 140);
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - offset
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, [heightOffset]);

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
