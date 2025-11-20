import "./styles.css";
import { createRoot } from "react-dom/client";
import Canvas from "./components/Canvas";

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

function App() {
  const room = getRoomFromUrl();
  
  return (
    <div>
      <Canvas room={room} />
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
