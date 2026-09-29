import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle, WarningCircle, Info, X } from "@phosphor-icons/react";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (kind: Toast["kind"], message: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

const TOAST_ICONS = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        <div aria-live="assertive" aria-atomic="true">
          {toasts.map((t) => {
            const Icon = TOAST_ICONS[t.kind];
            return (
              <div key={t.id} className={`toast ${t.kind}`}>
                <Icon className="icon" size={18} weight="fill" aria-hidden />
                <span className="message">{t.message}</span>
                <button
                  type="button"
                  className="dismiss"
                  aria-label={`Dismiss notification: ${t.message}`}
                  onClick={() => dismiss(t.id)}
                >
                  <X size={14} weight="bold" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
