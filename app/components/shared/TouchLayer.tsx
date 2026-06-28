import { useRef, useEffect, useState } from "react";
import { computeReactionRegion, DEFAULT_ANCHORS } from "../../utils/voteRegion";
import { CURSOR_THROTTLE_MS } from "../../utils/cursor";
import { useRoomSocket } from "../../contexts/RoomSocketContext";
import type { ReactionAnchors } from "../../utils/voteRegion";

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

type ReactionState = 'positive' | 'negative' | 'neutral' | null;

interface TouchLayerProps {
  onReactionStateChange: (reactionState: ReactionState) => void;
  userId: string;
  reactionStateRef?: React.MutableRefObject<ReactionState>;
  onBackgroundColorChange: (reactionState: ReactionState) => void;
  heightOffset?: number; // Pixels to subtract from window.innerHeight (default: statement panel height)
  onTouchPosition?: (pos: { x: number; y: number } | null) => void; // Pixel coords relative to layer
  getTimecode?: () => number; // Returns current video timecode to send on lift
  anchors?: ReactionAnchors;
  onCursorEvent?: (type: 'move' | 'touch' | 'remove', pos: { x: number; y: number }) => void;
  imageUrl?: string; // When set, normalize coordinates relative to displayed image bounds
  disabled?: boolean; // When true, ignores all pointer events
  autoSize?: boolean; // When true, normalize against this layer's own size (ResizeObserver) instead of the window. For embedding in constrained containers (e.g. demo phone frames). Ignores heightOffset.
  throttleMs?: number; // Min ms between cursor sends (0 = no throttle)
}

