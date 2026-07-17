import Link from "next/link";

type Tint = "accent" | "warn" | "crit" | "good" | "cyan";

const TINT: Record<Tint, string> = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent-hex)]",
  warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
  crit: "bg-[var(--crit-soft)] text-[var(--crit)]",
  good: "bg-[var(--good-soft)] text-[var(--good)]",
  cyan: "bg-[var(--cyan-soft)] text-[var(--cyan)]",
};

// One page-title treatment used across the whole app: an accent icon tile
// anchors a large bold title with a legible subtitle, and an optional slot
// on the right for the page's primary action.
export default function PageHeader({
  icon,
  tint = "accent",
  eyebrow,
  title,
  sub,
  action,
  back,
}: {
  icon?: string;
  tint?: Tint;
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="space-y-3">
      {back && (
        <Link href={back.href} className="text-[13px] text-[var(--sub)] hover:text-[var(--ink)] transition flex items-center gap-1 w-fit">
          <span className="ms" style={{ fontSize: 16 }}>arrow_back</span> {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          {icon && (
            <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${TINT[tint]}`}>
              <span className="ms" style={{ fontSize: 24 }}>{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-[var(--faint)] mb-0.5">{eyebrow}</div>
            )}
            <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-[var(--ink)]">{title}</h1>
            {sub && <p className="text-[var(--sub)] text-[13.5px] mt-1">{sub}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
