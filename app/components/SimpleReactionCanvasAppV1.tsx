import { useState, useEffect, useRef } from "react";
import usePartySocket from "partysocket/react";
import Canvas from "./Canvas";
import TouchLayer from "./TouchLayer";
import StatementPanel from "./StatementPanel";
import AdminPanel from "./AdminPanel";
import type { PolisStatement, QueueItem } from "../types";
import { getReactionLabelSet } from "../voteLabels";
import { DEFAULT_ANCHORS, reactionLabelStyle } from "../utils/voteRegion";

function getRoomFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room') ?? urlParams.get('videoId') ?? 'default';
}

function isAdminMode(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('admin') === 'true';
}

function getGhostCursorsFromUrl(): boolean | null {
  const urlParams = new URLSearchParams(window.location.search);
  const ghostCursorsParam = urlParams.get('ghostCursors');
  if (ghostCursorsParam === 'true') return true;
  if (ghostCursorsParam === 'false') return false;
  return null;
}

export default function SimpleReactionCanvasAppV1() {
  const room = getRoomFromUrl();
  const adminMode = isAdminMode();
  const ghostCursorsFromUrl = getGhostCursorsFromUrl();
  const [allSelectedStatements, setAllSelectedStatements] = useState<QueueItem[]>([]);
  const [statementsPool, setStatementsPool] = useState<PolisStatement[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [activeStatementId, setActiveStatementId] = useState<number>(1);
  const [previousActiveStatementId, setPreviousActiveStatementId] = useState<number | null>(null);
  const [currentReactionState, setCurrentReactionState] = useState<'positive' | 'negative' | 'neutral' | null>(null);
  const canvasReactionStateRef = useRef<'positive' | 'negative' | 'neutral' | null>(null);
  const [canvasBackgroundReactionState, setCanvasBackgroundReactionState] = useState<'positive' | 'negative' | 'neutral' | null>(null);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [ghostCursorsEnabled, setGhostCursorsEnabled] = useState(ghostCursorsFromUrl ?? false);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd') setDebug(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          if (data.statementsPool) {
            setStatementsPool(data.statementsPool);
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
        } else if (data.type === 'statementsPoolUpdated') {
          if (data.statementsPool) {
            setStatementsPool(data.statementsPool);
          }
        } else if (data.type === 'statementsPoolError') {
          console.error('Error updating statements pool:', data.error);
        } else if (data.type === 'ghostCursorsChanged') {
          setGhostCursorsEnabled(data.enabled);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
  });

  useEffect(() => {
    if (ghostCursorsFromUrl !== null && socket) {
      socket.send(JSON.stringify({
        type: 'setGhostCursors',
        enabled: ghostCursorsFromUrl
      }));
    }
  }, [socket, ghostCursorsFromUrl]);

  useEffect(() => {
    const loadStatements = async () => {
      if (socket) {
        if (/^\d/.test(room)) {
          console.log(`Room "${room}" starts with digit, requesting Polis API data`);
          socket.send(JSON.stringify({
            type: 'updateStatementsPool',
            conversationId: room
          }));
        } else {
          console.log(`Room "${room}" doesn't start with digit, loading statements.${room}.json`);
          try {
            const response = await fetch(`/data/statements.${room}.json`);
            const data = await response.json();
            socket.send(JSON.stringify({
              type: 'updateStatementsPool',
              json: data
            }));
          } catch (error) {
            console.error(`Failed to load statements.${room}.json:`, error);
          }
        }
      }
    };

    loadStatements();
  }, [socket, room]);

  const getQueuedStatements = () => {
    const now = Date.now();
    return allSelectedStatements.filter(item => item.displayTimestamp > now);
  };

  const getCurrentActiveStatementId = () => {
    const now = Date.now();
    const displayedStatements = allSelectedStatements
      .filter(item => item.displayTimestamp <= now)
      .sort((a, b) => b.displayTimestamp - a.displayTimestamp);

    if (displayedStatements.length > 0) {
      return displayedStatements[0].statementId;
    }

    return 1;
  };

  const submitReaction = async (userId: string, statementId: number, reactionState: 'positive' | 'negative' | 'neutral' | null) => {
    if (!reactionState || !statementId) {
      console.log('Reaction submission skipped: missing reactionState or statementId', { reactionState, statementId });
      return;
    }

    if (statementId === -1) {
      console.log('Reaction submission skipped: cannot react on End Voting pseudo-statement', { statementId });
      return;
    }

    const reactionValue = reactionState === 'positive' ? 1 : reactionState === 'negative' ? -1 : 0;

    console.log('Attempting to submit reaction:', { userId, statementId, reactionState, reactionValue });

    try {
      const url = `${window.location.protocol}//${window.location.host}/parties/main/${room}/vote`;
      console.log('Vote submission URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          statementId,
          vote: reactionValue,
          timestamp: Date.now()
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Reaction submitted successfully: ${reactionState} for statement ${statementId}`, result);
      } else {
        const errorText = await response.text();
        console.error('Failed to submit reaction:', response.status, response.statusText, errorText);
      }
    } catch (error) {
      console.error('Error submitting reaction:', error);
    }
  };

  const handleReactionStateChange = (reactionState: 'positive' | 'negative' | 'neutral' | null) => {
    setCurrentReactionState(reactionState);
  };

  const handleBackgroundColorChange = (reactionState: 'positive' | 'negative' | 'neutral' | null) => {
    setCanvasBackgroundReactionState(reactionState);
  };

  useEffect(() => {
    const newActiveId = getCurrentActiveStatementId();
    if (newActiveId !== activeStatementId) {
      const voteToSubmit = currentReactionState || canvasReactionStateRef.current;
      if (activeStatementId && voteToSubmit) {
        console.log(`Submitting vote via useEffect: ${voteToSubmit} for statement ${activeStatementId}`);
        submitReaction(userId, activeStatementId, voteToSubmit);
      }

      setPreviousActiveStatementId(activeStatementId);
      setActiveStatementId(newActiveId);
      setCurrentReactionState(null);
      canvasReactionStateRef.current = null;
    }
  }, [allSelectedStatements, currentTime, currentReactionState, activeStatementId, userId]);

  useEffect(() => {
    if (adminMode) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      const newActiveId = getCurrentActiveStatementId();
      if (newActiveId !== activeStatementId) {
        const voteToSubmit = currentReactionState || canvasReactionStateRef.current;
        if (activeStatementId && voteToSubmit) {
          console.log(`Submitting vote via timer: ${voteToSubmit} for statement ${activeStatementId}`);
          submitReaction(userId, activeStatementId, voteToSubmit);
        }

        setPreviousActiveStatementId(activeStatementId);
        setActiveStatementId(newActiveId);
        setCurrentReactionState(null);
        canvasReactionStateRef.current = null;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [allSelectedStatements, activeStatementId, adminMode, currentReactionState, userId]);

  const handleActiveStatementChange = (_statementId: number) => {
    // Derived from queue data, no manual override needed
  };

  if (adminMode) {
    return (
      <div>
        <AdminPanel room={room} />
      </div>
    );
  }

  const labels = getReactionLabelSet();

  return (
    <div className="app-container">
      <StatementPanel
        activeStatementId={activeStatementId}
        queue={getQueuedStatements()}
        currentTime={currentTime}
        statementsPool={statementsPool}
      />
      <div className="vote-canvas-container" style={{ position: 'relative' }}>
        {labels && <div className="reaction-label reaction-label-positive" style={reactionLabelStyle(DEFAULT_ANCHORS.positive)}>{labels.positive}</div>}
        {labels && <div className="reaction-label reaction-label-negative" style={reactionLabelStyle(DEFAULT_ANCHORS.negative)}>{labels.negative}</div>}
        {labels && <div className="reaction-label reaction-label-neutral" style={reactionLabelStyle(DEFAULT_ANCHORS.neutral)}>{labels.neutral}</div>}
        <div className="debug-hint">{debug ? 'd: debug on' : 'd: debug'}</div>
        <Canvas
          room={room}
          userId={userId}
          colorCursorsByVote={true}
          currentReactionState={canvasBackgroundReactionState}
          debug={debug}
        />
        <TouchLayer
          room={room}
          onActiveStatementChange={handleActiveStatementChange}
          onReactionStateChange={handleReactionStateChange}
          userId={userId}
          reactionStateRef={canvasReactionStateRef}
          onBackgroundColorChange={handleBackgroundColorChange}
        />
      </div>
    </div>
  );
}
