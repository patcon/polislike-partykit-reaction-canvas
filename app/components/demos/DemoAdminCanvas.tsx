import { useState } from "react";
import AdminPanelNoDB from "../panels/AdminPanelNoDB";
import ReactionCanvasParticipant from "../shared/ReactionCanvasParticipant";
import { RoomSocketProvider } from "../../contexts/RoomSocketContext";
import { generateUUID } from "../../utils/userId";
import DemoLayout from "./DemoLayout";
import PhoneFrame from "./PhoneFrame";
import SimControlBar from "./SimControlBar";

/**
 * Demo: emcee admin panel (left) + participant reaction canvas (right), sharing one
 * random room so the two halves sync live. Distinct userIds fake two separate users.
 */
export default function DemoAdminCanvas() {
  const [room] = useState(() => `demo-${generateUUID()}`);
  const [adminId] = useState(() => generateUUID());
  const [participantId] = useState(() => generateUUID());

  return (
    <DemoLayout
      title="Demo — Admin + Reaction Canvas"
      room={room}
      controls={
        // Dedicated sim-driver connection: injects sim_ cursors into the shared room.
        <RoomSocketProvider room={room} userId="sim-driver">
          <SimControlBar />
        </RoomSocketProvider>
      }
      left={
        <PhoneFrame label="Emcee">
          <AdminPanelNoDB room={room} userId={adminId} />
        </PhoneFrame>
      }
      right={
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
    />
  );
}
