import { useRef, useEffect, useState } from "react";
import usePartySocket from "partysocket/react";

interface Point {
  x: number;
  y: number;
  timestamp: number;
  userId: string;
}

interface CanvasEvent {
  type: 'move' | 'start' | 'end';
  point: Point;
}

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [points, setPoints] = useState<Point[]>([]);

  const socket = usePartySocket({
    host: "localhost:1999",
    room: "canvas-room",
    onMessage(evt) {
      try {
        const event: CanvasEvent = JSON.parse(evt.data);
        if (event.point.userId !== userId) {
          setPoints(prev => [...prev.slice(-100), event.point]); // Keep last 100 points
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
  });

  const sendEvent = (type: CanvasEvent['type'], point: Point) => {
    const event: CanvasEvent = { type, point };
    socket.send(JSON.stringify(event));
  };

  const getEventPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
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

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getEventPoint(e);
    setPoints(prev => [...prev.slice(-100), point]);
    sendEvent('start', point);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const point = getEventPoint(e);
    setPoints(prev => [...prev.slice(-100), point]);
    sendEvent('move', point);
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(false);
    const point = getEventPoint(e);
    sendEvent('end', point);
  };

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all points
    if (points.length > 0) {
      ctx.strokeStyle = '#ff0f0f';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    }
  }, [points]);

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
        cursor: 'crosshair',
        zIndex: 1000
      }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    />
  );
}