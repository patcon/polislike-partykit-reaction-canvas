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

interface Vote {
  userId: string;
  statementId: number;
  vote: number; // +1 for agree, -1 for disagree, 0 for pass
  timestamp: number;
}

interface AdminPanelProps {
  room: string;
}

export default function AdminPanel({ room }: AdminPanelProps) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [allSelectedStatements, setAllSelectedStatements] = useState<QueueItem[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'statements' | 'votes'>('statements');
  const [votes, setVotes] = useState<Vote[]>([]);
  const [votesLoading, setVotesLoading] = useState(false);

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

  // Load votes data
  const loadVotes = async () => {
    setVotesLoading(true);
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.host}/parties/main/${room}/votes`);
      if (response.ok) {
        const votesData = await response.json();
        setVotes(votesData);
      } else {
        console.error('Failed to load votes:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to load votes:', error);
    } finally {
      setVotesLoading(false);
    }
  };

  // Clear all votes
  const clearVotes = async () => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.host}/parties/main/${room}/votes`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const result = await response.json();
        console.log('Votes cleared:', result.message);
        // Refresh the votes list to show empty state
        setVotes([]);
      } else {
        console.error('Failed to clear votes:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to clear votes:', error);
    }
  };

  // Load votes when switching to votes tab
  useEffect(() => {
    if (activeTab === 'votes') {
      loadVotes();
    }
  }, [activeTab, room]);

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

  const handleEndVoting = () => {
    // Send pseudo-statement with ID -1 to queue to trigger final vote
    socket.send(JSON.stringify({
      type: 'queueStatement',
      statementId: -1
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

  const isEndVotingActive = () => {
    if (allSelectedStatements.length === 0) return false;

    // Sort statements by display timestamp to find the last one
    const sortedStatements = [...allSelectedStatements].sort((a, b) => a.displayTimestamp - b.displayTimestamp);
    const lastStatement = sortedStatements[sortedStatements.length - 1];

    // End voting is active only if the last statement in the queue is the -1 statement
    return lastStatement.statementId === -1;
  };

  const getQueuedStatements = () => {
    const now = Date.now();
    return allSelectedStatements.filter(item => item.displayTimestamp > now);
  };

  const getVoteText = (vote: number) => {
    if (vote === 1) return 'Agree';
    if (vote === -1) return 'Disagree';
    if (vote === 0) return 'Pass';
    return 'Unknown';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
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

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'statements' ? 'active' : ''}`}
            onClick={() => setActiveTab('statements')}
          >
            Statements
          </button>
          <button
            className={`tab-button ${activeTab === 'votes' ? 'active' : ''}`}
            onClick={() => setActiveTab('votes')}
          >
            Votes
          </button>
        </div>

        {activeTab === 'statements' && (
          <>
            <p>Click on a statement to add it to the queue (10 second delay)</p>
            <p className="current-active">
              Currently active: {getCurrentActiveStatementId() === -1 ? 'None' : `Statement #${getCurrentActiveStatementId()}`}
            </p>
            <CountdownTimer queue={getQueuedStatements()} currentTime={currentTime} showNextStatementId={true} />
            <div className="queue-controls">
              <button
                className="clear-queue-btn"
                onClick={handleClearQueue}
                disabled={allSelectedStatements.length === 0}
              >
                Clear Queue ({allSelectedStatements.length} items)
              </button>
              <button
                className="end-voting-btn"
                onClick={handleEndVoting}
                disabled={isEndVotingActive()}
              >
                End Voting
              </button>
            </div>
          </>
        )}

        {activeTab === 'votes' && (
          <>
            <p>All votes submitted by users</p>
            <div className="votes-controls">
              <button onClick={loadVotes} disabled={votesLoading} className="refresh-btn">
                {votesLoading ? 'Loading...' : 'Refresh Votes'}
              </button>
              {votes.length > 0 && (
                <button onClick={clearVotes} className="clear-votes-btn">
                  Clear All Votes ({votes.length} votes)
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Statements Tab Content */}
      {activeTab === 'statements' && (
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
      )}

      {/* Votes Tab Content */}
      {activeTab === 'votes' && (
        <div className="votes-list">
          {votesLoading ? (
            <p>Loading votes...</p>
          ) : votes.length === 0 ? (
            <p>No votes recorded yet.</p>
          ) : (
            <div className="votes-table">
              <table>
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Statement ID</th>
                    <th>Vote</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {votes.map((vote, index) => (
                    <tr key={index}>
                      <td>{vote.userId}</td>
                      <td>#{vote.statementId}</td>
                      <td className={`vote-${vote.vote === 1 ? 'agree' : vote.vote === -1 ? 'disagree' : 'pass'}`}>
                        {getVoteText(vote.vote)}
                      </td>
                      <td>{formatTimestamp(vote.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}