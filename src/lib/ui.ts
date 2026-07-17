export const ROLE_LABEL: Record<string, string> = {
  engineer: "Engineer",
  warehouse_manager: "Warehouse Manager",
  technician: "Technician",
  boss: "Boss",
  admin: "Admin",
};

type Badge = { label: string; cls: string; live?: boolean };

// Status pills — soft tint fill, semantic text. The pill-* classes live in
// globals.css and resolve through theme tokens, so they work in both themes.
export const EVENT_STATUS: Record<string, Badge> = {
  draft: { label: "Draft", cls: "pill-neutral" },
  sent_to_warehouse: { label: "Requested", cls: "pill-accent" },
  prepared: { label: "Prepared", cls: "pill-info" },
  shipped: { label: "Shipped", cls: "pill-warn" },
  received_on_site: { label: "On site", cls: "pill-teal" },
  in_progress: { label: "Live", cls: "pill-good", live: true },
  returning: { label: "Returning", cls: "pill-cyan" },
  reconciliation: { label: "Checking returns", cls: "pill-orange" },
  archived: { label: "Done", cls: "pill-neutral" },
  cancelled: { label: "Cancelled", cls: "pill-crit" },
};
export function statusBadge(s: string): Badge {
  return EVENT_STATUS[s] ?? { label: s, cls: "pill-neutral" };
}

type EventTimes = { status?: string | null; live_end?: string | null; demontage_end?: string | null };

// The moment an event is scheduled to be fully over: teardown end if set, else show end.
export function scheduledEnd(e: EventTimes): number | null {
  const raw = e.demontage_end ?? e.live_end;
  return raw ? new Date(raw).getTime() : null;
}

// A "Live" (in_progress) event whose scheduled end has already passed — the engineer
// should have ended it. We surface this instead of a misleading pulsing "Live" badge.
export function isOverdue(e: EventTimes, now: number = Date.now()): boolean {
  if (e.status !== "in_progress") return false;
  const end = scheduledEnd(e);
  return end != null && end < now;
}

export const OVERDUE_BADGE: Badge = { label: "Overdue", cls: "pill-warn" };

// Status pill that accounts for a Live event that has run past its scheduled end.
export function eventBadge(e: EventTimes): Badge {
  return isOverdue(e) ? OVERDUE_BADGE : statusBadge(e.status ?? "");
}

const SOURCE: Record<string, Badge> = {
  warehouse: { label: "warehouse", cls: "pill-neutral" },
  transfer: { label: "transfer", cls: "pill-accent" },
  rental: { label: "rental", cls: "pill-warn" },
};
export function sourceBadge(s: string): Badge {
  return SOURCE[s] ?? { label: s, cls: "pill-neutral" };
}

// Where in the flow a loss happened, and why.
export const MISSING_PHASE: Record<string, { label: string; icon: string }> = {
  transit: { label: "In transit", icon: "local_shipping" },
  event: { label: "At the event", icon: "celebration" },
  return: { label: "On return", icon: "keyboard_return" },
  other: { label: "Other", icon: "help" },
};
export const MISSING_REASON: Record<string, string> = { missing: "Missing", lost: "Lost", damaged: "Damaged" };

export function missingStatusBadge(s: string): Badge {
  return s === "found" ? { label: "Found", cls: "pill-good" }
    : s === "written_off" ? { label: "Written off", cls: "pill-neutral" }
    : { label: "Open", cls: "pill-crit" };
}

export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtRange(a?: string | null, b?: string | null): string {
  if (!a && !b) return "—";
  if (a && b) return `${fmtDate(a)} – ${fmtDate(b)}`;
  return fmtDate(a ?? b);
}

// Day-granular date as DD/MM/YYYY.
export function fmtDMY(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}
