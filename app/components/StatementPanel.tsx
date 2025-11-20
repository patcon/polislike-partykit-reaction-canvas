import { useState, useEffect } from "react";

interface Statement {
  statementId: number;
  timecode: number;
  text: string;
}

interface StatementPanelProps {
  activeStatementId: number | null;
}

export default function StatementPanel({ activeStatementId }: StatementPanelProps) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [activeStatement, setActiveStatement] = useState<Statement | null>(null);

  // Load statements data
  useEffect(() => {
    const loadStatements = async () => {
      try {
        const response = await fetch('/data/statements.default.json');
        const data = await response.json();
        setStatements(data);
      } catch (error) {
        console.error('Failed to load statements:', error);
      }
    };

    loadStatements();
  }, []);

  // Update active statement when activeStatementId changes
  useEffect(() => {
    if (activeStatementId && statements.length > 0) {
      const statement = statements.find(s => s.statementId === activeStatementId);
      setActiveStatement(statement || null);
    } else if (statements.length > 0) {
      // Default to statement ID 1 if no active statement is set
      const defaultStatement = statements.find(s => s.statementId === 1);
      setActiveStatement(defaultStatement || null);
    }
  }, [activeStatementId, statements]);

  if (!activeStatement) {
    return (
      <div className="statement-panel">
        <div className="statement-content">
          <div className="statement-id">Loading statement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="statement-panel">
      <div className="statement-content">
        <div className="statement-id">Statement #{activeStatement.statementId}</div>
        <div className="statement-text">{activeStatement.text}</div>
      </div>
    </div>
  );
}