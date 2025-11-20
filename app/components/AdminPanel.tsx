import { useState, useEffect } from "react";
import usePartySocket from "partysocket/react";
import CountdownTimer from "./CountdownTimer";

interface Statement {
  statementId: number;
  timecode: number;
  text: string;
}

interface QueueItem {
  statementId: number;
  displayTimestamp: number;
}

interface AdminPanelProps {
  room: string;
}

export default function AdminPanel({ room }: AdminPanelProps) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [allSelectedStatements, setAllSelectedStatements] = useState<QueueItem[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);

  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);

        // Handle server messages to track queue
        if (data.type === 'connected') {
          if (data.allSelectedStatements) {
            setAllSelectedStatements(data.allSelectedStatements);
          }
          if (data.currentTime) {
            setCurrentTime(data.currentTime);
          }
        } else if (data.type === 'queueUpdated') {
          if (data.allSelectedStatements) {
            setAllSelectedStatements(data.allSelectedStatements);
          }
          setCurrentTime(data.currentTime);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
  });

  // Load statements data
  useEffect(() => {
    const loadStatements = async () => {
      try {
        const response = await fetch('/data/statements.default.json');
        const data = await response.json();
        setStatements(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load statements:', error);
        setLoading(false);
      }
    };

    loadStatements();
  }, []);

  // Set up a timer to update current time every second for real-time badge updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleStatementClick = (statementId: number) => {
    // Send statement to queue instead of setting active immediately
    socket.send(JSON.stringify({
      type: 'queueStatement',
      statementId: statementId
    }));
  };

  const handleClearQueue = () => {
    // Send clear queue command to server
    socket.send(JSON.stringify({
      type: 'clearQueue'
    }));
  };

  // Calculate the currently active statement from queue data
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

  const getStatementStatus = (statementId: number) => {
    const now = Date.now();
    const activeStatementId = getCurrentActiveStatementId();

    // Check if this statement is queued for the future (takes precedence)
    const futureQueueItem = allSelectedStatements.find(item =>
      item.statementId === statementId && item.displayTimestamp > now
    );

    if (futureQueueItem) {
      return 'queued';
    }

    // Check if this is the currently active statement
    if (activeStatementId === statementId) {
      return 'now';
    }

    // Check if this statement was queued in the past (shown)
    const pastQueueItem = allSelectedStatements.find(item =>
      item.statementId === statementId && item.displayTimestamp <= now
    );

    if (pastQueueItem) {
      return 'shown';
    }

    return null;
  };

  const getQueuedStatements = () => {
    const now = Date.now();
    return allSelectedStatements.filter(item => item.displayTimestamp > now);
  };

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-header">
          <h1>Admin Panel</h1>
          <p>Loading statements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p>Click on a statement to add it to the queue (10 second delay)</p>
        <p className="current-active">
          Currently active: Statement #{getCurrentActiveStatementId()}
        </p>
        <CountdownTimer queue={getQueuedStatements()} currentTime={currentTime} showNextStatementId={true} />
        {allSelectedStatements.length > 0 && (
          <button className="clear-queue-btn" onClick={handleClearQueue}>
            Clear Queue ({allSelectedStatements.length} items)
          </button>
        )}
      </div>

      <div className="statements-list">
        {statements.map((statement) => {
          const status = getStatementStatus(statement.statementId);
          return (
            <div
              key={statement.statementId}
              className={`statement-item ${status ? `status-${status}` : ''}`}
              onClick={() => handleStatementClick(statement.statementId)}
            >
              <div className="statement-header">
                <span className="statement-id">#{statement.statementId}</span>
                <span className="statement-timecode">@{statement.timecode}s</span>
                {status && (
                  <span className={`status-indicator status-${status}`}>
                    {status.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="statement-text">{statement.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}