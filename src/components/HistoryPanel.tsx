"use client";

import { useState } from "react";
import { getPageHistory, type HistoryItem } from "@/app/(app)/history";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7); if (d < 30) return `${w}w ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// Collapsed by default at the bottom of every page. On first open it loads the
// last 24 hours of finished activity across the whole app.
export default function HistoryPanel() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        setItems(await getPageHistory());
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  }

  async function refresh() {
    setLoading(true);
    try { setItems(await getPageHistory()); setLoaded(true); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <button onClick={toggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl glass hover:bg-[var(--surface2)] transition">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--sub)]">
          <span className="ms" style={{ fontSize: 18 }}>history</span>
          History
          <span className="text-xs text-[var(--faint)] font-normal">· archive of finished work{loaded ? ` · ${items.length}` : ""}</span>
        </span>
        <span className="ms text-[var(--faint)] transition-transform" style={{ fontSize: 20, transform: open ? "rotate(180deg)" : "none" }}>expand_more</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl glass overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border2)]">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Finished &amp; archived · moves here 24h after it ends</span>
            <button onClick={refresh} disabled={loading}
              className="text-[11px] font-semibold text-[var(--accent-hex)] hover:underline flex items-center gap-1 disabled:opacity-50">
              <span className="ms" style={{ fontSize: 14 }}>refresh</span>Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--faint)] flex items-center justify-center gap-2">
              <span className="ms animate-spin" style={{ fontSize: 18 }}>progress_activity</span> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="ms text-[var(--faint)]" style={{ fontSize: 30 }}>inbox</span>
              <p className="text-sm text-[var(--sub)] mt-1">Nothing archived yet.</p>
              <p className="text-xs text-[var(--faint)] mt-1">Finished tasks, transfers and events move here automatically 24 hours after they end.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border2)] max-h-[420px] overflow-auto">
              {items.map((it) => (
                <div key={it.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${it.tone}`}>
                    <span className="ms" style={{ fontSize: 17 }}>{it.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{it.title}</div>
                    {it.detail && <div className="text-[11px] text-[var(--faint)] truncate">{it.detail}</div>}
                  </div>
                  <div className="text-[11px] text-[var(--faint)] shrink-0 pt-0.5">{ago(it.at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
