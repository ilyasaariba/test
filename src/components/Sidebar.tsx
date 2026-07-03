"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ROLE_LABEL } from "@/lib/ui";

type Item = { label: string; href: string; icon: string };

const NAV: Record<string, Item[]> = {
  engineer: [
    { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
    { label: "Events", href: "/events", icon: "event" },
    { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
    { label: "Transfers", href: "/transfers", icon: "swap_horiz" },
    { label: "Tasks", href: "/tasks", icon: "task_alt" },
    { label: "Missing", href: "/missing", icon: "report" },
  ],
  admin: [
    { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
    { label: "Events", href: "/events", icon: "event" },
    { label: "Requests", href: "/warehouse/requests", icon: "assignment" },
    { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
    { label: "Transfers", href: "/transfers", icon: "swap_horiz" },
    { label: "Tasks", href: "/tasks", icon: "task_alt" },
    { label: "Missing", href: "/missing", icon: "report" },
    { label: "Users", href: "/users", icon: "group" },
  ],
  warehouse_manager: [
    { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
    { label: "Requests", href: "/warehouse/requests", icon: "assignment" },
    { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
    { label: "Events", href: "/events", icon: "event" },
    { label: "Missing", href: "/missing", icon: "report" },
  ],
  technician: [
    { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
    { label: "My events", href: "/events", icon: "event" },
    { label: "Tasks", href: "/tasks", icon: "task_alt" },
  ],
  boss: [
    { label: "Dashboard", href: "/dashboard", icon: "grid_view" },
    { label: "Events", href: "/events", icon: "event" },
    { label: "Warehouse", href: "/warehouse", icon: "inventory_2" },
    { label: "Missing", href: "/missing", icon: "report" },
  ],
};

// Each role gets a signature emblem next to the workspace name.
const ROLE_ICON: Record<string, string> = {
  engineer: "engineering",
  warehouse_manager: "warehouse",
  technician: "handyman",
  boss: "workspace_premium",
  admin: "shield_person",
};

export default function Sidebar({ role, fullName }: { role: string; fullName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // close the mobile drawer on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  const items = NAV[role] ?? NAV.technician;
  const activeHref = items
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const initials = fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      {/* mobile hamburger */}
      <button onClick={() => setOpen(true)}
        className="lg:hidden fixed top-5 left-4 z-40 h-10 w-10 grid place-items-center rounded-xl glass text-slate-200 shadow-lg" title="Menu">
        <span className="ms" style={{ fontSize: 22 }}>menu</span>
      </button>

      {/* backdrop */}
      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />}

      <aside className={`w-64 shrink-0 rounded-3xl glass flex flex-col p-4 z-50
        lg:m-3 lg:mr-0 lg:translate-x-0
        max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:m-0 max-lg:rounded-l-none max-lg:transition-transform max-lg:duration-300
        ${open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-10 w-10 rounded-2xl grad grid place-items-center font-black text-white shadow-lg">AV</div>
            <div>
              <div className="font-extrabold tracking-tight leading-none">AV Logistics</div>
              <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "rgb(var(--accent))" }}>
                <span className="ms" style={{ fontSize: 13 }}>{ROLE_ICON[role] ?? "person"}</span>
                {ROLE_LABEL[role] ?? role} workspace
              </div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden ms text-slate-400 hover:text-white p-1" style={{ fontSize: 22 }}>close</button>
        </div>

        <nav className="mt-6 space-y-1 text-sm font-medium text-slate-300">
          {items.map((it) => {
            const active = it.href === activeHref;
            return (
              <Link key={it.href} href={it.href}
                className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl ${active ? "nav-active" : ""}`}>
                <span className="ms" style={{ fontSize: 20 }}>{it.icon}</span>
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto glass rounded-2xl p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full grad grid place-items-center text-white text-sm font-bold">{initials}</div>
          <div className="text-sm leading-tight">
            <div className="font-semibold">{fullName}</div>
            <div className="text-[11px] text-slate-400">{ROLE_LABEL[role] ?? role}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
