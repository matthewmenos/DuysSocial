import { useId, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

type Strength = { label: string; color: string; width: string };

const LEVELS: Strength[] = [
  { label: "Too weak", color: "#f4212e", width: "20%" },
  { label: "Weak", color: "#f4212e", width: "40%" },
  { label: "Fair", color: "#f5b50a", width: "60%" },
  { label: "Good", color: "#1d9bf6", width: "80%" },
  { label: "Strong", color: "#00ba7c", width: "100%" },
];

/** Same scoring as DUYS/duys/static/js/auth.js (length/case/digit/symbol). */
export function scorePassword(pw: string): Strength | null {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return LEVELS[Math.min(s, 4)];
}

export type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** "current-password" for login, "new-password" for signup. */
  autoComplete?: string;
  /** Renders the legacy .pw-meter bar under the field. */
  meter?: boolean;
  /** Text to compare against; renders the legacy .pw-match line. */
  matchText?: string;
  /** Label shown when matchText is empty. */
  matchEmptyText?: string;
};

/**
 * Password input with the legacy .pw-wrap reveal toggle (eye/eye-off,
 * aria-label flips) plus optional strength meter and confirm-match line.
 * Uncontrolled-friendly wrapper — the visible value always comes from props.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  meter = false,
  matchText,
  matchEmptyText = "",
  id,
  required,
  ...rest
}: PasswordFieldProps) {
  const autoId = useId();
  const inputId = id || `pw-${autoId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [revealed, setRevealed] = useState(false);
  const strength = meter ? scorePassword(value) : null;
  const showMatch = matchText !== undefined;
  const matches = showMatch && matchText !== "" && value === matchText;

  return (
    <>
      <div className="field">
        <label htmlFor={inputId}>{label}</label>
        <div className="pw-wrap">
          <input
            id={inputId}
            name={rest.name}
            type={revealed ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            required={required}
            onChange={(e) => onChange(e.target.value)}
            {...rest}
          />
          <button
            type="button"
            className={`pw-toggle${revealed ? " revealed" : ""}`}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            <Icon name="eye" size={20} />
            <Icon name="eye-off" size={20} />
          </button>
        </div>
        {strength && (
          <div className="pw-meter" aria-hidden="true">
            <div className="pw-meter-bar">
              <span style={{ width: strength.width, background: strength.color }} />
            </div>
            <span className="pw-meter-label" style={{ color: strength.color }}>{strength.label}</span>
          </div>
        )}
        {showMatch && (
          <span className={`pw-match${matches ? " ok" : value || matchText ? " err" : ""}`} role="status">
            {matches ? "Passwords match" : value || matchText ? "Passwords do not match" : matchEmptyText}
          </span>
        )}
      </div>
    </>
  );
}
