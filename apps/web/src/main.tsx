import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import { Admin } from "./admin";
import { TempleView } from "./TempleView";
import { useTemple } from "./useTemple";
import "./style.css";
function Game() {
  const { client, state } = useTemple();
  const overlay = location.pathname === "/overlay";
  return (
    <main className="standalone">
      <TempleView client={client} state={state} overlay={overlay} />
    </main>
  );
}
function App() {
  return location.pathname === "/game" || location.pathname === "/overlay" ? (
    <Game />
  ) : (
    <Admin />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
