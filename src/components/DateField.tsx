"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDMY } from "@/lib/ui";

function toYMD(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Single-date picker that always displays DD/MM/YYYY and outputs YYYY-MM-DD.
export default function DateField({
  value, onChange, placeholder = "DD/MM/YYYY", className = "",
}: {
  value: string;            // YYYY-MM-DD or ""
  onChange: (ymd: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value ? new Date(value + "T00:00:00") : new Date()));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayYMD = toYMD(today);
  const atMinMonth = view.getFullYear() < today.getFullYear()
    || (view.getFullYear() === today.getFullYear() && view.getMonth() <= today.getMonth());

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(1 - offset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}>
        <span className="ms text-slate-400" style={{ fontSize: 16 }}>calendar_month</span>
        <span className={value ? "" : "text-slate-500"}>{value ? fmtDMY(value) : placeholder}</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 z-50 w-64 rounded-xl bg-[#0c1022] ring-1 ring-white/10 shadow-2xl backdrop-blur-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" disabled={atMinMonth}
              onClick={() => { if (!atMinMonth) setView(new Date(view.getFullYear(), view.getMonth() - 1, 1)); }}
              className={`h-7 w-7 grid place-items-center rounded-lg glass ${atMinMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"}`}><span className="ms" style={{ fontSize: 16 }}>chevron_left</span></button>
            <div className="text-xs font-semibold">{MONTHS[view.getMonth()]} {view.getFullYear()}</div>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10"><span className="ms" style={{ fontSize: 16 }}>chevron_right</span></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 mb-1">
            {WD.map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const ymd = toYMD(d);
              const inMonth = d.getMonth() === view.getMonth();
              const past = ymd < todayYMD && ymd !== value;
              const sel = ymd === value;
              return (
                <button key={i} type="button" disabled={past}
                  onClick={() => { if (!past) { onChange(ymd); setOpen(false); } }}
                  className={`h-8 rounded-lg text-xs transition ${past ? "text-slate-700 opacity-40 cursor-not-allowed" : sel ? "grad text-white font-bold" : inMonth ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-white/5"}`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {value && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className="mt-2 w-full text-center text-[11px] text-slate-400 hover:text-slate-200">Clear</button>
          )}
        </div>
      )}
    </div>
  );
}
