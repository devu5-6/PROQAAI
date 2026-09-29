import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QueueBoard } from "./QueueBoard";
import { ToastProvider } from "./toast-context";
import "@/components/button.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <a className="skip-link" href="#queue-main">
          Skip to queue board
        </a>
        <header className="app-header">
          <div className="brand">
            <h1>Queue Operations Console</h1>
          </div>
          <span className="live-dot">
            <span className="dot" aria-hidden="true" />
            Live
          </span>
        </header>
        <main id="queue-main" className="queue-main">
          <QueueBoard />
        </main>
      </ToastProvider>
    </QueryClientProvider>
  );
}
