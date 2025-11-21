import "./styles.css";
import { createRoot } from "react-dom/client";
import { useState, useEffect, useRef } from "react";
import usePartySocket from "partysocket/react";
import Canvas from "./components/Canvas";
import StatementPanel from "./components/StatementPanel";
import AdminPanel from "./components/AdminPanel";

interface QueueItem {
  statementId: number;
  displayTimestamp: number;
}

// Extract room from URL parameters, default to "default"
function getRoomFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');

  if (!room) {
    // If no room parameter, set it to "default" and update the URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', 'default');
    window.history.replaceState({}, '', newUrl.toString());
    return 'default';
  }

  return room;
}

// Check if admin mode is enabled
function isAdminMode(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('admin') === 'true';
}

function App() {
  const room = getRoomFromUrl();
  const adminMode = isAdminMode();
  const [allSelectedStatements, setAllSelectedStatements] = useState<QueueItem[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [activeStatementId, setActiveStatementId] = useState<number>(1);
  const [previousActiveStatementId, setPreviousActiveStatementId] = useState<number | null>(null);
  const [currentVoteState, setCurrentVoteState] = useState<'agree' | 'disagree' | 'pass' | null>(null);
  const canvasVoteStateRef = useRef<'agree' | 'disagree' | 'pass' | null>(null);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [ghostCursorsEnabled, setGhostCursorsEnabled] = useState(false);

  // Set up socket connection for non-admin mode to receive queue updates
  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'connected') {
          if (data.allSelectedStatements) {
            setAllSelectedStatements(data.allSelectedStatements);
          }
          if (data.currentTime) {
            setCurrentTime(data.currentTime);
          }
          if (typeof data.ghostCursorsEnabled === 'boolean') {
            setGhostCursorsEnabled(data.ghostCursorsEnabled);
          }
        } else if (data.type === 'queueUpdated') {
          if (data.allSelectedStatements) {
            setAllSelectedStatements(data.allSelectedStatements);
          }
          setCurrentTime(data.currentTime);
        } else if (data.type === 'ghostCursorsChanged') {
          setGhostCursorsEnabled(data.enabled);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
  });

  const getQueuedStatements = () => {
    const now = Date.now();
    return allSelectedStatements.filter(item => item.displayTimestamp > now);
  };

  const getCurrentActiveStatementId = () => {
    const now = Date.now();
    // Find the most recent statement that should be displayed
    const displayedStatements = allSelectedStatements
      .filter(item => item.displayTimestamp <= now)
      .sort((a, b) => b.displayTimestamp - a.displayTimestamp);

    if (displayedStatements.length > 0) {
      return displayedStatements[0].statementId;
    }

    // Default to statement 1 if no statements have been queued yet
    return 1;
  };

  // Function to submit vote
  const submitVote = async (userId: string, statementId: number, voteState: 'agree' | 'disagree' | 'pass' | null) => {
    if (!voteState || !statementId) {
      console.log('Vote submission skipped: missing voteState or statementId', { voteState, statementId });
      return;
    }

    // Don't allow voting on the -1 statementId (End Voting pseudo-statement)
    if (statementId === -1) {
      console.log('Vote submission skipped: cannot vote on End Voting pseudo-statement', { statementId });
      return;
    }

    const voteValue = voteState === 'agree' ? 1 : voteState === 'disagree' ? -1 : 0;

    console.log('Attempting to submit vote:', { userId, statementId, voteState, voteValue });

    try {
      const url = `${window.location.protocol}//${window.location.host}/parties/main/${room}/vote`;
      console.log('Vote submission URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          statementId,
          vote: voteValue,
          timestamp: Date.now()
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Vote submitted successfully: ${voteState} for statement ${statementId}`, result);
      } else {
        const errorText = await response.text();
        console.error('Failed to submit vote:', response.status, response.statusText, errorText);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
    }
  };

  // Function to handle vote state changes (visual feedback only, no immediate submission)
  const handleVoteStateChange = (voteState: 'agree' | 'disagree' | 'pass' | null) => {
    setCurrentVoteState(voteState);
    // Note: We don't submit votes immediately on cursor movement
    // Votes are only submitted when the statement changes
  };

  // Update active statement based on timestamps
  useEffect(() => {
    const newActiveId = getCurrentActiveStatementId();
    if (newActiveId !== activeStatementId) {
      // Submit vote for previous statement if we have one and a vote state
      // Check both currentVoteState (for mouse) and canvasVoteStateRef (for touch)
      const voteToSubmit = currentVoteState || canvasVoteStateRef.current;
      if (activeStatementId && voteToSubmit) {
        console.log(`Submitting vote via useEffect: ${voteToSubmit} for statement ${activeStatementId}`);
        submitVote(userId, activeStatementId, voteToSubmit);
      }

      setPreviousActiveStatementId(activeStatementId);
      setActiveStatementId(newActiveId);
      setCurrentVoteState(null); // Reset vote state for new statement
      canvasVoteStateRef.current = null; // Reset canvas vote state ref
    }
  }, [allSelectedStatements, currentTime, currentVoteState, activeStatementId, userId]);

  // Set up a timer to check for statement updates every second
  useEffect(() => {
    if (adminMode) return; // Don't run timer in admin mode

    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      const newActiveId = getCurrentActiveStatementId();
      if (newActiveId !== activeStatementId) {
        // Submit vote for previous statement if we have one and a vote state
        // Check both currentVoteState (for mouse) and canvasVoteStateRef (for touch)
        const voteToSubmit = currentVoteState || canvasVoteStateRef.current;
        if (activeStatementId && voteToSubmit) {
          console.log(`Submitting vote via timer: ${voteToSubmit} for statement ${activeStatementId}`);
          submitVote(userId, activeStatementId, voteToSubmit);
        }

        setPreviousActiveStatementId(activeStatementId);
        setActiveStatementId(newActiveId);
        setCurrentVoteState(null); // Reset vote state for new statement
        canvasVoteStateRef.current = null; // Reset canvas vote state ref
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [allSelectedStatements, activeStatementId, adminMode, currentVoteState, userId]);

  const handleActiveStatementChange = (statementId: number) => {
    // This is now derived from queue data, so we don't need to set it manually
  };

  // Render admin panel if admin mode is enabled
  if (adminMode) {
    return (
      <div>
        <AdminPanel room={room} />
      </div>
    );
  }

  // Render normal interface
  return (
    <div className="app-container">
      <StatementPanel
        activeStatementId={activeStatementId}
        queue={getQueuedStatements()}
        currentTime={currentTime}
      />
      <div className="vote-canvas-container">
        <div className="vote-label vote-label-agree">AGREE</div>
        <div className="vote-label vote-label-disagree">DISAGREE</div>
        <div className="vote-label vote-label-pass">PASS</div>
        <Canvas
          room={room}
          onActiveStatementChange={handleActiveStatementChange}
          onVoteStateChange={handleVoteStateChange}
          userId={userId}
          voteStateRef={canvasVoteStateRef}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
