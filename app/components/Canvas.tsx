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

type VoteState = 'agree' | 'disagree' | 'pass' | null;

interface CanvasProps {
  room: string;
  userId: string;
  colorCursorsByVote?: boolean; // Optional prop to enable vote-based coloring
  currentVoteState?: VoteState; // Current vote state for background color
}

export default function Canvas({ room, userId, colorCursorsByVote = false, currentVoteState }: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 140 // Canvas height is viewport minus statement panel height
  });

  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        // Handle cursor events only
        if (data.position) {
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

  // Update background color based on current vote state
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

  // Update background color when currentVoteState changes
  useEffect(() => {
    updateBackgroundColor(currentVoteState || null);
  }, [currentVoteState]);

  // Render with D3 SVG
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    // Clear previous content
    svg.selectAll("*").remove();

    // Add background rectangle with default color
    svg.append('rect')
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('fill', 'rgba(255, 255, 255, 0.1)'); // Default transparent white

    // Apply current vote state color if any
    if (currentVoteState) {
      updateBackgroundColor(currentVoteState);
    }

    // Add cursor positions as colored dots - convert normalized coordinates to pixels
    const cursorData = Array.from(cursors.entries()).map(([cursorUserId, cursor]) => ({
      cursorUserId,
      x: (cursor.x / 100) * dimensions.width, // Convert from 0-100 to pixel coordinates
      y: (cursor.y / 100) * dimensions.height, // Convert from 0-100 to pixel coordinates
      timestamp: cursor.timestamp,
      userId: cursor.userId,
      // Calculate vote state on client side for coloring
      voteState: colorCursorsByVote ? getVoteFromPosition(cursor.x, cursor.y) : null
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
        // Use region-based colors if enabled and vote state is available (for ghost cursors)
        if (colorCursorsByVote && d.voteState) {
          switch (d.voteState) {
            case 'agree':
              return 'rgba(0, 255, 0, 0.8)'; // Green for agree
            case 'disagree':
              return 'rgba(255, 0, 0, 0.8)'; // Red for disagree
            case 'pass':
              return 'rgba(255, 255, 0, 0.8)'; // Yellow for pass
            default:
              return 'rgba(128, 128, 128, 0.8)'; // Gray for null/unknown
          }
        }

        // Generate a consistent color for each user (for real user cursors or when vote coloring is disabled)
        const hue = d.cursorUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 360;
        return `hsl(${hue}, 70%, 50%)`;
      })
      .attr('stroke', '#000000') // Black border
      .attr('stroke-width', 2); // 2px border width

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

  }, [cursors, dimensions]);

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
        zIndex: 1, // Lower z-index for rendering layer
        pointerEvents: 'none' // Don't capture events, let TouchLayer handle them
      }}
    />
  );
}