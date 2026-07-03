"use client";

import { useState, useTransition } from "react";
import DeclareMissing from "@/components/DeclareMissing";
import { toggleLineConfirmed, setAllLinesConfirmed, confirmReceived } from "./lifecycle";

type Line = { id: string; equipmentId: string; name: string; importance: string; quantity: number; confirmed: boolean };

export default function ReceiveBoard({
  eventId, shipper, lines,
}: {
  eventId: string;
  shipper?: string | null;
  lines: Line[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const total = lines.length;
  const confirmedCount = lines.filter((l) => l.confirmed).length;
  const pct = total ? Math.round((confirmedCount / total) * 100) : 0;
  const allDone = total > 0 && confirmedCount === total;

  function run(fn: () => Promise<{ error: string } | void>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r) setErr(r.error);
    });
  }

  return (
    <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".15s" }}>
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Receiving checklist</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Check off what actually arrived{shipper ? <> from <span className="text-slate-300 font-medium">{shipper}</span></> : null} · {confirmedCount}/{total} checked
            </p>
          </div>
          <div className="text-right"><div className="text-2xl font-extrabold grad-text">{pct}%</div></div>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-3">
          <div className="h-full grad transition-all" style={{ width: `${pct}%` }} />
        </div>
        {total > 0 && (
          <div className="mt-3 flex justify-end">
            <button disabled={pending} onClick={() => run(() => setAllLinesConfirmed(eventId, !allDone))}
              className="inline-flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition disabled:opacity-50">
              <span className="ms" style={{ fontSize: 16 }}>{allDone ? "remove_done" : "done_all"}</span>
              {allDone ? "Uncheck all" : "Confirm all"}
            </button>
          </div>
        )}
      </div>

      {err && <div className="mx-5 mt-4 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      <div className="p-5 space-y-1.5">
        {total === 0 && <p className="text-sm text-slate-500">No equipment on this event.</p>}
        {lines.map((l) => (
          <div key={l.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${l.confirmed ? "bg-emerald-500/5" : "bg-white/5"}`}>
            <button disabled={pending} onClick={() => run(() => toggleLineConfirmed(eventId, l.id, !l.confirmed))}
              className={`h-6 w-6 shrink-0 grid place-items-center rounded-md ring-1 transition cursor-pointer
                ${l.confirmed ? "bg-emerald-500/20 ring-emerald-400/40 text-emerald-300" : "bg-white/5 ring-white/15 text-transparent hover:ring-indigo-400/50"}`}>
              <span className="ms" style={{ fontSize: 16 }}>check</span>
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <span className={l.confirmed ? "text-slate-300" : ""}>{l.name}</span>
                {l.importance === "critical" && <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 text-[10px] font-bold">critical</span>}
              </div>
            </div>
            <div className="text-right shrink-0"><div className="font-bold">{l.quantity}</div><div className="text-[10px] text-slate-500">sent</div></div>
          </div>
        ))}
      </div>

      {/* anything didn't arrive? declare it lost in transit (driver) */}
      <div className="px-5 pb-4">
        <div className="rounded-xl bg-rose-500/5 ring-1 ring-rose-400/20 p-3">
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
            <span className="ms text-rose-300" style={{ fontSize: 16 }}>report</span>
            Something didn&apos;t arrive or came damaged? Declare it — it&apos;s logged as lost in transit.
          </p>
          <DeclareMissing
            equipment={lines.map((l) => ({ id: l.equipmentId, name: l.name, importance: l.importance }))}
            fixedEvent={{ id: eventId, name: "" }}
            defaultPhase="transit"
            buttonLabel="Declare lost / damaged"
          />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400">{allDone ? "Everything checked in — confirm the delivery." : "Tick each item as you receive it, then confirm."}</p>
        <button disabled={pending} onClick={() => run(() => confirmReceived(eventId))}
          className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
          <span className="ms" style={{ fontSize: 18 }}>inventory</span> Confirm received on site
        </button>
      </div>
    </section>
  );
}
