import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { registerSW } from "virtual:pwa-register";
registerSW({
  onRegisteredSW(_url, registration) {
    let checking = false;
    const check = async () => {
      if (
        checking ||
        !navigator.onLine ||
        document.visibilityState !== "visible"
      )
        return;
      checking = true;
      try {
        await registration?.update();
      } catch {
        /* Offline or temporary failure: keep the current app and data. */
      } finally {
        checking = false;
      }
    };
    window.addEventListener("online", () => void check());
    document.addEventListener("visibilitychange", () => void check());
    setInterval(() => void check(), 60 * 60 * 1000);
  },
  onNeedRefresh() {
    const root = document.getElementById("update-note");
    if (root) return;
    const notice = document.createElement("div");
    notice.id = "update-note";
    notice.className = "update-note";
    notice.textContent =
      "A new EatFirst version is ready. Close all EatFirst tabs and reopen to update safely.";
    const button = document.createElement("button");
    button.textContent = "Dismiss";
    button.onclick = () => notice.remove();
    notice.append(button);
    document.body.append(notice);
  },
});
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="loading">
        <h1>Let’s get your kitchen back.</h1>
        <p>
          Something unexpected happened. Your saved data stays on this device.
        </p>
        <button onClick={() => location.reload()}>Reload EatFirst</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>,
);
