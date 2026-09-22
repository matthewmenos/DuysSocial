import type { ButtonHTMLAttributes, ReactNode } from "react";

export type BusyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-busy"> & {
  /** True while the triggered work is in flight: disables + shows the spinner. */
  busy: boolean;
  /** Text shown while busy. Defaults to the idle children. */
  busyLabel?: ReactNode;
  /** Keep the button enabled while busy (rare; defaults to disabled). */
  keepEnabled?: boolean;
  children: ReactNode;
};

/**
 * Submit/mutation button with an inline mini-spinner. The button disables
 * itself while `busy` (or when the caller passes its own `disabled`), swaps in
 * `busyLabel`, and stays accessible (aria-busy + aria-disabled while the
 * spinner is decorative).
 */
export function BusyButton({
  busy, busyLabel, keepEnabled = false, children, className, type = "button", disabled, ...rest
}: BusyButtonProps) {
  const classes = `${className || ""}${busy ? " is-busy" : ""}`.trim();
  const off = disabled || (busy && !keepEnabled);
  return (
    <button
      type={type}
      className={classes}
      disabled={off}
      aria-busy={busy}
      aria-disabled={off}
      {...rest}
    >
      {busy && <span className="btn-spinner" aria-hidden="true" />}
      <span className="btn-label">{busy && busyLabel !== undefined ? busyLabel : children}</span>
    </button>
  );
}
