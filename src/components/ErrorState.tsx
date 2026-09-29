import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}

/** Error state with explicit Retry (engineering req: handle error + retry). */
export function ErrorState({
  title = "We couldn't load the queue",
  message = "Something went wrong on our side. Your queue data is safe — try again.",
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div className="state-box" role="alert">
      <span className="icon" aria-hidden="true">⚠️</span>
      <h3>{title}</h3>
      <p>{message}</p>
      <Button variant="primary" onClick={onRetry} loading={retrying}>
        {retrying ? "Retrying…" : "Retry"}
      </Button>
    </div>
  );
}
