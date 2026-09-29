import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/global.css";

const enableMocks =
  import.meta.env.MODE !== "production" || import.meta.env.VITE_ENABLE_MOCKS === "true";

const workerOptions = {
  onUnhandledRequest: "bypass" as const,
  // Always fetch a fresh worker script so a cached old worker can never
  // fall out of sync with the handlers (which reads as "HTML is not valid
  // JSON" when /api misses and the SPA fallback answers).
  serviceWorker: {
    options: { updateViaCache: "none" as const },
  },
};

async function enableMocking(): Promise<void> {
  if (!enableMocks) return;
  const { worker } = await import("./mocks/browser");
  await worker.start(workerOptions);

  // Self-heal against stale service workers. A worker left over from a
  // previous build (e.g. after a dependency upgrade) can stop intercepting
  // /api entirely; requests then hit Vite's SPA fallback, which answers
  // 200 + index.html and the board shows "queue service unavailable".
  // Probe a HANDLED route (never /api/healthz - unhandled routes bypass
  // by design) and rebuild the registration if it did not return JSON.
  const RECOVERY_FLAG = "msw-recovery-reloaded";
  try {
    const probe = await fetch("/api/locations/1/queue/general", {
      headers: { "x-force-success": "1" },
    });
    const type = probe.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      sessionStorage.removeItem(RECOVERY_FLAG);
      return;
    }
    await worker.stop();
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    if (!sessionStorage.getItem(RECOVERY_FLAG)) {
      sessionStorage.setItem(RECOVERY_FLAG, "1");
      location.reload();
      return; // page is going away
    }
    // Already tried the reload path once this session; start a clean worker
    // and let the UI's normal error state handle any remaining problem.
    await worker.start(workerOptions);
  } catch {
    // Probe failures (offline, worker gone mid-start) must not block app
    // startup; the query layer's error state is the honest fallback.
  }
}

void enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
