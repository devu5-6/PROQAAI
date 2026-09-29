import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
}

/** The one button to rule the console: variants map to tokens, not ad-hoc colors. */
export function Button({
  variant = "secondary",
  size = "sm",
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const base =
    "btn";
  const classes = [
    base,
    `btn--${variant}`,
    `btn--${size}`,
    loading ? "btn--loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className="btn__spinner" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <style>{`@keyframes btn-spin { to { transform: rotate(360deg); } }
                  .btn__spinner svg { animation: btn-spin 0.8s linear infinite; }`}</style>
        </span>
      )}
      {children}
    </button>
  );
}
