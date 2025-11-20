import "./styles.css";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import Canvas from "./components/Canvas";
import StatementPanel from "./components/StatementPanel";
import AdminPanel from "./components/AdminPanel";

// Extract room from URL parameters, default to "default"
function getRoomFromUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');

  if (!room) {
    // If no room parameter, set it to "default" and update the URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', 'default');
    window.history.replaceState({}, '', newUrl.toString());
    return 'default';
  }

  return room;
}

// Check if admin mode is enabled
function isAdminMode(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('admin') === 'true';
}

function App() {
  const room = getRoomFromUrl();
  const adminMode = isAdminMode();
  const [activeStatementId, setActiveStatementId] = useState<number | null>(1);

  const handleActiveStatementChange = (statementId: number) => {
    setActiveStatementId(statementId);
  };

  // Render admin panel if admin mode is enabled
  if (adminMode) {
    return (
      <div>
        <AdminPanel room={room} />
      </div>
    );
  }

  // Render normal interface
  return (
    <div>
      <StatementPanel activeStatementId={activeStatementId} />
      <Canvas room={room} onActiveStatementChange={handleActiveStatementChange} />
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
