import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { registerSW } from "virtual:pwa-register";
registerSW({
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
