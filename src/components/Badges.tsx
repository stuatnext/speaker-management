import { STATUS_COLORS, TIER_COLORS } from "@/lib/monday/board";

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="badge badge-muted">No status</span>;
  const color = STATUS_COLORS[status] ?? "#9aa0b4";
  return (
    <span className="badge" style={{ background: color }}>
      {status}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="badge badge-muted">—</span>;
  const color = TIER_COLORS[tier] ?? "#9aa0b4";
  return (
    <span className="badge" style={{ background: color }}>
      {tier}
    </span>
  );
}

export function Tracks({ tracks }: { tracks: string[] }) {
  if (tracks.length === 0) return <span className="speaker-sub">—</span>;
  return (
    <>
      {tracks.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
    </>
  );
}