export default function TouchLayer({
  onReactionStateChange,
  userId,
  reactionStateRef,
  onBackgroundColorChange,
  heightOffset,
  onTouchPosition,
  getTimecode,
  anchors,
  onCursorEvent,
  imageUrl,
  disabled = false,
  autoSize = false,
  throttleMs = CURSOR_THROTTLE_MS,
}: TouchLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const throttleMsRef = useRef(throttleMs);
  throttleMsRef.current = throttleMs;
  const lastSentRef = useRef(0);
  const [userReactionState, setUserReactionState] = useState<ReactionState>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - (heightOffset ?? 140)
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!imageUrl) { setImageNaturalSize(null); return; }
    const img = new Image();
    img.onload = () => setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setImageNaturalSize(null);
    img.src = imageUrl;
  }, [imageUrl]);
  const lastTouchTimeRef = useRef(0); // Used to suppress synthesized mouse events after touch
  const currentReactionStateRef = useRef<ReactionState>(null);
  const lastPositionRef = useRef<CursorPosition | null>(null);

  const { send } = useRoomSocket();

  const sendCursorEvent = (type: CursorEvent['type'], position: CursorPosition) => {
    if (type !== 'remove' && throttleMsRef.current > 0) {
      const now = Date.now();
      if (now - lastSentRef.current < throttleMsRef.current) return;
      lastSentRef.current = now;
    }
    const event: CursorEvent = { type, position };
    send(JSON.stringify(event));
  };

  const sendTimecode = () => {
    if (getTimecode) {
      send(JSON.stringify({ type: 'setTimecode', timecode: getTimecode() }));
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

  // Returns the pointer position in the layer's OWN coordinate space (CSS px before
  // any CSS `zoom`). getBoundingClientRect() is zoom-scaled but clientWidth/Height
  // are not, so scaling by their ratio (the zoom factor; 1 when not zoomed) converts
  // the screen-space pointer into the same space the layer lays out its children and
  // measures `dimensions` in. This keeps the normalized math and the absolutely-
  // positioned touch indicator aligned with the pointer at any zoom level.
  const getPixelPosition = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const layer = layerRef.current;
    if (!layer) return null;
    const rect = layer.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      const touch = (e.touches && e.touches.length > 0) ? e.touches[0] :
                   (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const scaleX = rect.width ? layer.clientWidth / rect.width : 1;
    const scaleY = rect.height ? layer.clientHeight / rect.height : 1;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const getCursorPosition = (e: React.MouseEvent | React.TouchEvent): CursorPosition => {
    const pixel = getPixelPosition(e);
    if (!pixel) return { x: 0, y: 0, timestamp: Date.now(), userId };

    const pixelX = pixel.x;
    const pixelY = pixel.y;

    let normalizedX: number;
    let normalizedY: number;

    if (imageUrl && imageNaturalSize) {
      // Normalize relative to displayed image bounds (object-fit: contain letterboxing)
      const scale = Math.min(dimensions.width / imageNaturalSize.w, dimensions.height / imageNaturalSize.h);
      const dispW = imageNaturalSize.w * scale;
      const dispH = imageNaturalSize.h * scale;
      const offX = (dimensions.width - dispW) / 2;
      const offY = (dimensions.height - dispH) / 2;
      normalizedX = ((pixelX - offX) / dispW) * 100;
      normalizedY = ((pixelY - offY) / dispH) * 100;
    } else {
      normalizedX = (pixelX / dimensions.width) * 100;
      normalizedY = (pixelY / dimensions.height) * 100;
    }

    return {
      x: normalizedX,
      y: normalizedY,
      timestamp: Date.now(),
      userId
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Ignore synthesized mouse events that browsers fire ~300ms after a touch interaction.
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    const position = getCursorPosition(e);
    lastPositionRef.current = position;
    setIsMouseOver(true);
    sendCursorEvent('move', position);
    onCursorEvent?.('move', { x: position.x, y: position.y });
    onTouchPosition?.(getPixelPosition(e));

    // Update reaction state based on cursor position
    const reactionState = computeReactionRegion(position.x, position.y, anchors ?? DEFAULT_ANCHORS);
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
    onCursorEvent?.('remove', { x: 0, y: 0 });
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
    onCursorEvent?.('touch', { x: position.x, y: position.y });
    onTouchPosition?.(getPixelPosition(e));

    // Update reaction state without triggering React re-render during drag
    const reactionState = computeReactionRegion(position.x, position.y, anchors ?? DEFAULT_ANCHORS);
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
    onCursorEvent?.('touch', { x: position.x, y: position.y });
    onTouchPosition?.(getPixelPosition(e));

    const reactionState = computeReactionRegion(position.x, position.y, anchors ?? DEFAULT_ANCHORS);
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
    onCursorEvent?.('remove', { x: 0, y: 0 });

    currentReactionStateRef.current = null;
    if (reactionStateRef) reactionStateRef.current = null;
    setUserReactionState(null);
    onBackgroundColorChange(null);
    onReactionStateChange(null);
  };

  // Handle resize. In autoSize mode, normalize against this layer's own box (for
  // embedding in constrained containers like the demo phone frames); otherwise
  // track the window.
  useEffect(() => {
    if (autoSize) {
      const layer = layerRef.current;
      if (!layer) return;
      const measure = () => {
        setDimensions({ width: layer.clientWidth, height: layer.clientHeight });
      };
      const observer = new ResizeObserver(measure);
      observer.observe(layer);
      measure(); // Initial call
      return () => observer.disconnect();
    }

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
  }, [heightOffset, autoSize]);

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
        pointerEvents: disabled ? 'none' : 'auto',
        backgroundColor: 'transparent' // Completely transparent
      }}
      onMouseMove={disabled ? undefined : handleMouseMove}
      onMouseLeave={disabled ? undefined : handleMouseLeave}
      onTouchStart={disabled ? undefined : handleTouchStart}
      onTouchMove={disabled ? undefined : handleTouchMove}
      onTouchEnd={disabled ? undefined : handleTouchEnd}
      onTouchCancel={disabled ? undefined : handleTouchEnd}
    />
  );
}
