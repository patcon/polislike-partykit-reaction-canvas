import { useState } from "react";
import ValenceCrossSectionPanel from "../../../plugins/valenceCrossSection/component";
import { PanelContextProvider } from "../../context/PanelContext";
import ReactionCanvasParticipant from "../shared/ReactionCanvasParticipant";
import { RoomSocketProvider } from "../../contexts/RoomSocketContext";
import { generateUUID } from "../../utils/userId";
import DemoLayout from "./DemoLayout";
import PhoneFrame from "./PhoneFrame";
import SimControlBar from "./SimControlBar";

export default function DemoValenceCrossSection() {
  const [room] = useState(() => `demo-${generateUUID()}`);
  const [participantId] = useState(() => generateUUID());
  const [observerId] = useState(() => generateUUID());

  return (
    <DemoLayout
      title="Demo — Reaction Canvas + Valence Cross-Section"
      room={room}
      controls={
        <RoomSocketProvider room={room} userId="sim-driver">
          <SimControlBar />
        </RoomSocketProvider>
      }
      left={
        <PhoneFrame label="Participant" showSharePrompt>
          <RoomSocketProvider room={room} userId={participantId}>
            <ReactionCanvasParticipant
              room={room}
              userId={participantId}
              autoSize
              markSimulatedCursors={false}
              shareUrl={`${window.location.origin}/${room}`}
            />
          </RoomSocketProvider>
        </PhoneFrame>
      }
      right={
        <PhoneFrame label="Valence cross-section">
          <PanelContextProvider value={{ room, userId: observerId, inviteEdges: {} }}>
            <RoomSocketProvider room={room} userId={observerId} readOnly>
              <ValenceCrossSectionPanel />
            </RoomSocketProvider>
          </PanelContextProvider>
        </PhoneFrame>
      }
    />
  );
}
