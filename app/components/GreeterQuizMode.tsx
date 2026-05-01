import { useState, useRef, useEffect } from "react";

interface Attendee {
  slugId: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  hasRealPhoto: boolean;
  attendance: 'in-person' | 'online';
}

export type QuizMode = 'image-name' | 'first-last';

interface GreeterQuizModeProps {
  attendees: Attendee[];
  memorizedIds: Set<string>;
  onMemorize: (slugId: string) => void;
  onExit: () => void;
  quizMode: QuizMode;
  onQuizModeChange: (mode: QuizMode) => void;
  hideDefaultAvatars: boolean;
  onHideDefaultAvatarsChange: (val: boolean) => void;
}

export default function GreeterQuizMode({
  attendees,
  memorizedIds,
  onMemorize,
  onExit,
  quizMode,
  onQuizModeChange,
  hideDefaultAvatars,
  onHideDefaultAvatarsChange,
}: GreeterQuizModeProps) {
  const [queue, setQueue] = useState<Attendee[]>(() => {
    return attendees
      .filter(a => !memorizedIds.has(a.slugId))
      .filter(a => quizMode !== 'image-name' || !hideDefaultAvatars || a.hasRealPhoto);
  });
  const [isFlipped, setIsFlipped] = useState(false);
  const initialDeckSize = useRef(queue.length);

  const currentCard = queue[0] ?? null;
  const isDone = queue.length === 0;

  const handleAgain = () => {
    setQueue(([head, ...rest]) => {
      const insertAt = Math.min(3, rest.length);
      return [...rest.slice(0, insertAt), head, ...rest.slice(insertAt)];
    });
    setIsFlipped(false);
  };

  const handleHard = () => {
    setQueue(([head, ...rest]) => [...rest, head]);
    setIsFlipped(false);
  };

  const handleGood = () => {
    if (!currentCard) return;
    onMemorize(currentCard.slugId);
    setQueue(([, ...rest]) => rest);
    setIsFlipped(false);
  };

  const handleModeChange = (mode: QuizMode) => {
    const newQueue = attendees
      .filter(a => !memorizedIds.has(a.slugId))
      .filter(a => mode !== 'image-name' || !hideDefaultAvatars || a.hasRealPhoto);
    initialDeckSize.current = newQueue.length;
    setQueue(newQueue);
    setIsFlipped(false);
    onQuizModeChange(mode);
  };

  const handleHideDefaultAvatarsChange = (val: boolean) => {
    const newQueue = attendees
      .filter(a => !memorizedIds.has(a.slugId))
      .filter(a => quizMode !== 'image-name' || !val || a.hasRealPhoto);
    initialDeckSize.current = newQueue.length;
    setQueue(newQueue);
    setIsFlipped(false);
    onHideDefaultAvatarsChange(val);
  };

  // Keep memorized cards out of queue if they somehow remain (defensive)
  useEffect(() => {
    setQueue(q => q.filter(a => !memorizedIds.has(a.slugId)));
  }, [memorizedIds]);

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 6,
    padding: '8px 20px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 600,
    opacity: isFlipped ? 1 : 0,
    pointerEvents: isFlipped ? 'auto' : 'none',
    transition: 'opacity 0.2s',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', border: '1px solid #333', borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
          <button
            onClick={() => handleModeChange('image-name')}
            style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'monospace', border: 'none', background: quizMode === 'image-name' ? 'rgba(255,255,255,0.14)' : 'transparent', color: quizMode === 'image-name' ? '#eee' : '#555', cursor: 'pointer' }}
          >
            Image / Name
          </button>
          <button
            onClick={() => handleModeChange('first-last')}
            style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'monospace', border: 'none', background: quizMode === 'first-last' ? 'rgba(255,255,255,0.14)' : 'transparent', color: quizMode === 'first-last' ? '#eee' : '#555', cursor: 'pointer' }}
          >
            Last / First
          </button>
        </div>

        {/* Hide default avatars */}
        {quizMode === 'image-name' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666', cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={hideDefaultAvatars}
              onChange={e => handleHideDefaultAvatarsChange(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Hide default avatars
          </label>
        )}

        {/* Exit */}
        <button
          onClick={onExit}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, fontFamily: 'monospace', marginLeft: 'auto', padding: '4px 8px', flexShrink: 0 }}
        >
          ✕ Exit
        </button>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '16px 20px', overflow: 'hidden' }}>
        {isDone ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: '#aaa', fontFamily: 'monospace', textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>✓</div>
            <div style={{ fontSize: 16 }}>All done!</div>
            <div style={{ fontSize: 12, color: '#555' }}>{memorizedIds.size} memorized this session</div>
            <button
              onClick={onExit}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#aaa', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, padding: '8px 20px' }}
            >
              Back to list
            </button>
          </div>
        ) : currentCard ? (
          <>
            {/* Flip card */}
            <div
              onClick={() => setIsFlipped(f => !f)}
              style={{ width: 240, height: 280, perspective: '600px', cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.4s ease',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Front */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: 12,
                }}>
                  {quizMode === 'image-name' ? (
                    <>
                      <img
                        src={currentCard.photoUrl}
                        alt=""
                        width={120}
                        height={120}
                        style={{ borderRadius: '50%', objectFit: 'cover', background: '#222', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 12, color: '#444', fontFamily: 'monospace' }}>tap to reveal</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 28, fontWeight: 700, color: '#ddd', fontFamily: 'monospace', textAlign: 'center', padding: '0 16px' }}>{currentCard.lastName}</span>
                      <span style={{ fontSize: 12, color: '#444', fontFamily: 'monospace' }}>tap to reveal first name</span>
                    </>
                  )}
                </div>

                {/* Back */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: '#1a1a1a',
                  border: '1px solid #555',
                  borderRadius: 12,
                }}>
                  {quizMode === 'image-name' ? (
                    <>
                      <img
                        src={currentCard.photoUrl}
                        alt=""
                        width={64}
                        height={64}
                        style={{ borderRadius: '50%', objectFit: 'cover', background: '#222', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#eee', fontFamily: 'monospace', textAlign: 'center', padding: '0 16px' }}>
                        {currentCard.firstName} {currentCard.lastName}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#eee', fontFamily: 'monospace', textAlign: 'center', padding: '0 16px' }}>
                        {currentCard.firstName}
                      </span>
                      <span style={{ fontSize: 14, color: '#888', fontFamily: 'monospace', textAlign: 'center', padding: '0 16px' }}>
                        {currentCard.lastName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Answer buttons */}
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button
                onClick={handleAgain}
                style={{ ...btnBase, background: '#3a1010', color: '#e88' }}
              >
                Again
              </button>
              <button
                onClick={handleHard}
                style={{ ...btnBase, background: '#2a1e00', color: '#c96' }}
              >
                Hard
              </button>
              <button
                onClick={handleGood}
                style={{ ...btnBase, background: '#0e2a18', color: '#5c8' }}
              >
                Good
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Progress */}
      {!isDone && (
        <div style={{ padding: '8px 20px', borderTop: '1px solid #1a1a1a', flexShrink: 0, textAlign: 'center', fontSize: 11, color: '#444', fontFamily: 'monospace' }}>
          {queue.length} remaining / {initialDeckSize.current} total
        </div>
      )}
    </div>
  );
}
