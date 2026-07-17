"use client";

import { useState } from "react";
import { fmtDMY } from "@/lib/ui";

function toYMD(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function RangeCalendar({
  start, end, onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const [view, setView] = useState(() => (start ? new Date(start + "T00:00:00") : new Date()));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayYMD = toYMD(today);
  // never let the user step back before the current month
  const atMinMonth = view.getFullYear() < today.getFullYear()
    || (view.getFullYear() === today.getFullYear() && view.getMonth() <= today.getMonth());

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-based
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  // only render as many week-rows as this month actually needs (4, 5 or 6) —
  // no phantom trailing row of next-month days.
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const gridStart = new Date(first);
  gridStart.setDate(1 - offset);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  function click(d: Date) {
    const ymd = toYMD(d);
    if (ymd < todayYMD) return; // past days are not selectable
    if (d.getMonth() !== view.getMonth()) return; // other-month days: navigate first
    if (!start || (start && end)) onChange(ymd, "");
    else if (ymd >= start) onChange(start, ymd);
    else onChange(ymd, "");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" disabled={atMinMonth}
          onClick={() => { if (!atMinMonth) setView(new Date(view.getFullYear(), view.getMonth() - 1, 1)); }}
          className={`h-8 w-8 grid place-items-center rounded-lg glass transition ${atMinMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"}`}>
          <span className="ms" style={{ fontSize: 18 }}>chevron_left</span>
        </button>
        <div className="text-sm font-semibold">{MONTHS[view.getMonth()]} {view.getFullYear()}</div>
        <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="h-8 w-8 grid place-items-center rounded-lg glass hover:bg-white/10 transition">
          <span className="ms" style={{ fontSize: 18 }}>chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">
        {WD.map((w) => <div key={w}>{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const ymd = toYMD(d);
          const inMonth = d.getMonth() === view.getMonth();
          const past = ymd < todayYMD;
          const isStart = ymd === start;
          const isEnd = ymd === end;
          const inRange = start && end && ymd > start && ymd < end;
          const edge = isStart || isEnd;
          const disabled = past || !inMonth;
          return (
            <button key={i} type="button" onClick={() => click(d)} disabled={disabled}
              className={[
                "h-9 rounded-lg text-sm transition",
                !inMonth ? "text-slate-700 opacity-30 cursor-not-allowed"
                  : past ? "text-slate-700 opacity-40 cursor-not-allowed line-through decoration-slate-700"
                  : edge ? "grad text-white font-bold shadow-lg"
                  : inRange ? "bg-violet-500/20 text-violet-100"
                  : "text-slate-200 hover:bg-white/10",
              ].join(" ")}>
              {inMonth ? d.getDate() : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          {start && end ? <span><span className="grad-text font-semibold">{fmtDMY(start)}</span> → <span className="grad-text font-semibold">{fmtDMY(end)}</span></span>
            : start ? <span><span className="grad-text font-semibold">{fmtDMY(start)}</span> → pick the end day…</span>
            : "Pick the start day, then the end day."}
        </span>
        {start && (
          <button type="button" onClick={() => onChange("", "")}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg glass px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white transition">
            <span className="ms" style={{ fontSize: 14 }}>restart_alt</span>Reset
          </button>
        )}
      </div>
    </div>
  );
}
