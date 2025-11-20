import "./styles.css";
import { createRoot } from "react-dom/client";
import Counter from "./components/Counter";

function App() {
  return (
    <main>
      <h1>🎈 Welcome to PartyKit!</h1>
      <p>
        This is the React starter. (
        <a href="https://github.com/partykit/templates/tree/main/templates/react">
          README on GitHub.
        </a>
        )
      </p>
      <p>Find your way around:</p>
      <ul>
        <li>
          PartyKit server: <code>party/server.ts</code>
        </li>
        <li>
          Client entrypoint: <code>app/client.tsx</code>
        </li>
        <li>
          The Counter component: <code>app/components/Counter.tsx</code>
        </li>
      </ul>
      <p>
        Read more: <a href="https://docs.partykit.io">PartyKit docs</a>
      </p>
      <p>
        <i>This counter is multiplayer. Try it with multiple browser tabs.</i>
      </p>
      <Counter />
    </main>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
