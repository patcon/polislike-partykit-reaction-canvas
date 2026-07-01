import { useState } from "react";
import MoodTonesPanel from "../../../plugins/moodTones/component";
import { PanelContextProvider } from "../../context/PanelContext";
import ReactionCanvasParticipant from "../shared/ReactionCanvasParticipant";
import { RoomSocketProvider } from "../../contexts/RoomSocketContext";
import { generateUUID } from "../../utils/userId";
import DemoLayout from "./DemoLayout";
import PhoneFrame from "./PhoneFrame";

/**
 * Demo: participant reaction canvas (left) + mood-tones readout (right), sharing one
 * random room. MoodTonesPanel reads `room` from PanelContext, so it's wrapped in a
 * PanelContextProvider (mirrors plugins/moodTones/component.stories.tsx).
 */
export default function DemoCanvasMood() {
  const [room] = useState(() => `demo-${generateUUID()}`);
  const [participantId] = useState(() => generateUUID());
  const [observerId] = useState(() => generateUUID());

  return (
    <DemoLayout
      title="Demo — Reaction Canvas + Mood Tones"
      room={room}
      left={
        <PhoneFrame label="Participant" showSharePrompt>
          <RoomSocketProvider room={room} userId={participantId}>
            <ReactionCanvasParticipant
              room={room}
              userId={participantId}
              autoSize
              shareUrl={`${window.location.origin}/${room}`}
            />
          </RoomSocketProvider>
        </PhoneFrame>
      }
      right={
        <PhoneFrame label="Mood tones">
          <PanelContextProvider value={{ room, userId: observerId, inviteEdges: {} }}>
            <RoomSocketProvider room={room} userId={observerId} readOnly>
              <MoodTonesPanel />
            </RoomSocketProvider>
          </PanelContextProvider>
        </PhoneFrame>
      }
    />
  );
}
