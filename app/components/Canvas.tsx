import { useRef, useEffect, useState } from "react";
import usePartySocket from "partysocket/react";
import * as d3 from "d3";

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

interface CanvasProps {
  room: string;
  onActiveStatementChange: (statementId: number) => void;
  onVoteStateChange: (voteState: VoteState) => void;
  userId: string;
}

export default function Canvas({ room, onActiveStatementChange, onVoteStateChange, userId }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
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
        } else if (data.position) {
          // Handle cursor events
          const event: CursorEvent = data;
          if (event && event.position && event.position.userId !== userId) {
            if (event.type === 'remove') {
              // Remove cursor when user leaves or touch ends
              setCursors(prev => {
                const newCursors = new Map(prev);
                newCursors.delete(event.position.userId);
                return newCursors;
              });
            } else {
              // Add or update cursor position
              setCursors(prev => {
                const newCursors = new Map(prev);
                newCursors.set(event.position.userId, event.position);
                return newCursors;
              });

              // Remove old cursor positions after 3 seconds of inactivity
              setTimeout(() => {
                setCursors(prev => {
                  const newCursors = new Map(prev);
                  const cursor = newCursors.get(event.position.userId);
                  if (cursor && cursor.timestamp === event.position.timestamp) {
                    newCursors.delete(event.position.userId);
                  }
                  return newCursors;
                });
              }, 3000);
            }
          }
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
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0, timestamp: Date.now(), userId };

    const rect = svg.getBoundingClientRect();
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

    // Define vote zones using normalized coordinates (0-1 range)
    // Since canvas is now below statement panel, agree zone can be at the top
    const agreeZone = { x: 1, y: 0 }; // top-right
    const disagreeZone = { x: 0, y: 1 }; // bottom-left
    const passZone = { x: 1, y: 1 }; // bottom-right

    // Calculate distances to each zone using normalized coordinates
    const distanceToAgree = Math.sqrt(Math.pow(x - agreeZone.x, 2) + Math.pow(y - agreeZone.y, 2));
    const distanceToDisagree = Math.sqrt(Math.pow(x - disagreeZone.x, 2) + Math.pow(y - disagreeZone.y, 2));
    const distanceToPass = Math.sqrt(Math.pow(x - passZone.x, 2) + Math.pow(y - passZone.y, 2));

    // Find the closest zone
    const minDistance = Math.min(distanceToAgree, distanceToDisagree, distanceToPass);

    if (minDistance === distanceToAgree) return 'agree';
    if (minDistance === distanceToDisagree) return 'disagree';
    if (minDistance === distanceToPass) return 'pass';

    return null;
  };


  const handleMouseMove = (e: React.MouseEvent) => {
    const position = getCursorPosition(e);
    sendCursorEvent('move', position);

    // Update vote state based on cursor position
    const voteState = getVoteFromPosition(position.x, position.y);
    setUserVoteState(voteState);
    onVoteStateChange(voteState);
  };

  const handleMouseLeave = () => {
    // Send remove event when mouse leaves the canvas
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);

    // Reset vote state when mouse leaves
    setUserVoteState(null);
    onVoteStateChange(null);
  };

  // Direct DOM manipulation to avoid re-renders during touch
  const updateBackgroundColor = (voteState: VoteState) => {
    const svg = d3.select(svgRef.current);
    const backgroundRect = svg.select('rect');

    let backgroundColor = 'rgba(255, 255, 255, 0.1)';
    if (voteState === 'agree') {
      backgroundColor = 'rgba(0, 255, 0, 0.2)';
    } else if (voteState === 'disagree') {
      backgroundColor = 'rgba(255, 0, 0, 0.2)';
    } else if (voteState === 'pass') {
      backgroundColor = 'rgba(255, 255, 0, 0.2)';
    }

    backgroundRect.attr('fill', backgroundColor);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    // Mark that we've moved during this touch interaction
    setHasMovedDuringTouch(true);

    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);

    // Update vote state without triggering React re-render
    const voteState = getVoteFromPosition(position.x, position.y);
    currentVoteStateRef.current = voteState;
    updateBackgroundColor(voteState);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setHasMovedDuringTouch(false);
    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);

    // Don't update vote state on touch start - only during actual dragging
    // This prevents flash/lock behavior on simple taps
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);

    // Send remove event when touch ends
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);

    // Always reset vote state when touch ends
    // For taps (no movement), this ensures state goes back to null
    // For drags, this also resets to null after the interaction
    currentVoteStateRef.current = null;
    setUserVoteState(null);
    updateBackgroundColor(null);
    onVoteStateChange(null);

    setHasMovedDuringTouch(false);
  };

  // Render with D3 SVG
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Add background rectangle with default color
    // Color will be updated via direct DOM manipulation during interactions
    svg.append('rect')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('fill', 'rgba(255, 255, 255, 0.1)'); // Default transparent white

    // Apply current vote state color if any
    const currentVoteState = currentVoteStateRef.current || userVoteState;
    if (currentVoteState) {
      updateBackgroundColor(currentVoteState);
    }

    // Vote labels are now handled outside the Canvas component
    // No need to render them here anymore

    // Add cursor positions as colored dots - convert normalized coordinates to pixels
    const cursorData = Array.from(cursors.entries()).map(([cursorUserId, cursor]) => ({
      cursorUserId,
      x: (cursor.x / 100) * dimensions.width, // Convert from 0-100 to pixel coordinates
      y: (cursor.y / 100) * dimensions.height, // Convert from 0-100 to pixel coordinates
      timestamp: cursor.timestamp,
      userId: cursor.userId
    }));

    const cursorGroups = svg.selectAll('.cursor-group')
      .data(cursorData, (d: any) => d.cursorUserId)
      .enter()
      .append('g')
      .attr('class', 'cursor-group');

    // Add cursor circles with responsive radius
    const cursorRadius = Math.min(dimensions.width, dimensions.height) * 0.01; // 1% of smaller dimension
    cursorGroups.append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', cursorRadius)
      .attr('fill', (d: any) => {
        // Generate a consistent color for each user
        const hue = d.cursorUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 360;
        return `hsl(${hue}, 70%, 50%)`;
      });

    // Add user ID labels with responsive font size and positioning
    const cursorLabelFontSize = Math.min(dimensions.width, dimensions.height) * 0.015; // 1.5% of smaller dimension
    const labelOffset = Math.min(dimensions.width, dimensions.height) * 0.015; // Responsive offset
    cursorGroups.append('text')
      .attr('x', (d: any) => d.x + labelOffset)
      .attr('y', (d: any) => d.y - labelOffset * 0.5)
      .attr('font-family', 'sans-serif')
      .attr('font-size', `${cursorLabelFontSize}px`)
      .attr('fill', '#000')
      .text((d: any) => d.cursorUserId.substring(0, 6));

  }, [cursors, userVoteState, dimensions]);

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
    <svg
      ref={svgRef}
      width={dimensions.width}
      height={dimensions.height}
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'none',
        cursor: 'default',
        pointerEvents: 'auto'
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