import { useState, useEffect } from "react";
import usePartySocket from "partysocket/react";

interface Statement {
  statementId: number;
  timecode: number;
  text: string;
}

interface AdminPanelProps {
  room: string;
}

export default function AdminPanel({ room }: AdminPanelProps) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [activeStatementId, setActiveStatementId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const socket = usePartySocket({
    host: window.location.hostname === 'localhost' ? 'localhost:1999' : process.env.PARTYKIT_HOST,
    room: room,
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);
        
        // Handle server messages to track current active statement
        if (data.type === 'connected' && data.activeStatementId) {
          setActiveStatementId(data.activeStatementId);
        } else if (data.type === 'activeStatementChanged') {
          setActiveStatementId(data.statementId);
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

  const handleStatementClick = (statementId: number) => {
    // Send statement change event to server
    socket.send(JSON.stringify({
      type: 'setActiveStatement',
      statementId: statementId
    }));
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
        <p>Click on a statement to set it as active for all users</p>
        {activeStatementId && (
          <p className="current-active">
            Currently active: Statement #{activeStatementId}
          </p>
        )}
      </div>
      
      <div className="statements-list">
        {statements.map((statement) => (
          <div
            key={statement.statementId}
            className={`statement-item ${activeStatementId === statement.statementId ? 'active' : ''}`}
            onClick={() => handleStatementClick(statement.statementId)}
          >
            <div className="statement-header">
              <span className="statement-id">#{statement.statementId}</span>
              <span className="statement-timecode">@{statement.timecode}s</span>
            </div>
            <div className="statement-text">{statement.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}