"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ROLE_LABEL } from "@/lib/ui";

type Item = { label: string; href: string; icon: string };
type Section = { cap?: string; items: Item[] };

const NAV: Record<string, Section[]> = {
  engineer: [
    { items: [
      { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
      { label: "Events", href: "/events", icon: "event" },
      { label: "Tasks", href: "/tasks", icon: "task_alt" },
    ]},
    { cap: "Inventory", items: [
      { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
      { label: "Transfer Record", href: "/transfers", icon: "swap_horiz" },
      { label: "Missing", href: "/missing", icon: "report" },
    ]},
  ],
  admin: [
    { items: [
      { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
      { label: "Events", href: "/events", icon: "event" },
      { label: "Tasks", href: "/tasks", icon: "task_alt" },
    ]},
    { cap: "Inventory", items: [
      { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
      { label: "Requests", href: "/warehouse/requests", icon: "assignment" },
      { label: "Transfer Record", href: "/transfers", icon: "swap_horiz" },
      { label: "Missing", href: "/missing", icon: "report" },
    ]},
    { cap: "Organization", items: [
      { label: "Users", href: "/users", icon: "group" },
    ]},
  ],
  warehouse_manager: [
    { items: [
      { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
      { label: "Events", href: "/events", icon: "event" },
    ]},
    { cap: "Inventory", items: [
      { label: "Requests", href: "/warehouse/requests", icon: "assignment" },
      { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
      { label: "Missing", href: "/missing", icon: "report" },
    ]},
  ],
  technician: [
    { items: [
      { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
      { label: "My events", href: "/events", icon: "event" },
      { label: "Tasks", href: "/tasks", icon: "task_alt" },
    ]},
  ],
  boss: [
    { items: [
      { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
      { label: "Events", href: "/events", icon: "event" },
    ]},
    { cap: "Inventory", items: [
      { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
      { label: "Missing", href: "/missing", icon: "report" },
    ]},
  ],
};

export default function Sidebar({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // close the mobile drawer on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  const sections = NAV[role] ?? NAV.technician;
  const all = sections.flatMap((s) => s.items);
  const activeHref = all
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const initials = fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      {/* mobile hamburger — sits in the topbar's reserved left slot */}
      <button onClick={() => setOpen(true)}
        className="lg:hidden fixed top-2.5 left-3 z-40 h-9 w-9 grid place-items-center rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--sub)]" title="Menu">
        <span className="ms" style={{ fontSize: 20 }}>menu</span>
      </button>

      {/* backdrop */}
      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />}

      <aside className={`w-56 shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col px-3 py-4 z-50
        lg:translate-x-0
        max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-64 max-lg:transition-transform max-lg:duration-200 max-lg:shadow-xl
        ${open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"}`}>

        <div className="lg:hidden flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-md grad grid place-items-center font-bold text-[10px]">M212</span>
            <span className="font-semibold text-sm">M212 Logistics</span>
          </div>
          <button onClick={() => setOpen(false)} className="ms text-[var(--faint)] hover:text-[var(--ink)] p-1" style={{ fontSize: 21 }}>close</button>
        </div>

        <nav className="space-y-0.5 text-[13.5px] font-medium">
          {sections.map((sec, si) => (
            <div key={si}>
              {sec.cap && (
                <div className="px-3 pt-4 pb-1 text-[10.5px] font-semibold uppercase tracking-[.1em] text-[var(--faint)]">
                  {sec.cap}
                </div>
              )}
              {sec.items.map((it) => {
                const active = it.href === activeHref;
                return (
                  <Link key={it.href} href={it.href}
                    className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg ${active ? "nav-active" : ""}`}>
                    <span className="ms" style={{ fontSize: 19 }}>{it.icon}</span>
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--border2)] pt-3 px-2 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent-hex)] grid place-items-center text-[11px] font-bold shrink-0">{initials}</div>
          <div className="text-[13px] leading-tight min-w-0">
            <div className="font-semibold truncate">{fullName}</div>
            <div className="text-[11px] text-[var(--faint)]">{ROLE_LABEL[role] ?? role}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
