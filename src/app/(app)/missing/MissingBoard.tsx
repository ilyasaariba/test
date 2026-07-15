"use client";

import { useState, useTransition } from "react";
import { fmtDMY, MISSING_PHASE, MISSING_REASON, missingStatusBadge } from "@/lib/ui";
import DeclareMissing from "@/components/DeclareMissing";
import { resolveMissingItem } from "./actions";

type Item = {
  id: string; equipment: string; quantity: number; isCritical: boolean;
  status: string; phase: string; reason: string; location: string | null;
  eventName: string | null; reporter: string | null; reportedAt: string | null; notes: string | null;
};
type Equip = { id: string; name: string; importance?: string };
type Ev = { id: string; name: string };

export default function MissingBoard({
  items, equipment, events, canDeclare, canResolve,
}: {
  items: Item[];
  equipment: Equip[];
  events: Ev[];
  canDeclare: boolean;
  canResolve: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function resolve(id: string, res: "found" | "written_off") {
    setErr(null); setBusy(id);
    start(async () => {
      const r = await resolveMissingItem(id, res);
      if (r && "error" in r) setErr(r.error);
      setBusy(null);
    });
  }

  const open = items.filter((i) => i.status === "missing");
  const resolved = items.filter((i) => i.status !== "missing");
  const criticalOpen = open.filter((i) => i.isCritical).length;

  function Row({ i }: { i: Item }) {
    const ph = MISSING_PHASE[i.phase] ?? MISSING_PHASE.other;
    const sb = missingStatusBadge(i.status);
    return (
      <div className="flex items-start gap-3 px-5 py-4">
        <div className={`h-9 w-9 shrink-0 grid place-items-center rounded-lg ${i.isCritical ? "bg-rose-500/15 text-rose-300" : "bg-white/5 text-slate-400"}`}>
          <span className="ms" style={{ fontSize: 18 }}>{i.status === "missing" ? "priority_high" : i.status === "found" ? "check" : "block"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{i.quantity}× {i.equipment}</span>
            {i.isCritical && <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 text-[10px] font-bold">critical</span>}
            <span className="px-1.5 py-0.5 rounded bg-white/5 ring-1 ring-white/10 text-[10px] font-semibold text-slate-300 flex items-center gap-0.5">
              <span className="ms" style={{ fontSize: 12 }}>{ph.icon}</span>{ph.label}
            </span>
            <span className="text-[11px] text-slate-500">{MISSING_REASON[i.reason] ?? i.reason}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {i.eventName ? <>{i.eventName} · </> : null}
            {i.location ? <>{i.location} · </> : null}
            {i.reporter ? <>by {i.reporter} · </> : null}
            {fmtDMY(i.reportedAt)}
          </div>
          {i.notes && <p className="text-xs text-slate-400 mt-1">{i.notes}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {i.status === "missing" && canResolve ? (
            <>
              <button disabled={pending} onClick={() => resolve(i.id, "found")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25 transition disabled:opacity-50">
                {busy === i.id && pending ? "…" : "Found"}
              </button>
              <button disabled={pending} onClick={() => resolve(i.id, "written_off")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold glass hover:bg-white/10 transition disabled:opacity-50">Write off</button>
            </>
          ) : (
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${sb.cls}`}>{sb.label}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap reveal" style={{ animationDelay: ".06s" }}>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Missing &amp; lost gear</h1>
          <p className="text-slate-400 text-sm mt-1">
            {open.length} open{criticalOpen > 0 ? <> · <span className="text-rose-300 font-semibold">{criticalOpen} critical</span></> : null} · {resolved.length} resolved
          </p>
        </div>
        {canDeclare && (
          <DeclareMissing equipment={equipment} events={events} buttonLabel="Declare missing item" />
        )}
      </div>

      {err && <div className="rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".12s" }}>
        <div className="px-5 py-3 border-b border-white/10 text-sm font-bold flex items-center gap-2">
          <span className="ms text-rose-300" style={{ fontSize: 18 }}>report</span> Open ({open.length})
        </div>
        <div className="divide-y divide-white/5">
          {open.length ? open.map((i) => <Row key={i.id} i={i} />)
            : <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing missing right now.</p>}
        </div>
      </section>

      {resolved.length > 0 && (
        <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".18s" }}>
          <div className="px-5 py-3 border-b border-white/10 text-sm font-bold flex items-center gap-2">
            <span className="ms text-slate-400" style={{ fontSize: 18 }}>history</span> Resolved ({resolved.length})
          </div>
          <div className="divide-y divide-white/5 opacity-80">
            {resolved.map((i) => <Row key={i.id} i={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
