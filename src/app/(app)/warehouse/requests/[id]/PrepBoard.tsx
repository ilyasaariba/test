"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sourceBadge } from "@/lib/ui";
import { DRIVERS } from "@/lib/drivers";
import NumberInput from "@/components/NumberInput";
import Dropdown from "@/components/Dropdown";
import {
  toggleLinePrepared, setAllLinesPrepared, markPrepared, shipToEvent,
  markLineReturned, reportMissing, confirmReturned, resolveMissing, completeReconciliation,
} from "../../../events/[id]/lifecycle";

type Source = { source: string; quantity: number; label: string };
type Line = {
  id: string; equipmentId: string; name: string; category: string; importance: string;
  quantity: number; prepared: boolean; sources: Source[];
};
type Discrepancy = { id: string; equipment: string; quantity: number; isCritical: boolean; status: string; notes: string | null };

const inputCls = "rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";

export default function PrepBoard({
  eventId, status, lines, discrepancies,
}: {
  eventId: string;
  status: string;
  lines: Line[];
  discrepancies: Discrepancy[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // driver chosen at ship time
  const [driver, setDriver] = useState("");

  // per-line "report missing/damaged" form
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [rQty, setRQty] = useState(1);
  const [rReason, setRReason] = useState<"missing" | "damaged">("missing");
  const [rNote, setRNote] = useState("");

  const isPrep = status === "sent_to_warehouse";
  const isReturning = status === "returning";
  const isRecon = status === "reconciliation";
  const canTick = isPrep || isReturning;

  const total = lines.length;
  const preparedCount = lines.filter((l) => l.prepared).length;
  const pct = total ? Math.round((preparedCount / total) * 100) : 0;
  const allDone = total > 0 && preparedCount === total;

  const openMissing = discrepancies.filter((d) => d.status === "missing");

  const byCat = useMemo(() => {
    const m: Record<string, Line[]> = {};
    for (const l of lines) (m[l.category] ??= []).push(l);
    return Object.entries(m);
  }, [lines]);

  function run(fn: () => Promise<{ error: string } | void>, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r) setErr(r.error);
      else after?.();
    });
  }
  function toggle(l: Line) {
    if (isReturning) return run(() => markLineReturned(eventId, l.id, !l.prepared));
    return run(() => toggleLinePrepared(eventId, l.id, !l.prepared));
  }
  function openReport(l: Line) { setErr(null); setRQty(l.quantity); setRReason("missing"); setRNote(""); setReportFor(l.id); }

  const title = isRecon ? "Reconciliation" : isReturning ? "Return checklist" : "Pick list";
  const subtitle = isRecon
    ? `${openMissing.length} discrepanc${openMissing.length === 1 ? "y" : "ies"} to resolve`
    : isReturning
      ? `${preparedCount}/${total} checked in · ${lines.reduce((s, l) => s + l.quantity, 0)} units`
      : `${preparedCount}/${total} lines prepared · ${lines.reduce((s, l) => s + l.quantity, 0)} units`;

  return (
    <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".12s" }}>
      {/* header + progress */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          {!isRecon && <div className="text-right"><div className="text-2xl font-extrabold grad-text">{pct}%</div></div>}
        </div>
        {!isRecon && (
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-3">
            <div className="h-full grad transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        {isPrep && total > 0 && (
          <div className="mt-3 flex justify-end">
            <button disabled={pending} onClick={() => run(() => setAllLinesPrepared(eventId, !allDone))}
              className="inline-flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition disabled:opacity-50">
              <span className="ms" style={{ fontSize: 16 }}>{allDone ? "remove_done" : "done_all"}</span>
              {allDone ? "Uncheck all" : "Confirm all"}
            </button>
          </div>
        )}
      </div>

      {err && <div className="mx-5 mt-4 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      {/* discrepancies panel (reconciliation = actionable; returning = informational) */}
      {(isRecon || (isReturning && discrepancies.length > 0)) && (
        <div className="mx-5 mt-4 rounded-xl bg-rose-500/5 ring-1 ring-rose-400/20 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-rose-300 mb-2 flex items-center gap-1">
            <span className="ms" style={{ fontSize: 16 }}>report</span> Discrepancies
          </div>
          <div className="space-y-1.5">
            {discrepancies.map((d) => {
              const resolved = d.status !== "missing";
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {d.quantity}× {d.equipment}
                      {d.isCritical && <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 text-[10px] font-bold">critical</span>}
                    </div>
                    {d.notes && <div className="text-[11px] text-slate-500 truncate">{d.notes}</div>}
                  </div>
                  {resolved ? (
                    <span className={`text-[11px] font-semibold ${d.status === "found" ? "text-emerald-300" : "text-slate-400"}`}>
                      {d.status === "found" ? "✓ found" : "written off"}
                    </span>
                  ) : isRecon ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button disabled={pending} onClick={() => run(() => resolveMissing(eventId, d.id, "found"))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25 transition">Found</button>
                      <button disabled={pending} onClick={() => run(() => resolveMissing(eventId, d.id, "written_off"))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold glass hover:bg-white/10 transition">Write off</button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-rose-300 font-semibold shrink-0">missing</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* lines grouped by category */}
      <div className="divide-y divide-white/5">
        {byCat.map(([cat, items]) => (
          <div key={cat} className="px-5 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">{cat}</div>
            <div className="space-y-1.5">
              {items.map((l) => (
                <div key={l.id}>
                  <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${l.prepared ? "bg-emerald-500/5" : "bg-white/5"}`}>
                    <button
                      disabled={!canTick || pending}
                      onClick={() => toggle(l)}
                      className={`h-6 w-6 shrink-0 grid place-items-center rounded-md ring-1 transition
                        ${l.prepared ? "bg-emerald-500/20 ring-emerald-400/40 text-emerald-300" : "bg-white/5 ring-white/15 text-transparent"}
                        ${canTick ? "hover:ring-indigo-400/50 cursor-pointer" : "cursor-default opacity-80"}`}>
                      <span className="ms" style={{ fontSize: 16 }}>check</span>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <span className={l.prepared ? "text-slate-300" : ""}>{l.name}</span>
                        {l.importance === "critical" && <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 text-[10px] font-bold">critical</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {l.sources.map((s, i) => {
                          const sb = sourceBadge(s.source);
                          return <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1 ${sb.cls}`}>{s.quantity} {s.label}</span>;
                        })}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      {isReturning && !l.prepared && (
                        <button onClick={() => (reportFor === l.id ? setReportFor(null) : openReport(l))}
                          className="text-[11px] font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-0.5">
                          <span className="ms" style={{ fontSize: 14 }}>report</span> missing?
                        </button>
                      )}
                      <div><div className="font-bold">{l.quantity}</div><div className="text-[10px] text-slate-500">{isReturning ? "out" : "needed"}</div></div>
                    </div>
                  </div>

                  {/* report missing/damaged form */}
                  {isReturning && reportFor === l.id && (
                    <div className="ml-9 mt-1.5 glass rounded-xl p-3 flex flex-wrap items-end gap-2">
                      <div><label className="block text-[11px] text-slate-400 mb-1">Qty</label>
                        <NumberInput min={1} max={l.quantity} value={rQty} onChange={(e) => setRQty(parseInt(e.target.value || "1", 10))} className={`${inputCls} w-20`} /></div>
                      <div><label className="block text-[11px] text-slate-400 mb-1">Reason</label>
                        <div className="flex gap-1">
                          {(["missing", "damaged"] as const).map((x) => (
                            <button key={x} onClick={() => setRReason(x)}
                              className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition ${rReason === x ? "grad text-white" : "glass hover:bg-white/10 text-slate-300"}`}>{x}</button>
                          ))}
                        </div></div>
                      <input value={rNote} onChange={(e) => setRNote(e.target.value)} placeholder="Note (optional)" className={`${inputCls} flex-1 min-w-[10rem]`} />
                      <button disabled={pending} onClick={() => run(() => reportMissing(eventId, l.equipmentId, rQty, rReason, rNote), () => setReportFor(null))}
                        className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2">Report</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {total === 0 && <p className="px-5 py-8 text-sm text-slate-500">No equipment on this request.</p>}
      </div>

      {/* action footer */}
      <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
        {isPrep && (
          <>
            <p className="text-sm text-slate-400">{allDone ? "Everything picked — ready to mark prepared." : "Tick each line as you pick & pack it."}</p>
            <button disabled={pending} onClick={() => run(() => markPrepared(eventId), () => router.push("/warehouse/requests"))}
              className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
              <span className="ms" style={{ fontSize: 18 }}>inventory_2</span> Mark prepared
            </button>
          </>
        )}
        {status === "prepared" && (
          <>
            <p className="text-sm text-emerald-300">Packed & ready. Choose a driver and hand it off.</p>
            <div className="flex items-center gap-2">
              <Dropdown className="flex-1" value={driver} onChange={setDriver} placeholder="Choose driver…"
                options={DRIVERS.map((d) => ({ value: d, label: d }))} />
              <button disabled={pending || !driver} onClick={() => run(() => shipToEvent(eventId, driver))}
                className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
                <span className="ms" style={{ fontSize: 18 }}>local_shipping</span> Ship to event
              </button>
            </div>
          </>
        )}
        {status === "shipped" && <p className="text-sm text-amber-300">Shipped — waiting for the engineer to confirm it arrived on site.</p>}
        {isReturning && (
          <>
            <p className="text-sm text-cyan-300">
              {openMissing.length > 0
                ? "Some gear is missing/damaged — confirm to move into reconciliation."
                : allDone ? "All gear checked in — confirm to close the event." : "Tick what came back; flag anything missing, then confirm."}
            </p>
            <button disabled={pending} onClick={() => run(() => confirmReturned(eventId))}
              className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
              <span className="ms" style={{ fontSize: 18 }}>fact_check</span> Confirm returns
            </button>
          </>
        )}
        {isRecon && (
          <>
            <p className="text-sm text-slate-400">
              {openMissing.length > 0 ? "Resolve every discrepancy (found or written off) to close the event." : "All resolved — ready to close."}
            </p>
            <button disabled={pending || openMissing.length > 0} onClick={() => run(() => completeReconciliation(eventId))}
              className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
              <span className="ms" style={{ fontSize: 18 }}>task_alt</span> Mark as Done
            </button>
          </>
        )}
        {!["sent_to_warehouse", "prepared", "shipped", "returning", "reconciliation"].includes(status) && (
          <p className="text-sm text-slate-400">This request is no longer in the warehouse stage.</p>
        )}
      </div>
    </section>
  );
}
