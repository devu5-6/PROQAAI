import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import QueueBoard from "./QueueBoard";
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
        <QueueBoard />
      </ToastProvider>
    </QueryClientProvider>
  );
}
