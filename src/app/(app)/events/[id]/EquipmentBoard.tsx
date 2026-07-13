"use client";

import { useMemo, useState, useTransition } from "react";
import { sourceBadge } from "@/lib/ui";
import DateField from "@/components/DateField";
import NumberInput from "@/components/NumberInput";
import {
  addLine, setLineQty, removeLine,
  addWarehouseSource, addRentalSource, removeSource,
} from "./actions";

type Alloc = { id: string; source: string; quantity: number; lender?: string | null; fromEventId?: string | null };
type Line = { id: string; equipmentId: string; name: string; importance: string; quantity: number; allocations: Alloc[] };
type CatItem = { id: string; name: string; category: string; available: number };
type Pending = { fromEventName: string; quantity: number };
type Lent = { toEventName: string; quantity: number };

const inputCls = "rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";

export default function EquipmentBoard({
  eventId, editable, lines, catalog, eventNames, pendingByEquip, lentByEquip,
}: {
  eventId: string;
  editable: boolean;
  lines: Line[];
  catalog: CatItem[];
  eventNames: Record<string, string>;
  pendingByEquip: Record<string, Pending[]>;
  lentByEquip: Record<string, Lent[]>;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ lineId: string; tab: "warehouse" | "rental" } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");

  // panel fields
  const [whQty, setWhQty] = useState(1);
  const [rLender, setRLender] = useState(""); const [rQty, setRQty] = useState(1); const [rDue, setRDue] = useState("");

  const catMap = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c])), [catalog]);
  const usedIds = new Set(lines.map((l) => l.equipmentId));
  const addable = catalog.filter((c) => !usedIds.has(c.id) && c.name.toLowerCase().includes(q.toLowerCase()));

  function run(fn: () => Promise<{ error: string } | void>, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r) setErr(r.error);
      else after?.();
    });
  }
  function openPanel(lineId: string, shortfall: number) {
    setErr(null);
    setWhQty(Math.max(1, shortfall)); setRQty(Math.max(1, shortfall));
    setRLender(""); setRDue("");
    setPanel({ lineId, tab: "warehouse" });
  }

  return (
    <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".18s" }}>
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="font-bold">Equipment &amp; sourcing</h2>
        {editable && (
          <button onClick={() => setAddOpen((v) => !v)} className="px-3 py-1.5 rounded-lg text-sm font-semibold glass hover:bg-white/10 transition flex items-center gap-1">
            <span className="ms" style={{ fontSize: 18 }}>add</span> Add equipment
          </button>
        )}
      </div>

      {err && <div className="mx-5 mt-4 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      {/* add-equipment picker */}
      {editable && addOpen && (
        <div className="mx-5 mt-4 glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2"><span className="ms text-slate-400" style={{ fontSize: 18 }}>search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment to add…" className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" /></div>
          <div className="max-h-52 overflow-auto space-y-1">
            {addable.map((c) => (
              <button key={c.id} disabled={pending} onClick={() => run(() => addLine(eventId, c.id, 1), () => { setAddOpen(false); setQ(""); })}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/5 transition text-left">
                <div><div className="text-sm font-medium">{c.name}</div><div className="text-[11px] text-slate-500">{c.category} · <span className={c.available <= 0 ? "text-rose-300" : "text-emerald-300/80"}>{c.available} available</span></div></div>
                <span className="ms text-indigo-300" style={{ fontSize: 20 }}>add_circle</span>
              </button>
            ))}
            {!addable.length && <p className="text-sm text-slate-500 px-1 py-2">No more equipment to add.</p>}
          </div>
        </div>
      )}

      {/* lines */}
      <div className="divide-y divide-white/5">
        {lines.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">No equipment on this event yet.</p>}
        {lines.map((l) => {
          const sourced = l.allocations.reduce((s, a) => s + a.quantity, 0);
          const shortfall = l.quantity - sourced;
          const isOpen = panel?.lineId === l.id;
          return (
            <div key={l.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {l.name}
                    {l.importance === "critical" && <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 text-[10px] font-bold">critical</span>}
                  </div>
                  {/* sourcing chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {l.allocations.map((a) => {
                      const sb = sourceBadge(a.source);
                      const tail = a.source === "rental" ? ` ← ${a.lender ?? "lender"}`
                        : a.source === "transfer" ? ` ← ${a.fromEventId ? eventNames[a.fromEventId] ?? "event" : "event"}` : "";
                      return (
                        <span key={a.id} className={`px-2 py-0.5 rounded-md text-xs font-semibold ring-1 flex items-center gap-1 ${sb.cls}`}>
                          {a.quantity} {sb.label}{tail}
                          {editable && <button onClick={() => run(() => removeSource(eventId, a.id))} disabled={pending} className="ms hover:opacity-70" style={{ fontSize: 14 }}>close</button>}
                        </span>
                      );
                    })}
                    {shortfall > 0 && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">⚠ {shortfall} to source</span>}
                    {shortfall === 0 && sourced > 0 && <span className="text-emerald-400 text-xs font-semibold">✓ fully sourced</span>}
                    {shortfall < 0 && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">over by {-shortfall}</span>}
                    {(pendingByEquip[l.equipmentId] ?? []).map((p, i) => (
                      <span key={`pend-${i}`} className="px-2 py-0.5 rounded-md text-xs font-semibold bg-fuchsia-500/10 text-fuchsia-200 ring-1 ring-fuchsia-400/25 flex items-center gap-1">
                        <span className="ms" style={{ fontSize: 13 }}>hourglass_top</span>{p.quantity} requested ← {p.fromEventName}
                      </span>
                    ))}
                    {(lentByEquip[l.equipmentId] ?? []).map((p, i) => (
                      <span key={`lent-${i}`} className="px-2 py-0.5 rounded-md text-xs font-semibold bg-fuchsia-500/10 text-fuchsia-200 ring-1 ring-fuchsia-400/25 flex items-center gap-1">
                        <span className="ms" style={{ fontSize: 13 }}>call_made</span>{p.quantity} lent → {p.toEventName}
                      </span>
                    ))}
                  </div>
                </div>

                {/* needed qty + remove */}
                <div className="flex items-center gap-2 shrink-0">
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => run(() => setLineQty(eventId, l.id, l.quantity - 1))} disabled={pending || l.quantity <= 1} className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10 disabled:opacity-40"><span className="ms" style={{ fontSize: 16 }}>remove</span></button>
                      <span className="w-10 text-center font-bold">{l.quantity}</span>
                      <button onClick={() => run(() => setLineQty(eventId, l.id, l.quantity + 1))} disabled={pending} className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10"><span className="ms" style={{ fontSize: 16 }}>add</span></button>
                    </div>
                  ) : <span className="font-bold">{l.quantity}</span>}
                  {editable && <button onClick={() => run(() => removeLine(eventId, l.id))} disabled={pending} className="h-7 w-7 grid place-items-center rounded-lg glass text-slate-400 hover:text-rose-300"><span className="ms" style={{ fontSize: 16 }}>delete</span></button>}
                </div>
              </div>

              {/* add source */}
              {editable && (
                <div className="mt-3">
                  {!isOpen ? (
                    <button onClick={() => openPanel(l.id, Math.max(1, shortfall))} className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1">
                      <span className="ms" style={{ fontSize: 16 }}>add</span> Add source
                    </button>
                  ) : (
                    <div className="glass rounded-xl p-3 mt-1">
                      <div className="flex gap-1 mb-3">
                        {(["warehouse", "rental"] as const).map((t) => (
                          <button key={t} onClick={() => setPanel({ lineId: l.id, tab: t })}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${panel?.tab === t ? "grad text-white" : "hover:bg-white/10 text-slate-300"}`}>{t}</button>
                        ))}
                        <button onClick={() => setPanel(null)} className="ml-auto ms text-slate-500 hover:text-slate-300" style={{ fontSize: 18 }}>close</button>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">Need gear from another event, or a warehouse top-up? Use <span className="text-indigo-300 font-medium">Request equipment</span> below the board.</p>

                      {panel?.tab === "warehouse" && (
                        <div className="flex items-end gap-2 flex-wrap">
                          <div><label className="block text-[11px] text-slate-400 mb-1">Quantity (avail: {catMap[l.equipmentId]?.available ?? 0})</label>
                            <NumberInput min={1} value={whQty} onChange={(e) => setWhQty(parseInt(e.target.value || "1", 10))} className={`${inputCls} w-24`} /></div>
                          <button disabled={pending} onClick={() => run(() => addWarehouseSource(eventId, l.id, whQty), () => setPanel(null))} className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2">Add warehouse</button>
                          {whQty > (catMap[l.equipmentId]?.available ?? 0) && <span className="text-[11px] text-amber-300">exceeds available — allowed, but consider transfer/rental</span>}
                        </div>
                      )}

                      {panel?.tab === "rental" && (
                        <div className="flex items-end gap-2 flex-wrap">
                          <div><label className="block text-[11px] text-slate-400 mb-1">Lender</label><input value={rLender} onChange={(e) => setRLender(e.target.value)} placeholder="e.g. XYZ Rentals" className={`${inputCls} w-40`} /></div>
                          <div><label className="block text-[11px] text-slate-400 mb-1">Qty</label><NumberInput min={1} value={rQty} onChange={(e) => setRQty(parseInt(e.target.value || "1", 10))} className={`${inputCls} w-20`} /></div>
                          <div><label className="block text-[11px] text-slate-400 mb-1">Due back</label><DateField value={rDue} onChange={setRDue} placeholder="Due back" className="w-40" /></div>
                          <button disabled={pending} onClick={() => run(() => addRentalSource(eventId, l.id, l.equipmentId, rLender, rQty, rDue || null), () => setPanel(null))} className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2">Add rental</button>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
