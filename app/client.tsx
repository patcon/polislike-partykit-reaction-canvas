import "./styles.css";
import { createRoot } from "react-dom/client";
import Canvas from "./components/Canvas";

function App() {
  return (
    <div>
      <Canvas />
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
