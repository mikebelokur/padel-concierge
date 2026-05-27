import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
