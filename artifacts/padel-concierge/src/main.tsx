import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "navigate" && typeof e.data.url === "string") {
      window.location.href = e.data.url;
    }
  });
}
