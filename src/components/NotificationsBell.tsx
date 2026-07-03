"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNotificationRead, markAllNotificationsRead } from "@/app/(app)/actions";

type Notif = {
  id: string; type: string; title: string; body: string | null;
  eventId: string | null; isRead: boolean; createdAt: string;
};

const ICON: Record<string, string> = {
  event: "event", task: "task_alt", transfer: "swap_horiz",
  shortfall: "error", missing: "priority_high",
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

export default function NotificationsBell({ items, unread }: { items: Notif[]; unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // close when clicking anywhere outside the bell + panel
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openItem(n: Notif) {
    start(async () => { if (!n.isRead) await markNotificationRead(n.id); });
    setOpen(false);
    if (n.eventId) router.push(`/events/${n.eventId}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="relative h-10 w-10 grid place-items-center rounded-xl glass cursor-pointer text-slate-300 hover:text-white transition" title="Notifications">
        <span className="ms" style={{ fontSize: 20 }}>notifications</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full grad text-white text-[10px] font-bold dot-live">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl ring-1 ring-white/10 shadow-2xl z-50 overflow-hidden"
          style={{ background: "#0c1022", opacity: 1 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="font-bold text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={() => start(async () => { await markAllNotificationsRead(); })}
                className="text-xs font-semibold text-indigo-300 hover:text-indigo-200" style={{ color: "rgb(var(--accent))" }}>Mark all read</button>
            )}
          </div>
          <div className="max-h-96 overflow-auto divide-y divide-white/5">
            {items.length ? items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 flex gap-3 transition hover:bg-white/5 ${n.isRead ? "opacity-60" : ""}`}>
                <div className={`h-8 w-8 shrink-0 grid place-items-center rounded-lg ${n.isRead ? "bg-white/5 text-slate-400" : "grad text-white"}`}>
                  <span className="ms" style={{ fontSize: 18 }}>{ICON[n.type] ?? "notifications"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{n.title}</span>
                    {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 shrink-0" />}
                  </div>
                  {n.body && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[11px] text-slate-500 mt-0.5">{ago(n.createdAt)}</p>
                </div>
              </button>
            )) : (
              <p className="px-4 py-10 text-center text-sm text-slate-500">You&apos;re all caught up ✨</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
