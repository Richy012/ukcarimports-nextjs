import styles from "./PhotoPlaceholder.module.css";

/**
 * Branded stand-in for a missing car photo: the trinity-knot watermark field,
 * a quiet car outline and wording that reads intentional rather than broken.
 * Fills a 4:3 frame (tiles are 280x210), so it can sit anywhere an <img> did.
 * `compact` drops the label and shrinks the outline for thumbnail-size frames.
 */
export default function PhotoPlaceholder({
  label = "Photo coming soon",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.frame} ${compact ? styles.compact : ""} wm-light`}>
      <svg
        className={styles.car}
        viewBox="0 0 132 52"
        width={compact ? 62 : 104}
        height={compact ? 24 : 41}
        aria-hidden="true"
      >
        <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 38c-6 0-8-2-8-6 0-6 8-9 20-10l10-9c3-2.6 6-4 11-4h14c5 0 9 1.6 13 5l9 8c14 1 23 5 23 11 0 3-2 5-6 5" />
          <path d="M45 38h40" />
          <circle cx="36" cy="38" r="6.5" />
          <circle cx="94" cy="38" r="6.5" />
          <path d="M42 23h32" opacity=".5" />
        </g>
      </svg>
      {!compact && <span className={styles.label}>{label}</span>}
    </div>
  );
}
