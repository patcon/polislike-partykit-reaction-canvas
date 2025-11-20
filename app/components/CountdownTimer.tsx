import { useState, useEffect } from "react";

interface QueueItem {
  statementId: number;
  displayTimestamp: number;
}

interface CountdownTimerProps {
  queue: QueueItem[];
  currentTime: number;
}

export default function CountdownTimer({ queue, currentTime }: CountdownTimerProps) {
  const [progress, setProgress] = useState<number>(0);
  const [nextStatement, setNextStatement] = useState<QueueItem | null>(null);
  const [totalDuration, setTotalDuration] = useState<number>(10000); // 10 seconds in ms

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
      const progressPercent = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));
      setProgress(progressPercent);
    } else {
      setProgress(0);
    }
  }, [queue, currentTime, totalDuration]);

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

      const progressPercent = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));
      setProgress(progressPercent);
    }, 50); // Update more frequently for smooth animation

    return () => clearInterval(timer);
  }, [nextStatement, totalDuration]);

  const hasNextStatement = nextStatement && progress > 0;

  return (
    <div className="countdown-timer-container">
      {hasNextStatement && (
        <div className="countdown-timer">
          <div className="countdown-info">
            <span className="countdown-label">Next: Statement #{nextStatement.statementId}</span>
          </div>
          <div className="countdown-bar-container">
            <div
              className="countdown-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}