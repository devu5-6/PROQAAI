import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = "Could not load the queue",
  message = "Something went wrong on our side. Your data is safe, please try again.",
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div className="state-box" role="alert">
      <span className="icon" aria-hidden="true">
        <WarningCircle size={22} weight="duotone" />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      <Button variant="primary" onClick={onRetry} loading={retrying}>
        {retrying ? "Retrying" : "Retry"}
      </Button>
    </div>
  );
}
