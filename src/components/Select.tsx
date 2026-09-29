import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hideLabel?: boolean;
  options: { value: string; label: string }[];
}

export function Select({ label, hideLabel = false, options, id, ...rest }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <>
      {hideLabel ? (
        <label className="sr-only" htmlFor={selectId}>{label}</label>
      ) : (
        <label htmlFor={selectId} style={{ marginRight: "var(--space-2)" }}>
          {label}
        </label>
      )}
      <select className="select" id={selectId} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}
