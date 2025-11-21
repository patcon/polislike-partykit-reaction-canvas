import { useState, useEffect, useRef, useCallback } from 'react';
import { path } from 'ghost-cursor';

interface TimedVector {
  x: number;
  y: number;
  timestamp: number;
}

interface GhostCursor {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isAnimating: boolean;
  animationStartTime: number;
  route: TimedVector[];
  routeIndex: number;
}

interface VoteArea {
  name: 'agree' | 'disagree' | 'pass';
  x: number;
  y: number;
}

interface UseGhostCursorsProps {
  enabled: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onNewStatement?: () => void;
  socket?: any; // PartyKit socket for sending fake cursor events
}

export function useGhostCursors({
  enabled,
  canvasWidth,
  canvasHeight,
  onNewStatement,
  socket
}: UseGhostCursorsProps) {
  const [ghostCursors, setGhostCursors] = useState<GhostCursor[]>([]);
  const animationFrameRef = useRef<number>();
  const lastStatementChangeRef = useRef<number>(0);

  // Define vote areas based on CSS positioning
  const voteAreas: VoteArea[] = [
    { name: 'agree', x: canvasWidth - 30, y: 30 }, // top-right
    { name: 'disagree', x: 30, y: canvasHeight - 110 }, // bottom-left  
    { name: 'pass', x: canvasWidth - 30, y: canvasHeight - 110 } // bottom-right
  ];

  // Generate random entry points from sides of canvas
  const getRandomEntryPoint = (): { x: number; y: number } => {
    const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left

    switch (side) {
      case 0: // top
        return { x: Math.random() * canvasWidth, y: -20 };
      case 1: // right
        return { x: canvasWidth + 20, y: Math.random() * canvasHeight };
      case 2: // bottom
        return { x: Math.random() * canvasWidth, y: canvasHeight + 20 };
      case 3: // left
      default:
        return { x: -20, y: Math.random() * canvasHeight };
    }
  };

  // Get random vote area
  const getRandomVoteArea = (): VoteArea => {
    return voteAreas[Math.floor(Math.random() * voteAreas.length)];
  };

  // Initialize ghost cursors
  const initializeGhostCursors = useCallback(() => {
    if (!enabled || canvasWidth === 0 || canvasHeight === 0) return;

    const cursors: GhostCursor[] = [];

    for (let i = 0; i < 10; i++) {
      const entryPoint = getRandomEntryPoint();
      const targetArea = getRandomVoteArea();

      // Generate path using ghost-cursor
      const route = path(entryPoint, targetArea, { useTimestamps: true }) as TimedVector[];

      cursors.push({
        id: `ghost-${i}`,
        x: entryPoint.x,
        y: entryPoint.y,
        targetX: targetArea.x,
        targetY: targetArea.y,
        isAnimating: false,
        animationStartTime: 0,
        route,
        routeIndex: 0
      });
    }

    setGhostCursors(cursors);
  }, [enabled, canvasWidth, canvasHeight]);

  // Move cursors to new random vote areas
  const moveToNewVoteAreas = useCallback(() => {
    if (!enabled) return;

    setGhostCursors(prevCursors => 
      prevCursors.map(cursor => {
        const currentPos = { x: cursor.x, y: cursor.y };
        const newTarget = getRandomVoteArea();

        // Generate new path from current position to new target
        const route = path(currentPos, newTarget, { useTimestamps: true }) as TimedVector[];

        return {
          ...cursor,
          targetX: newTarget.x,
          targetY: newTarget.y,
          isAnimating: true,
          animationStartTime: Date.now(),
          route,
          routeIndex: 0
        };
      })
    );
  }, [enabled]);

  // Send cursor position to PartyKit server
  const sendGhostCursorToServer = useCallback((cursor: GhostCursor) => {
    if (!socket) return;

    // Convert pixel coordinates to normalized coordinates (0-100)
    const normalizedX = (cursor.x / canvasWidth) * 100;
    const normalizedY = (cursor.y / canvasHeight) * 100;

    const cursorEvent = {
      type: 'move',
      position: {
        x: normalizedX,
        y: normalizedY,
        timestamp: Date.now(),
        userId: cursor.id
      }
    };

    socket.send(JSON.stringify(cursorEvent));
  }, [socket, canvasWidth, canvasHeight]);

  // Animation loop
  const animate = useCallback(() => {
    if (!enabled) return;

    setGhostCursors(prevCursors =>
      prevCursors.map(cursor => {
        if (!cursor.isAnimating || cursor.routeIndex >= cursor.route.length - 1) {
          return cursor;
        }

        const now = Date.now();
        const elapsed = now - cursor.animationStartTime;

        // Find the appropriate point in the route based on elapsed time
        let targetIndex = cursor.routeIndex;
        for (let i = cursor.routeIndex; i < cursor.route.length; i++) {
          const routePoint = cursor.route[i];
          const routeTime = routePoint.timestamp - cursor.route[0].timestamp;

          if (elapsed >= routeTime) {
            targetIndex = i;
          } else {
            break;
          }
        }

        if (targetIndex !== cursor.routeIndex) {
          const routePoint = cursor.route[targetIndex];
          const updatedCursor = {
            ...cursor,
            x: routePoint.x,
            y: routePoint.y,
            routeIndex: targetIndex,
            isAnimating: targetIndex < cursor.route.length - 1
          };

          // Send position to server
          sendGhostCursorToServer(updatedCursor);

          return updatedCursor;
        }

        return cursor;
      })
    );

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [enabled, sendGhostCursorToServer]);

  // Handle new statement changes
  useEffect(() => {
    if (onNewStatement) {
      const now = Date.now();
      if (now - lastStatementChangeRef.current > 1000) { // Debounce
        lastStatementChangeRef.current = now;
        moveToNewVoteAreas();
      }
    }
  }, [onNewStatement, moveToNewVoteAreas]);

  // Initialize cursors when enabled
  useEffect(() => {
    if (enabled) {
      initializeGhostCursors();
    } else {
      setGhostCursors([]);
    }
  }, [enabled, initializeGhostCursors]);

  // Start/stop animation loop
  useEffect(() => {
    if (enabled && ghostCursors.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, ghostCursors.length, animate]);

  // Trigger movement on new statements
  const triggerMovement = useCallback(() => {
    moveToNewVoteAreas();
  }, [moveToNewVoteAreas]);

  return {
    ghostCursors,
    triggerMovement
  };
}