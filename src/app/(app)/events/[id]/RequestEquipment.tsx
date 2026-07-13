"use client";

import { useMemo, useState, useTransition } from "react";
import Dropdown from "@/components/Dropdown";
import { requestEquipment } from "./transfer-flow";

type CatItem = { id: string; name: string; category: string; available: number };
type Holder = { id: string; name: string; qty: number };
type Tech = { id: string; full_name: string };

type Source = { key: string; type: "warehouse" | "event"; name: string; have: number; eventId?: string };
type Item = { equip: CatItem; need: number; alloc: Record<string, { qty: number; tech: string }> };
type ReqAlloc = { sourceType: "warehouse" | "event"; fromEventId?: string; quantity: number; assignedTo?: string };

export default function RequestEquipment({
  eventId, catalog, holdersByEquip, crewByEvent,
}: {
  eventId: string;
  catalog: CatItem[];
  holdersByEquip: Record<string, Holder[]>;
  crewByEvent: Record<string, Tech[]>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const usedIds = new Set(items.map((it) => it.equip.id));
  const results = useMemo(
    () => catalog.filter((c) => !usedIds.has(c.id) && c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8),
    [catalog, q, items],
  );

  function sourcesFor(equip: CatItem): Source[] {
    const holders = holdersByEquip[equip.id] ?? [];
    return [
      { key: "wh", type: "warehouse", name: "Warehouse", have: equip.available },
      ...holders.map((h) => ({ key: h.id, type: "event" as const, name: h.name, have: h.qty, eventId: h.id })),
    ];
  }
  function info(it: Item) {
    const sources = sourcesFor(it.equip);
    const allocated = Object.values(it.alloc).reduce((s, a) => s + (a.qty || 0), 0);
    const over = allocated > it.need;
    const missingTech = sources.some((s) => s.type === "event" && (it.alloc[s.key]?.qty ?? 0) > 0 && !it.alloc[s.key]?.tech);
    const valid = allocated >= 1 && !over && !missingTech;
    return { sources, allocated, over, missingTech, valid };
  }

  const totalReqs = items.reduce((s, it) => s + info(it).allocated, 0);
  const canSend = items.length > 0 && items.every((it) => info(it).valid);

  function addItem(c: CatItem) {
    setItems((prev) => [...prev, { equip: c, need: 1, alloc: {} }]);
    setQ(""); setDone(null); setErr(null);
  }
  function removeItem(id: string) { setItems((prev) => prev.filter((it) => it.equip.id !== id)); }
  function patch(id: string, fn: (it: Item) => Item) { setItems((prev) => prev.map((it) => (it.equip.id === id ? fn(it) : it))); }

  function setNeed(id: string, v: number) { patch(id, (it) => ({ ...it, need: Math.max(1, v) })); }
  function setQty(id: string, key: string, cap: number, next: number) {
    patch(id, (it) => {
      const elsewhere = Object.entries(it.alloc).reduce((s, [k, val]) => s + (k === key ? 0 : val.qty || 0), 0);
      const maxForThis = Math.max(0, Math.min(cap, it.need - elsewhere));
      const qty = Math.max(0, Math.min(next, maxForThis));
      return { ...it, alloc: { ...it.alloc, [key]: { qty, tech: it.alloc[key]?.tech ?? "" } } };
    });
  }
  function setTech(id: string, key: string, tech: string) {
    patch(id, (it) => ({ ...it, alloc: { ...it.alloc, [key]: { qty: it.alloc[key]?.qty ?? 0, tech } } }));
  }

  function submit() {
    const payload = items.map((it) => {
      const sources = sourcesFor(it.equip);
      return {
        equipmentId: it.equip.id,
        totalNeeded: it.need,
        allocations: sources
          .filter((s) => (it.alloc[s.key]?.qty ?? 0) > 0)
          .map((s): ReqAlloc => s.type === "warehouse"
            ? { sourceType: "warehouse", quantity: it.alloc[s.key].qty }
            : { sourceType: "event", fromEventId: s.eventId, quantity: it.alloc[s.key].qty, assignedTo: it.alloc[s.key].tech }),
      };
    });
    setErr(null); setDone(null);
    start(async () => {
      const r = await requestEquipment(eventId, payload);
      if (r && "error" in r) { setErr(r.error); return; }
      setDone(`Sent ${totalReqs} unit${totalReqs === 1 ? "" : "s"} across ${items.length} item${items.length === 1 ? "" : "s"} — everyone was notified.`);
      setItems([]); setQ(""); setOpen(true);
    });
  }

  return (
    <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".21s" }}>
      <button onClick={() => { setOpen((v) => !v); setDone(null); }}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <span className="ms grad-text" style={{ fontSize: 20 }}>add_shopping_cart</span>
          <div>
            <h2 className="font-bold">Request equipment</h2>
            <p className="text-xs text-slate-500">Add several items — split each across the warehouse and other events.</p>
          </div>
        </div>
        <span className="ms text-slate-400 transition-transform" style={{ fontSize: 22, transform: open ? "rotate(180deg)" : "none" }}>expand_more</span>
      </button>

      {done && !open && (
        <div className="mx-5 mb-4 rounded-lg bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30 px-3 py-2 text-sm flex items-center gap-2">
          <span className="ms" style={{ fontSize: 16 }}>check_circle</span>{done}
        </div>
      )}

      {open && (
        <div className="px-5 pb-5 border-t border-white/10 pt-4 space-y-4">
          {err && <div className="rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}
          {done && <div className="rounded-lg bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30 px-3 py-2 text-sm flex items-center gap-2"><span className="ms" style={{ fontSize: 16 }}>check_circle</span>{done}</div>}

          {/* configured items */}
          {items.map((it) => {
            const { sources, allocated, over, remaining } = { ...info(it), remaining: it.need - info(it).allocated };
            return (
              <div key={it.equip.id} className="rounded-xl ring-1 ring-white/10 bg-white/[.03] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="ms text-indigo-300" style={{ fontSize: 18 }}>inventory_2</span>
                    <span className="font-semibold truncate">{it.equip.name}</span>
                    <span className="text-[11px] text-slate-500">{it.equip.category}</span>
                  </div>
                  <button onClick={() => removeItem(it.equip.id)} className="ms text-slate-500 hover:text-rose-300" style={{ fontSize: 18 }} title="Remove item">delete</button>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-300">Need</label>
                  <Stepper value={it.need} min={1} onChange={(v) => setNeed(it.equip.id, v)} />
                  <span className={`text-xs font-semibold ml-auto ${over ? "text-rose-300" : allocated === it.need ? "text-emerald-300" : "text-slate-400"}`}>
                    allocated {allocated} / {it.need}{allocated === it.need ? " ✓" : remaining > 0 ? ` · ${remaining} left` : ""}
                  </span>
                </div>

                <div className="space-y-2">
                  {sources.map((s) => {
                    const crew = s.eventId ? crewByEvent[s.eventId] ?? [] : [];
                    const noCrew = s.type === "event" && crew.length === 0;
                    const qty = it.alloc[s.key]?.qty ?? 0;
                    const disabled = s.have <= 0 || noCrew;
                    return (
                      <div key={s.key} className={`rounded-lg px-3 py-2 ring-1 ${qty > 0 ? "bg-indigo-500/5 ring-indigo-400/20" : "bg-white/5 ring-white/10"}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`ms ${s.type === "warehouse" ? "text-sky-300" : "text-fuchsia-300"}`} style={{ fontSize: 17 }}>
                            {s.type === "warehouse" ? "warehouse" : "swap_horiz"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{s.name}</div>
                            <div className="text-[11px] text-slate-500">{noCrew ? "no crew — can't lend" : `has ${s.have}`}</div>
                          </div>
                          <Stepper value={qty} min={0} max={Math.min(s.have, it.need - (allocated - qty))} disabled={disabled}
                            onChange={(v) => setQty(it.equip.id, s.key, s.have, v)} />
                        </div>
                        {s.type === "event" && qty > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 shrink-0">assign to</span>
                            <Dropdown size="sm" className="w-52" value={it.alloc[s.key]?.tech ?? ""} onChange={(v) => setTech(it.equip.id, s.key, v)}
                              placeholder="crew member…" options={crew.map((t) => ({ value: t.id, label: t.full_name }))} />
                            {!it.alloc[s.key]?.tech && <span className="text-[11px] text-amber-300">pick a crew member</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {over && <p className="text-[11px] text-rose-300">Allocated more than needed — lower one.</p>}
                {!over && allocated > 0 && allocated < it.need && (
                  <p className="text-[11px] text-amber-300">{it.need - allocated} still unsourced — shows as a shortfall until found.</p>
                )}
              </div>
            );
          })}

          {/* add an item */}
          <div className="glass rounded-xl p-2">
            <div className="flex items-center gap-2 px-1.5 pb-1.5">
              <span className="ms text-slate-400" style={{ fontSize: 18 }}>{items.length ? "add" : "search"}</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={items.length ? "Add another item…" : "Search equipment to request…"}
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
            </div>
            {q && (
              <div className="max-h-48 overflow-auto space-y-0.5">
                {results.map((c) => (
                  <button key={c.id} onClick={() => addItem(c)}
                    className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-white/5 transition text-left">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">{c.category}<span className="ms text-indigo-300" style={{ fontSize: 18 }}>add_circle</span></span>
                  </button>
                ))}
                {!results.length && <p className="text-sm text-slate-500 px-2 py-2">No match.</p>}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <button disabled={pending || !canSend} onClick={submit}
                className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
                <span className="ms" style={{ fontSize: 18 }}>send</span>
                Send {totalReqs > 0 ? `${totalReqs} ` : ""}request{totalReqs === 1 ? "" : "s"}
              </button>
              <button onClick={() => { setItems([]); setQ(""); setOpen(false); }} className="px-3 py-2.5 rounded-xl text-sm font-semibold glass hover:bg-white/10">Cancel</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stepper({ value, min, max, disabled, onChange }: {
  value: number; min: number; max?: number; disabled?: boolean; onChange: (v: number) => void;
}) {
  const atMax = max !== undefined && value >= max;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button disabled={disabled || value <= min} onClick={() => onChange(value - 1)}
        className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10 disabled:opacity-30">
        <span className="ms" style={{ fontSize: 16 }}>remove</span>
      </button>
      <span className={`w-9 text-center font-bold text-sm ${disabled ? "text-slate-600" : ""}`}>{value}</span>
      <button disabled={disabled || atMax} onClick={() => onChange(value + 1)}
        className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10 disabled:opacity-30">
        <span className="ms" style={{ fontSize: 16 }}>add</span>
      </button>
    </div>
  );
}
