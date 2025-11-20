import { useState, useEffect } from "react";

interface QueueItem {
  statementId: number;
  displayTimestamp: number;
}

interface CountdownTimerProps {
  queue: QueueItem[];
  currentTime: number;
  showNextStatementId?: boolean;
}

export default function CountdownTimer({ queue, currentTime, showNextStatementId = false }: CountdownTimerProps) {
  const [progress, setProgress] = useState<number>(0);
  const [nextStatement, setNextStatement] = useState<QueueItem | null>(null);
  const [totalDuration, setTotalDuration] = useState<number>(0);

  useEffect(() => {
    // Find the next statement to be displayed
    const now = Date.now();
    const upcoming = queue
      .filter(item => item.displayTimestamp > now)
      .sort((a, b) => a.displayTimestamp - b.displayTimestamp);

    const next = upcoming[0] || null;
    setNextStatement(next);

    if (next) {
      const timeRemaining = next.displayTimestamp - now;

      // Calculate total duration based on the gap between statements
      let calculatedDuration = timeRemaining;

      // Find the previous statement (either currently active or most recent in queue)
      const allStatements = [...queue].sort((a, b) => a.displayTimestamp - b.displayTimestamp);
      const nextIndex = allStatements.findIndex(item => item.statementId === next.statementId);

      if (nextIndex > 0) {
        // Use the gap between the previous statement and this one
        const previousStatement = allStatements[nextIndex - 1];
        calculatedDuration = next.displayTimestamp - previousStatement.displayTimestamp;
      } else {
        // If this is the first statement, use the time from now to the statement
        calculatedDuration = timeRemaining;
      }

      // Set total duration based on the gap between statements
      if (totalDuration === 0 || next !== nextStatement) {
        setTotalDuration(calculatedDuration);
      }

      // Progress should start at 100% and decrease to 0% as time runs out
      const progressPercent = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));
      setProgress(progressPercent);
    } else {
      setProgress(0);
      setTotalDuration(0);
    }
  }, [queue, currentTime]);

  useEffect(() => {
    if (!nextStatement) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const timeRemaining = nextStatement.displayTimestamp - now;

      if (timeRemaining <= 0) {
        setProgress(0);
        clearInterval(timer);
        return;
      }

      // Progress should start at 100% and decrease to 0% as time runs out
      const progressPercent = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));
      setProgress(progressPercent);
    }, 50); // Update more frequently for smooth animation

    return () => clearInterval(timer);
  }, [nextStatement, totalDuration]);

  const hasNextStatement = nextStatement !== null;

  return (
    <div className="countdown-timer-container">
      {hasNextStatement && (
        <div className="countdown-timer">
          <div className="countdown-row">
            <div className="countdown-bar-container">
              <div
                className="countdown-bar"
                style={{
                  width: `${progress}%`,
                  transformOrigin: 'left center'
                }}
              />
            </div>
            {showNextStatementId && (
              <span className="countdown-label">Next: #{nextStatement.statementId}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}