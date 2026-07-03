export const ROLE_LABEL: Record<string, string> = {
  engineer: "Engineer",
  warehouse_manager: "Warehouse Manager",
  technician: "Technician",
  boss: "Boss",
  admin: "Admin",
};

type Badge = { label: string; cls: string; live?: boolean };

// Dark-theme status pills (ring style on translucent fill).
export const EVENT_STATUS: Record<string, Badge> = {
  draft: { label: "Draft", cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
  sent_to_warehouse: { label: "Requested", cls: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
  prepared: { label: "Prepared", cls: "bg-blue-500/15 text-blue-300 ring-blue-400/30" },
  shipped: { label: "Shipped", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  received_on_site: { label: "On site", cls: "bg-teal-500/15 text-teal-300 ring-teal-400/30" },
  in_progress: { label: "Live", cls: "bg-violet-500/15 text-violet-300 ring-violet-400/30", live: true },
  returning: { label: "Returning", cls: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30" },
  reconciliation: { label: "Checking returns", cls: "bg-orange-500/15 text-orange-300 ring-orange-400/30" },
  archived: { label: "Done", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  cancelled: { label: "Cancelled", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
};
export function statusBadge(s: string): Badge {
  return EVENT_STATUS[s] ?? { label: s, cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" };
}

const SOURCE: Record<string, Badge> = {
  warehouse: { label: "warehouse", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  transfer: { label: "transfer", cls: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30" },
  rental: { label: "rental", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
};
export function sourceBadge(s: string): Badge {
  return SOURCE[s] ?? { label: s, cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" };
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
  return s === "found" ? { label: "Found", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" }
    : s === "written_off" ? { label: "Written off", cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" }
    : { label: "Open", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" };
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
