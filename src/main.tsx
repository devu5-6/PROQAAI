import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/global.css";

const enableMocks =
  import.meta.env.MODE !== "production" || import.meta.env.VITE_ENABLE_MOCKS === "true";

async function enableMocking(): Promise<void> {
  if (!enableMocks) return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

void enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
