export const ROLE_LABEL: Record<string, string> = {
  engineer: "Engineer",
  warehouse_manager: "Warehouse Manager",
  technician: "Technician",
  boss: "Boss",
  admin: "Admin",
};

type Badge = { label: string; cls: string; live?: boolean };

// Light enterprise status pills — soft tint fill, dark semantic text.
export const EVENT_STATUS: Record<string, Badge> = {
  draft: { label: "Draft", cls: "bg-[#E8EDF2] text-[#46596B] ring-[#DCE3EA]" },
  sent_to_warehouse: { label: "Requested", cls: "bg-[#EAF4FC] text-[#0A6ED1] ring-[#0A6ED1]/20" },
  prepared: { label: "Prepared", cls: "bg-[#E5EEFB] text-[#1D4ED8] ring-[#1D4ED8]/20" },
  shipped: { label: "Shipped", cls: "bg-[#FCF3E7] text-[#B25E09] ring-[#B25E09]/25" },
  received_on_site: { label: "On site", cls: "bg-[#E6F4F1] text-[#0F766E] ring-[#0F766E]/20" },
  in_progress: { label: "Live", cls: "bg-[#EBF7EF] text-[#16803C] ring-[#16803C]/25", live: true },
  returning: { label: "Returning", cls: "bg-[#E5F3F8] text-[#0E7490] ring-[#0E7490]/20" },
  reconciliation: { label: "Checking returns", cls: "bg-[#FBEFE7] text-[#C2410C] ring-[#C2410C]/20" },
  archived: { label: "Done", cls: "bg-[#E8EDF2] text-[#46596B] ring-[#DCE3EA]" },
  cancelled: { label: "Cancelled", cls: "bg-[#FBEEED] text-[#C0271C] ring-[#C0271C]/20" },
};
export function statusBadge(s: string): Badge {
  return EVENT_STATUS[s] ?? { label: s, cls: "bg-[#E8EDF2] text-[#46596B] ring-[#DCE3EA]" };
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

export const OVERDUE_BADGE: Badge = { label: "Overdue", cls: "bg-[#FCF3E7] text-[#B25E09] ring-[#B25E09]/25" };

// Status pill that accounts for a Live event that has run past its scheduled end.
export function eventBadge(e: EventTimes): Badge {
  return isOverdue(e) ? OVERDUE_BADGE : statusBadge(e.status ?? "");
}

const SOURCE: Record<string, Badge> = {
  warehouse: { label: "warehouse", cls: "bg-[#F0F3F6] text-[#566B80] ring-[#DCE3EA]" },
  transfer: { label: "transfer", cls: "bg-[#EAF4FC] text-[#0A6ED1] ring-[#0A6ED1]/20" },
  rental: { label: "rental", cls: "bg-[#FCF3E7] text-[#B25E09] ring-[#B25E09]/25" },
};
export function sourceBadge(s: string): Badge {
  return SOURCE[s] ?? { label: s, cls: "bg-[#E8EDF2] text-[#46596B] ring-[#DCE3EA]" };
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
  return s === "found" ? { label: "Found", cls: "bg-[#EBF7EF] text-[#16803C] ring-[#16803C]/25" }
    : s === "written_off" ? { label: "Written off", cls: "bg-[#E8EDF2] text-[#46596B] ring-[#DCE3EA]" }
    : { label: "Open", cls: "bg-[#FBEEED] text-[#C0271C] ring-[#C0271C]/20" };
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
