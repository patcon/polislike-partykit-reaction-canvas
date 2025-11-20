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
}

export default function Canvas({ room, onActiveStatementChange }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [userVoteState, setUserVoteState] = useState<VoteState>(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 120 // Account for statement panel height
  });

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
  };

  const handleMouseLeave = () => {
    // Send remove event when mouse leaves the canvas
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);

    // Reset vote state when mouse leaves
    setUserVoteState(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);

    // Update vote state based on touch position
    const voteState = getVoteFromPosition(position.x, position.y);
    setUserVoteState(voteState);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);

    // Update vote state based on touch position
    const voteState = getVoteFromPosition(position.x, position.y);
    setUserVoteState(voteState);
  };

  const handleTouchEnd = () => {
    // Send remove event when touch ends
    const position: CursorPosition = { x: 0, y: 0, timestamp: Date.now(), userId };
    sendCursorEvent('remove', position);

    // Reset vote state when touch ends
    setUserVoteState(null);
  };

  // Render with D3 SVG
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Set background color based on vote state
    let backgroundColor = 'rgba(255, 255, 255, 0.1)'; // Default transparent white
    if (userVoteState === 'agree') {
      backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Green with transparency
    } else if (userVoteState === 'disagree') {
      backgroundColor = 'rgba(255, 0, 0, 0.2)'; // Red with transparency
    } else if (userVoteState === 'pass') {
      backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Yellow with transparency
    }

    // Add background rectangle
    svg.append('rect')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('fill', backgroundColor);

    // Add vote labels in corners using responsive positioning and sizing
    const baseFontSize = Math.min(dimensions.width, dimensions.height) * 0.03; // 3% of smaller dimension
    const labels = [
      {
        text: 'AGREE',
        x: dimensions.width * 0.9, // 90% from left
        y: dimensions.height * 0.1, // 10% from top (canvas now starts below statement panel)
        color: '#000000' // Solid black
      },
      {
        text: 'DISAGREE',
        x: dimensions.width * 0.1, // 10% from left
        y: dimensions.height * 0.9, // 90% from top
        color: '#000000' // Solid black
      },
      {
        text: 'PASS',
        x: dimensions.width * 0.9, // 90% from left
        y: dimensions.height * 0.9, // 90% from top
        color: '#000000' // Solid black
      }
    ];

    svg.selectAll('.vote-label')
      .data(labels)
      .enter()
      .append('text')
      .attr('class', 'vote-label')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'sans-serif')
      .attr('font-size', `${baseFontSize}px`)
      .attr('font-weight', 'bold')
      .attr('fill', d => d.color)
      .text(d => d.text);

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
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 120 // Account for statement panel height
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
        position: 'fixed',
        top: '120px', // Position below the statement panel
        left: 0,
        width: '100vw',
        height: 'calc(100vh - 120px)', // Adjust height to account for statement panel
        touchAction: 'none',
        cursor: 'default',
        zIndex: 1000,
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