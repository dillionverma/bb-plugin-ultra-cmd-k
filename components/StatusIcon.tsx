// Linear's status ring, borrowed from Ultra Sidebar so a thread reads the
// same in the palette as it does in the sidebar: a dashed ring at rest, a
// complete ring for unread, a half ring while working, three quarters when
// it needs you, a filled disc with a tick when done.
//
// Literal hex values on purpose: this is Linear's palette, identical in light
// and dark, and the shape carries the state as much as the colour does.
const LINEAR = {
  backlog: "#bec2c8",
  todo: "#e2e2e2",
  progress: "#f2c94c",
  review: "#4cb782",
  done: "#5e6ad2",
  blocked: "#eb5757",
  attention: "#f2994a",
} as const;

export type StatusTone = "idle" | "unread" | "working" | "needs-you" | "done" | "problem";

interface Glyph {
  color: string;
  fill: number;
  dashed?: boolean;
  mark?: "check" | "cross";
}

const BY_TONE: Record<StatusTone, Glyph> = {
  idle: { color: LINEAR.backlog, fill: 0, dashed: true },
  unread: { color: LINEAR.todo, fill: 0 },
  working: { color: LINEAR.progress, fill: 0.5 },
  "needs-you": { color: LINEAR.attention, fill: 0.75 },
  done: { color: LINEAR.done, fill: 1, mark: "check" },
  problem: { color: LINEAR.blocked, fill: 1, mark: "cross" },
};

export const TONE_COLOR: Record<StatusTone, string> = Object.fromEntries(
  Object.entries(BY_TONE).map(([tone, glyph]) => [tone, glyph.color]),
) as Record<StatusTone, string>;

const RADIUS = 5;
const INNER = 2.5;
const CIRCUMFERENCE = 2 * Math.PI * INNER;

export function StatusIcon({ tone, label, className }: { tone: StatusTone; label?: string; className?: string }) {
  const glyph = BY_TONE[tone];
  const filled = glyph.fill >= 1;
  return (
    <svg
      viewBox="0 0 14 14"
      className={className ?? "size-3.5 shrink-0"}
      role={label === undefined ? "presentation" : "img"}
      aria-label={label}
      aria-hidden={label === undefined}
    >
      <circle
        cx="7"
        cy="7"
        r={RADIUS}
        fill={filled ? glyph.color : "none"}
        stroke={glyph.color}
        strokeWidth="1.5"
        strokeDasharray={glyph.dashed === true ? "1.8 1.8" : undefined}
        strokeLinecap="round"
      />
      {!filled && glyph.fill > 0 ? (
        <circle
          cx="7"
          cy="7"
          r={INNER}
          fill="none"
          stroke={glyph.color}
          strokeWidth={INNER * 2}
          strokeDasharray={`${CIRCUMFERENCE * glyph.fill} ${CIRCUMFERENCE}`}
          transform="rotate(-90 7 7)"
        />
      ) : null}
      {glyph.mark === "check" ? (
        <path d="M4.6 7.1 6.2 8.7 9.4 5.5" fill="none" className="stroke-background" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {glyph.mark === "cross" ? (
        <path d="M5.2 5.2 8.8 8.8 M8.8 5.2 5.2 8.8" fill="none" className="stroke-background" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
