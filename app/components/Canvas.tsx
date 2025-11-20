import { useRef, useEffect, useState } from "react";
import usePartySocket from "partysocket/react";

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

type VoteState = 'agree' | 'disagree' | 'pass' | null;

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [userVoteState, setUserVoteState] = useState<VoteState>(null);

  const socket = usePartySocket({
    host: "localhost:1999",
    room: "cursor-room",
    onMessage(evt) {
      try {
        const event: CursorEvent = JSON.parse(evt.data);
        // Check if event has the expected structure
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
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, timestamp: Date.now(), userId };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      timestamp: Date.now(),
      userId
    };
  };

  const getVoteFromPosition = (x: number, y: number): VoteState => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const width = canvas.width;
    const height = canvas.height;

    // Define vote zones (corners)
    const agreeZone = { x: width, y: 0 }; // top-right
    const disagreeZone = { x: 0, y: height }; // bottom-left
    const passZone = { x: width, y: height }; // bottom-right

    // Calculate distances to each zone
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

  // Render cursor positions and vote labels
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Set background color based on vote state
    let backgroundColor = 'rgba(255, 255, 255, 0.1)'; // Default transparent white
    if (userVoteState === 'agree') {
      backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Green with transparency
    } else if (userVoteState === 'disagree') {
      backgroundColor = 'rgba(255, 0, 0, 0.2)'; // Red with transparency
    } else if (userVoteState === 'pass') {
      backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Yellow with transparency
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw vote labels in corners
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Agree (top-right, green)
    ctx.fillStyle = userVoteState === 'agree' ? '#00AA00' : '#00FF00';
    ctx.fillText('AGREE', canvas.width - 80, 40);

    // Disagree (bottom-left, red)
    ctx.fillStyle = userVoteState === 'disagree' ? '#AA0000' : '#FF0000';
    ctx.fillText('DISAGREE', 80, canvas.height - 40);

    // Pass (bottom-right, yellow)
    ctx.fillStyle = userVoteState === 'pass' ? '#B8860B' : '#DAA520';
    ctx.fillText('PASS', canvas.width - 80, canvas.height - 40);

    // Draw cursor positions as colored dots
    cursors.forEach((cursor, userId) => {
      // Generate a consistent color for each user
      const hue = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;

      // Draw cursor dot
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw user ID label
      ctx.fillStyle = '#000';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(userId.substring(0, 6), cursor.x + 12, cursor.y - 8);
    });
  }, [cursors, userVoteState]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
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