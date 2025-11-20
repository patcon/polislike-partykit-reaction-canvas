import { useRef, useEffect, useState } from "react";
import usePartySocket from "partysocket/react";

interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
}

interface CursorEvent {
  type: 'move' | 'touch';
  position: CursorPosition;
}

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());

  const socket = usePartySocket({
    host: "localhost:1999",
    room: "cursor-room",
    onMessage(evt) {
      try {
        const event: CursorEvent = JSON.parse(evt.data);
        if (event.position.userId !== userId) {
          setCursors(prev => {
            const newCursors = new Map(prev);
            newCursors.set(event.position.userId, event.position);
            return newCursors;
          });
          
          // Remove old cursor positions after 5 seconds
          setTimeout(() => {
            setCursors(prev => {
              const newCursors = new Map(prev);
              const cursor = newCursors.get(event.position.userId);
              if (cursor && cursor.timestamp === event.position.timestamp) {
                newCursors.delete(event.position.userId);
              }
              return newCursors;
            });
          }, 5000);
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

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    const position = getCursorPosition(e);
    sendCursorEvent('move', position);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const position = getCursorPosition(e);
    sendCursorEvent('touch', position);
  };

  // Render cursor positions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
      ctx.fillText(userId.substring(0, 6), cursor.x + 12, cursor.y - 8);
    });
  }, [cursors]);

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    />
  );
}