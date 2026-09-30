import type { ReactNode, SelectHTMLAttributes } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hideLabel?: boolean;
  options: { value: string; label: string }[];
}

/**
 * Shared caret for every queue dropdown. The Filter button uses the same
 * icon, so all dropdowns in the toolbar read as one control family.
 */
export function SelectCaret(): ReactNode {
  return <CaretDownIcon className="select-caret" size={15} aria-hidden="true" />;
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
      <span className="select-control">
        <select className="select" id={selectId} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <SelectCaret />
      </span>
    </>
  );
}
