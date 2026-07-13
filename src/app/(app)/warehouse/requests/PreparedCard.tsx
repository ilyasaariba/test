"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { fmtDMY } from "@/lib/ui";
import { DRIVERS } from "@/lib/drivers";
import Dropdown from "@/components/Dropdown";
import { shipToEvent } from "../../events/[id]/lifecycle";

type Ev = { id: string; name: string; client: string | null; location: string | null; live_start: string | null };

// A "Ready to ship" card with a Ship shortcut, so the WM can hand off
// straight from the inbox without opening the detail and scrolling down.
export default function PreparedCard({ event, total, qty }: { event: Ev; total: number; qty: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [driver, setDriver] = useState("");

  function ship() {
    setErr(null);
    start(async () => {
      const r = await shipToEvent(event.id, driver);
      if (r && "error" in r) setErr(r.error);
      // success: the action revalidates the inbox → card moves to "In transit".
    });
  }

  return (
    <div className="card glass rounded-2xl p-4">
      <Link href={`/warehouse/requests/${event.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{event.name}</div>
            <div className="text-xs text-slate-500 truncate">{event.client ? `${event.client} · ` : ""}{event.location ?? ""}</div>
          </div>
          <span className="ms text-slate-500 shrink-0" style={{ fontSize: 18 }}>chevron_right</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-400">{total} lines · {qty} units</span>
          <span className="text-slate-400">live {fmtDMY(event.live_start)}</span>
        </div>
      </Link>

      {err && <p className="mt-2 text-[11px] text-rose-300">{err}</p>}

      <div className="mt-3">
        <Dropdown value={driver} onChange={setDriver} placeholder="Choose driver…"
          options={DRIVERS.map((d) => ({ value: d, label: d }))} />
      </div>

      <button disabled={pending || !driver} onClick={ship}
        className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 mt-2 w-full flex items-center justify-center gap-2 disabled:opacity-50">
        <span className="ms" style={{ fontSize: 18 }}>local_shipping</span>{pending ? "Shipping…" : "Ship to event"}
      </button>
    </div>
  );
}
