import type { CSSProperties } from "react";
import { Icon } from "./Icon";

/** Custom-property style helper (TS rejects unknown keys on CSSProperties). */
const skStyle = (delay: number): CSSProperties => ({ "--sk-delay": `${delay}s` }) as CSSProperties;

/*
 * Shared loading / error placeholders.
 *
 * Pages used to `return null` while their first fetch was in flight, which made
 * a refresh look like a blank screen (and stayed blank forever if the request
 * failed). Every data page renders one of these instead.
 */

/** A single shimmering placeholder bar. */
export function Skeleton({
  width = "100%", height = 12, delay = 0, circle = false,
}: { width?: string; height?: number; delay?: number; circle?: boolean }) {
  return (
    <span
      className={circle ? "sk sk-circle" : "sk"}
      style={{ ...skStyle(delay), ...(circle ? null : { width, height }) }}
      aria-hidden="true"
    />
  );
}

/** Organic row widths, so the placeholder doesn't read as a data table. */
const ROW_WIDTHS = ["100%", "88%", "72%", "94%", "64%"];

/** Avatar + two-line rows for list pages that want a content-shaped placeholder. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="sk-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-list-row" key={i}>
          <Skeleton circle delay={i * 0.1} />
          <span className="sk-list-lines">
            <Skeleton width="46%" delay={i * 0.1} />
            <Skeleton width="72%" height={10} delay={i * 0.1 + 0.07} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Full-page loading placeholder: an animated brand mark (sweeping arc + ripple
 * halo + pulsing core), a sheen travelling across the label, and shimmering
 * placeholder rows. Pass `rows={0}` for the mark and label alone.
 */
export function PageLoading({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-mark" aria-hidden="true">
        <span className="page-loading-ripple" />
        <span className="page-loading-ripple page-loading-ripple-2" />
        <span className="page-loading-arc" />
        <span className="page-loading-core" />
      </span>
      <span className="page-loading-text">{label}</span>
      {rows > 0 && (
        <span className="page-loading-rows" aria-hidden="true">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} width={ROW_WIDTHS[i % ROW_WIDTHS.length]} delay={i * 0.12} />
          ))}
        </span>
      )}
    </div>
  );
}

/** Server error codes are terse (`not_found`); give users something readable. */
const FRIENDLY: Record<string, string> = {
  unauthorized: "Please sign in again to continue.",
  forbidden: "You don't have access to this.",
  not_found: "This page or item no longer exists.",
  not_subscribed: "You need to subscribe to this channel first.",
  rate_limited: "Too many requests — please slow down for a moment.",
  bad_request: "Something about that request was invalid.",
  server_error: "The server hit an error. Please try again.",
  "Failed to fetch": "You appear to be offline.",
};

export function PageError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const text = message ? FRIENDLY[message] || message : "Check your connection and try again.";
  return (
    <div className="page-error">
      <Icon name="alert" size={44} />
      <h3>Could not load this page</h3>
      <p className="muted">{text}</p>
      <div className="page-error-actions">
        <button className="btn btn-primary btn-sm" onClick={onRetry || (() => window.location.reload())}>
          Try again
        </button>
        <a className="btn btn-sm btn-outline" href="/">Go home</a>
      </div>
    </div>
  );
}
