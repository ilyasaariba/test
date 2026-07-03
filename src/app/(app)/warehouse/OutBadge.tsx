"use client";

import { useState } from "react";

export default function OutBadge({
  committed, events,
}: {
  committed: number;
  events: { name: string; qty: number; status: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-block align-top text-right">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-amber-300 text-xs ml-2 hover:text-amber-200 inline-flex items-center gap-0.5"
      >
        · {committed} out
        <span className="ms" style={{ fontSize: 14 }}>{open ? "expand_less" : "expand_more"}</span>
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col items-end gap-1">
          {events.length ? events.map((x, i) => (
            <span key={i} className="text-[11px] text-slate-400 whitespace-nowrap">
              <span className="text-slate-200 font-semibold">{x.qty}×</span> at {x.name}
            </span>
          )) : <span className="text-[11px] text-slate-500">—</span>}
        </div>
      )}
    </span>
  );
}
