import { useState, useEffect } from "react";
import CountdownTimer from "./CountdownTimer";
import type { PolisStatement, QueueItem, Statement } from "../types";

interface StatementPanelProps {
  activeStatementId: number | null;
  queue?: QueueItem[];
  currentTime?: number;
  statementsPool?: PolisStatement[];
}

export default function StatementPanel({ activeStatementId, queue = [], currentTime = Date.now(), statementsPool = [] }: StatementPanelProps) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [activeStatement, setActiveStatement] = useState<Statement | null>(null);

  // Convert PolisStatement to Statement format
  useEffect(() => {
    if (statementsPool.length > 0) {
      const convertedStatements: Statement[] = statementsPool.map(polisStatement => ({
        statementId: polisStatement.tid,
        timecode: 0, // Default timecode since PolisStatement doesn't have it
        text: polisStatement.txt
      }));
      setStatements(convertedStatements);
    }
  }, [statementsPool]);

  // Update active statement when activeStatementId changes
  useEffect(() => {
    if (activeStatementId === -1) {
      // Handle "End Voting" pseudo-statement with blank content
      setActiveStatement({
        statementId: -1,
        timecode: 0,
        text: ""
      });
    } else if (activeStatementId && statements.length > 0) {
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
      <CountdownTimer queue={queue} currentTime={currentTime} />
      <div className="statement-content">
        {activeStatement.statementId === -1 ? (
          <>
            <div className="statement-id">Voting Ended</div>
            <div className="statement-text"></div>
          </>
        ) : (
          <>
            <div className="statement-id">Statement #{activeStatement.statementId}</div>
            <div className="statement-text">{activeStatement.text}</div>
          </>
        )}
      </div>
    </div>
  );
}