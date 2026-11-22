import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initTheme } from "./ui/theme";
import "./ui/fonts.css";
import "./ui/family.css";
import "./ui/colorlab.css";

initTheme();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

// Offline support: cache the app shell after the first visit (production builds only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined); });
}
