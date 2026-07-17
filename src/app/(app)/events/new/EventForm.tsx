"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createEvent, type NewEventInput } from "./actions";
import { fmtDMY } from "@/lib/ui";
import RangeCalendar from "@/components/RangeCalendar";
import Dropdown from "@/components/Dropdown";
import PageHeader from "@/components/PageHeader";

type Equip = { id: string; name: string; category: string; available: number };
type Holder = { id: string; name: string; qty: number };
type Tech = { id: string; full_name: string; username?: string };
type Me = { id: string; full_name: string };

// An equipment need being configured: total needed, how much comes from the
// warehouse, and per-source-event transfer allocations (qty + assigned tech).
type Item = {
  equip: Equip;
  need: number;
  wh: number;
  alloc: Record<string, { qty: number; tech: string }>; // key = holder event id
};

function toYMD(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function daysBetween(start: string, end: string) {
  const out: string[] = [];
  if (!start || !end) return out;
  const d = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (e < d) return out;
  const cur = new Date(d);
  while (cur <= e) { out.push(toYMD(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const inputCls =
  "w-full rounded-xl glass px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";
const labelCls = "block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide";

export default function EventForm({
  equipment, holdersByEquip, crewByEvent, technicians, me,
}: {
  equipment: Equip[];
  holdersByEquip: Record<string, Holder[]>;
  crewByEvent: Record<string, Tech[]>;
  technicians: Tech[];
  me: Me;
}) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ----- dates / phases -----
  const days = useMemo(() => daysBetween(start, end), [start, end]);
  const [liveStart, setLiveStart] = useState(0);
  const [liveEnd, setLiveEnd] = useState(0);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    const n = days.length;
    if (n <= 1) { setLiveStart(0); setLiveEnd(Math.max(0, n - 1)); }
    else if (n === 2) { setLiveStart(0); setLiveEnd(1); }
    else { setLiveStart(1); setLiveEnd(n - 2); }
    setSelecting(false);
  }, [days.length]);

  function clickDay(i: number) {
    if (!selecting) { setLiveStart(i); setLiveEnd(i); setSelecting(true); }
    else if (i >= liveStart) { setLiveEnd(i); setSelecting(false); }
    else { setLiveStart(i); setLiveEnd(i); setSelecting(true); }
  }

  // ----- equipment -----
  const [items, setItems] = useState<Item[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null); // one open editor at a time
  const [q, setQ] = useState("");
  const usedIds = new Set(items.map((it) => it.equip.id));
  const results = useMemo(
    () => equipment.filter((e) => !usedIds.has(e.id) && e.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8),
    [equipment, q, items],
  );

  function holdersFor(equip: Equip): Holder[] { return holdersByEquip[equip.id] ?? []; }
  function eventTotal(it: Item) { return Object.values(it.alloc).reduce((s, a) => s + (a.qty || 0), 0); }
  function allocated(it: Item) { return it.wh + eventTotal(it); }
  function itemValid(it: Item) {
    const over = allocated(it) > it.need;
    const missingTech = Object.values(it.alloc).some((a) => (a.qty || 0) > 0 && !a.tech);
    return allocated(it) >= 1 && !over && !missingTech;
  }

  function patch(id: string, fn: (it: Item) => Item) {
    setItems((prev) => prev.map((it) => (it.equip.id === id ? fn(it) : it)));
  }
  function addItem(e: Equip) {
    setItems((prev) => [...prev, { equip: e, need: 1, wh: Math.min(1, Math.max(0, e.available)), alloc: {} }]);
    setExpandedId(e.id); // open the one you just added
    setQ(""); setError(null);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.equip.id !== id));
    setExpandedId((cur) => (cur === id ? null : cur));
  }

  function setNeed(id: string, v: number) {
    patch(id, (it) => {
      const need = Math.max(1, v);
      const evTotal = eventTotal(it);
      const wh = evTotal === 0
        ? Math.min(need, Math.max(0, it.equip.available))
        : Math.min(it.wh, Math.max(0, Math.min(need - evTotal, it.equip.available)));
      return { ...it, need, wh };
    });
  }
  function setWh(id: string, v: number) {
    patch(id, (it) => {
      const cap = Math.min(it.equip.available, Math.max(0, it.need - eventTotal(it)));
      return { ...it, wh: Math.max(0, Math.min(v, cap)) };
    });
  }
  function setEventQty(id: string, eventId: string, have: number, v: number) {
    patch(id, (it) => {
      const otherEvents = Object.entries(it.alloc).reduce((s, [k, a]) => s + (k === eventId ? 0 : a.qty || 0), 0);
      const cap = Math.min(have, Math.max(0, it.need - otherEvents));
      const qty = Math.max(0, Math.min(v, cap));
      const wh = Math.max(0, Math.min(it.wh, it.need - (otherEvents + qty)));
      return { ...it, wh, alloc: { ...it.alloc, [eventId]: { qty, tech: it.alloc[eventId]?.tech ?? "" } } };
    });
  }
  function setEventTech(id: string, eventId: string, tech: string) {
    patch(id, (it) => ({ ...it, alloc: { ...it.alloc, [eventId]: { qty: it.alloc[eventId]?.qty ?? 0, tech } } }));
  }

  // short source summary for a collapsed item ("5 warehouse · 3 ← Mawazine")
  function sourceChips(it: Item): string[] {
    const out: string[] = [];
    if (it.wh > 0) out.push(`${it.wh} warehouse`);
    for (const h of holdersFor(it.equip)) {
      const qty = it.alloc[h.id]?.qty ?? 0;
      if (qty > 0) out.push(`${qty} ← ${h.name}`);
    }
    return out;
  }

  // ----- crew (drag & drop into Leads / Crew) -----
  const [crew, setCrew] = useState<{ userId: string; isLead: boolean }[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<"lead" | "crew" | "pool" | null>(null);

  const candidates: (Tech & { isYou?: boolean })[] = useMemo(
    () => [{ id: me.id, full_name: me.full_name, isYou: true }, ...technicians.filter((t) => t.id !== me.id)],
    [technicians, me],
  );
  const candMap = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const crewIds = new Set(crew.map((c) => c.userId));
  const pool = candidates.filter((c) => !crewIds.has(c.id));
  const leads = crew.filter((c) => c.isLead);
  const members = crew.filter((c) => !c.isLead);

  function place(userId: string, target: "lead" | "crew" | "pool") {
    setCrew((prev) => {
      const without = prev.filter((c) => c.userId !== userId);
      if (target === "pool") return without;
      return [...without, { userId, isLead: target === "lead" }];
    });
  }
  function onDrop(target: "lead" | "crew" | "pool") {
    if (draggingId) place(draggingId, target);
    setDraggingId(null); setOverZone(null);
  }

  // ----- submit -----
  const transfersCount = items.reduce((s, it) => s + Object.values(it.alloc).filter((a) => a.qty > 0).length, 0);
  const equipValid = items.every(itemValid);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Event name is required.");
    if (!days.length) return setError("Pick a start and end day.");
    if (!equipValid) return setError("Finish the equipment sourcing — check quantities and pick a technician for every transfer.");
    setBusy(true);
    const payload: NewEventInput = {
      name, client, location,
      montage_start: days[0], live_start: days[liveStart], live_end: days[liveEnd], demontage_end: days[days.length - 1],
      lines: items.map((it) => ({
        equipment_id: it.equip.id,
        totalNeeded: it.need,
        warehouseQty: it.wh,
        transfers: Object.entries(it.alloc)
          .filter(([, a]) => a.qty > 0)
          .map(([eventId, a]) => ({ fromEventId: eventId, quantity: a.qty, assignedTo: a.tech })),
      })),
      crew,
    };
    const res = await createEvent(payload);
    if (res?.error) { setError(res.error); setBusy(false); }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".05s" }}>
        <PageHeader
          icon="add_circle"
          back={{ href: "/events", label: "Events" }}
          title="New event"
          sub="Set the dates and crew on the left, then source the gear on the right."
        />
      </div>

      {error && <div className="rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3.5 py-2.5 text-sm font-medium reveal">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* ================= LEFT: details + dates ================= */}
        <div className="space-y-5">
          <section className="card glass rounded-2xl p-6 space-y-4 reveal" style={{ animationDelay: ".12s" }}>
            <h2 className="font-bold flex items-center gap-2"><span className="ms grad-text" style={{ fontSize: 20 }}>badge</span> Details</h2>
            <div><label className={labelCls}>Event name *</label>
              <input className={inputCls} placeholder="e.g. Summer Festival" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Client</label>
                <input className={inputCls} placeholder="Client / customer" value={client} onChange={(e) => setClient(e.target.value)} /></div>
              <div><label className={labelCls}>Location</label>
                <input className={inputCls} placeholder="Venue / city" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            </div>
          </section>

          <section className="card glass rounded-2xl p-6 reveal" style={{ animationDelay: ".18s" }}>
            <h2 className="font-bold flex items-center gap-2"><span className="ms grad-text" style={{ fontSize: 20 }}>calendar_month</span> Dates</h2>
            <p className="text-slate-400 text-xs mt-0.5 mb-4">Pick the first and last day (DD/MM/YYYY).</p>
            <RangeCalendar start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />

            {days.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Phases</h3>
                  <span className="text-xs text-slate-500">Tap the first &amp; last <span className="text-violet-300">Live</span> day</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {days.map((d, i) => {
                    const phase = i < liveStart ? "m" : i <= liveEnd ? "l" : "d";
                    const cls = phase === "l" ? "grad text-white border-transparent"
                      : phase === "m" ? "bg-indigo-500/20 text-indigo-200 border-indigo-400/30"
                      : "bg-slate-500/15 text-slate-300 border-slate-400/30";
                    return (
                      <button key={i} type="button" onClick={() => clickDay(i)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${cls} transition hover:scale-105`}>
                        {dm(d)}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="glass rounded-lg px-3 py-2"><div className="text-indigo-300 font-semibold">Montage</div><div className="text-slate-300 mt-0.5">{fmtDMY(days[0])}{liveStart > 0 ? ` – ${fmtDMY(days[liveStart - 1])}` : ""}</div></div>
                  <div className="glass rounded-lg px-3 py-2"><div className="text-violet-300 font-semibold">Live</div><div className="text-slate-300 mt-0.5">{fmtDMY(days[liveStart])} – {fmtDMY(days[liveEnd])}</div></div>
                  <div className="glass rounded-lg px-3 py-2"><div className="text-slate-300 font-semibold">Démontage</div><div className="text-slate-300 mt-0.5">{liveEnd < days.length - 1 ? `${fmtDMY(days[liveEnd + 1])} – ` : ""}{fmtDMY(days[days.length - 1])}</div></div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ================= RIGHT: equipment + crew ================= */}
        <div className="space-y-5">
          {/* ---- equipment ---- */}
          <section className="card glass rounded-2xl p-6 reveal" style={{ animationDelay: ".24s" }}>
            <h2 className="font-bold flex items-center gap-2"><span className="ms grad-text" style={{ fontSize: 20 }}>inventory_2</span> Equipment</h2>
            <p className="text-slate-400 text-xs mt-0.5 mb-4">Add what you need, then source each item from the warehouse and/or a transfer from another event.</p>

            {/* add an item — always on top; focusing it collapses the open editor */}
            <div className="glass rounded-xl p-2 mb-3">
              <div className="flex items-center gap-2 px-1.5 pb-1.5">
                <span className="ms text-slate-400" style={{ fontSize: 18 }}>{items.length ? "add" : "search"}</span>
                <input value={q} onFocus={() => setExpandedId(null)} onChange={(e) => setQ(e.target.value)}
                  placeholder={items.length ? "Add another item…" : "Search equipment to add…"}
                  className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
              </div>
              {q && (
                <div className="max-h-52 overflow-auto space-y-0.5">
                  {results.map((e) => (
                    <button key={e.id} type="button" onClick={() => addItem(e)}
                      className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-white/5 transition text-left">
                      <span className="text-sm font-medium">{e.name}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        {e.category} · <span className={e.available <= 0 ? "text-rose-300" : "text-emerald-300/80"}>{e.available} avail.</span>
                        <span className="ms text-indigo-300" style={{ fontSize: 18 }}>add_circle</span>
                      </span>
                    </button>
                  ))}
                  {!results.length && <p className="text-sm text-slate-500 px-2 py-2">No match.</p>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {items.map((it) => {
                const holders = holdersFor(it.equip);
                const total = allocated(it);
                const over = total > it.need;
                const remaining = it.need - total;
                const whCap = Math.min(it.equip.available, Math.max(0, it.need - eventTotal(it)));
                const valid = itemValid(it);

                // ---- collapsed summary ----
                if (it.equip.id !== expandedId) {
                  const chips = sourceChips(it);
                  return (
                    <div key={it.equip.id}
                      onClick={() => setExpandedId(it.equip.id)}
                      className="rounded-xl ring-1 ring-white/10 bg-white/[.03] hover:bg-white/[.06] transition px-3.5 py-2.5 flex items-center gap-3 cursor-pointer">
                      <span className={`ms ${valid ? "text-emerald-300" : "text-amber-300"}`} style={{ fontSize: 18 }}>
                        {valid ? "check_circle" : "error"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{it.equip.name}</span>
                          <span className="text-[11px] text-slate-500 shrink-0">×{it.need}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {chips.length ? chips.join(" · ") : "not sourced yet"}
                          {remaining > 0 && chips.length ? ` · ${remaining} short` : ""}
                        </div>
                      </div>
                      <span className="ms text-slate-500 shrink-0" style={{ fontSize: 18 }}>edit</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(it.equip.id); }}
                        className="ms text-slate-500 hover:text-rose-300 shrink-0" style={{ fontSize: 18 }} title="Remove">delete</button>
                    </div>
                  );
                }

                // ---- expanded editor ----
                return (
                  <div key={it.equip.id} className="rounded-xl ring-1 ring-indigo-400/30 bg-white/[.04] p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="ms text-indigo-300" style={{ fontSize: 18 }}>inventory_2</span>
                        <span className="font-semibold truncate">{it.equip.name}</span>
                        <span className="text-[11px] text-slate-500 shrink-0">{it.equip.category}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => setExpandedId(null)}
                          className="ms text-slate-500 hover:text-emerald-300" style={{ fontSize: 18 }} title="Done — collapse">check</button>
                        <button type="button" onClick={() => removeItem(it.equip.id)}
                          className="ms text-slate-500 hover:text-rose-300" style={{ fontSize: 18 }} title="Remove">delete</button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-slate-300">Need</label>
                      <Stepper value={it.need} min={1} onChange={(v) => setNeed(it.equip.id, v)} />
                      <span className={`text-xs font-semibold ml-auto ${over ? "text-rose-300" : total === it.need ? "text-emerald-300" : "text-slate-400"}`}>
                        sourced {total} / {it.need}{total === it.need ? " ✓" : remaining > 0 ? ` · ${remaining} left` : ""}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* warehouse source */}
                      <div className={`rounded-lg px-3 py-2 ring-1 flex items-center gap-3 ${it.wh > 0 ? "bg-sky-500/5 ring-sky-400/20" : "bg-white/5 ring-white/10"}`}>
                        <span className="ms text-sky-300" style={{ fontSize: 17 }}>warehouse</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">Warehouse</div>
                          <div className="text-[11px] text-slate-500">{it.equip.available} available</div>
                        </div>
                        <Stepper value={it.wh} min={0} max={whCap} disabled={it.equip.available <= 0}
                          onChange={(v) => setWh(it.equip.id, v)} />
                      </div>

                      {/* transfer sources */}
                      {holders.map((h) => {
                        const crewOf = crewByEvent[h.id] ?? [];
                        const noCrew = crewOf.length === 0;
                        const qty = it.alloc[h.id]?.qty ?? 0;
                        const disabled = h.qty <= 0 || noCrew;
                        return (
                          <div key={h.id} className={`rounded-lg px-3 py-2 ring-1 ${qty > 0 ? "bg-fuchsia-500/5 ring-fuchsia-400/20" : "bg-white/5 ring-white/10"}`}>
                            <div className="flex items-center gap-3">
                              <span className="ms text-fuchsia-300" style={{ fontSize: 17 }}>swap_horiz</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{h.name}</div>
                                <div className="text-[11px] text-slate-500">{noCrew ? "no crew — can't lend" : `transfer · has ${h.qty}`}</div>
                              </div>
                              <Stepper value={qty} min={0} max={Math.min(h.qty, it.need - (total - qty))} disabled={disabled}
                                onChange={(v) => setEventQty(it.equip.id, h.id, h.qty, v)} />
                            </div>
                            {qty > 0 && (
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] text-slate-400 shrink-0">assign to</span>
                                <Dropdown size="sm" className="w-48" value={it.alloc[h.id]?.tech ?? ""} onChange={(v) => setEventTech(it.equip.id, h.id, v)}
                                  placeholder="crew member…" options={crewOf.map((t) => ({ value: t.id, label: t.full_name }))} />
                                {!it.alloc[h.id]?.tech && <span className="text-[11px] text-amber-300">pick a crew member</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {over && <p className="text-[11px] text-rose-300">Sourced more than needed — lower one.</p>}
                    {!over && remaining > 0 && total > 0 && (
                      <p className="text-[11px] text-amber-300">{remaining} still unsourced — will show as a shortfall you can resolve later.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- crew: drag & drop ---- */}
          <section className="card glass rounded-2xl p-6 reveal" style={{ animationDelay: ".3s" }}>
            <h2 className="font-bold flex items-center gap-2"><span className="ms grad-text" style={{ fontSize: 20 }}>groups</span> Crew</h2>
            <p className="text-slate-400 text-xs mt-0.5 mb-4">Drag people into <span className="text-amber-300 font-semibold">Leads</span> or <span className="text-[var(--accent-hex)] font-semibold">Crew</span>. A lead can run the event when you&apos;re busy.</p>

            {/* drop zones */}
            <div className="grid sm:grid-cols-2 gap-3">
              <DropZone
                label="Leads" icon="star" tone="lead" count={leads.length}
                active={overZone === "lead"}
                onOver={() => setOverZone("lead")} onLeave={() => setOverZone((z) => (z === "lead" ? null : z))}
                onDrop={() => onDrop("lead")}>
                {leads.map((c) => (
                  <AssignedCard key={c.userId} name={candMap[c.userId]?.full_name ?? "—"} isYou={!!candMap[c.userId]?.isYou} tone="lead"
                    onDragStart={() => setDraggingId(c.userId)} onDragEnd={() => setDraggingId(null)}
                    onSwap={() => place(c.userId, "crew")} swapLabel="→ Crew"
                    onRemove={() => place(c.userId, "pool")} />
                ))}
                {leads.length === 0 && <ZoneHint>Drop a lead here</ZoneHint>}
              </DropZone>

              <DropZone
                label="Crew" icon="engineering" tone="crew" count={members.length}
                active={overZone === "crew"}
                onOver={() => setOverZone("crew")} onLeave={() => setOverZone((z) => (z === "crew" ? null : z))}
                onDrop={() => onDrop("crew")}>
                {members.map((c) => (
                  <AssignedCard key={c.userId} name={candMap[c.userId]?.full_name ?? "—"} isYou={!!candMap[c.userId]?.isYou} tone="crew"
                    onDragStart={() => setDraggingId(c.userId)} onDragEnd={() => setDraggingId(null)}
                    onSwap={() => place(c.userId, "lead")} swapLabel="★ Lead"
                    onRemove={() => place(c.userId, "pool")} />
                ))}
                {members.length === 0 && <ZoneHint>Drop crew here</ZoneHint>}
              </DropZone>
            </div>

            {/* the pool of people (also a drop target = remove) */}
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Team</div>
              <div
                onDragOver={(e) => { e.preventDefault(); setOverZone("pool"); }}
                onDragLeave={() => setOverZone((z) => (z === "pool" ? null : z))}
                onDrop={() => onDrop("pool")}
                className={`rounded-xl p-2 flex flex-wrap gap-2 min-h-[52px] ring-1 transition ${overZone === "pool" ? "ring-rose-400/40 bg-rose-500/5" : "ring-white/10 bg-white/[.02]"}`}>
                {pool.map((c) => (
                  <PoolCard key={c.id} name={c.full_name} isYou={!!c.isYou}
                    onDragStart={() => setDraggingId(c.id)} onDragEnd={() => setDraggingId(null)}
                    onAddCrew={() => place(c.id, "crew")} onAddLead={() => place(c.id, "lead")} />
                ))}
                {pool.length === 0 && <ZoneHint>Everyone is assigned — drag a card back here to unassign.</ZoneHint>}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-slate-500">
          {items.length} item{items.length === 1 ? "" : "s"} · {crew.length} crew{leads.length ? ` (${leads.length} lead)` : ""}
          {transfersCount > 0 ? ` · ${transfersCount} transfer${transfersCount === 1 ? "" : "s"} will be requested` : ""}
        </p>
        <div className="flex justify-end gap-2">
          <Link href="/events" className="px-4 py-2.5 rounded-xl glass text-sm font-semibold hover:bg-white/10 transition">Cancel</Link>
          <button onClick={submit} disabled={busy}
            className="btn-primary text-sm font-semibold rounded-xl px-5 py-2.5 flex items-center gap-2 disabled:opacity-60">
            {busy ? "Creating…" : <>Create event <span className="ms" style={{ fontSize: 18 }}>check</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- crew drag & drop pieces ---------- */

function DropZone({
  label, icon, tone, count, active, children, onOver, onLeave, onDrop,
}: {
  label: string; icon: string; tone: "lead" | "crew"; count: number; active: boolean;
  children: React.ReactNode;
  onOver: () => void; onLeave: () => void; onDrop: () => void;
}) {
  const accent = tone === "lead" ? "text-amber-300" : "text-[var(--accent-hex)]";
  const ring = active ? (tone === "lead" ? "ring-amber-400/50 bg-amber-500/5" : "ring-[var(--accent-hex)]/50 bg-[var(--accent-soft)]") : "ring-white/10 bg-white/[.02]";
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onOver(); }}
      onDragLeave={onLeave}
      onDrop={onDrop}
      className={`rounded-xl ring-1 p-3 min-h-[120px] transition ${ring}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`ms ${accent}`} style={{ fontSize: 17 }}>{icon}</span>
        <span className="text-xs font-bold">{label}</span>
        <span className="text-[11px] text-slate-500">{count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ZoneHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-500 px-1 py-1.5">{children}</p>;
}

function Avatar({ name, isYou }: { name: string; isYou?: boolean }) {
  return (
    <div className={`h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${isYou ? "bg-[var(--accent-hex)] text-white" : "bg-[var(--accent-soft)] text-[var(--accent-hex)]"}`}>
      {initials(name)}
    </div>
  );
}

function PoolCard({ name, isYou, onDragStart, onDragEnd, onAddCrew, onAddLead }: {
  name: string; isYou?: boolean;
  onDragStart: () => void; onDragEnd: () => void; onAddCrew: () => void; onAddLead: () => void;
}) {
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="group rounded-lg ring-1 ring-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 flex items-center gap-2 cursor-grab active:cursor-grabbing">
      <Avatar name={name} isYou={isYou} />
      <span className="text-sm font-medium">{name}{isYou ? " (You)" : ""}</span>
      <span className="flex items-center gap-0.5 ml-1">
        <button type="button" onClick={onAddLead} title="Make lead"
          className="ms text-slate-500 hover:text-amber-300" style={{ fontSize: 17 }}>star</button>
        <button type="button" onClick={onAddCrew} title="Add to crew"
          className="ms text-slate-500 hover:text-[var(--accent-hex)]" style={{ fontSize: 17 }}>add_circle</button>
      </span>
    </div>
  );
}

function AssignedCard({ name, isYou, tone, onDragStart, onDragEnd, onSwap, swapLabel, onRemove }: {
  name: string; isYou?: boolean; tone: "lead" | "crew";
  onDragStart: () => void; onDragEnd: () => void; onSwap: () => void; swapLabel: string; onRemove: () => void;
}) {
  const ring = tone === "lead" ? "ring-amber-400/25 bg-amber-500/10" : "ring-[var(--accent-hex)]/20 bg-[var(--accent-soft)]";
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className={`rounded-lg ring-1 ${ring} px-2.5 py-1.5 flex items-center gap-2 cursor-grab active:cursor-grabbing`}>
      <Avatar name={name} isYou={isYou} />
      <span className="text-sm font-medium truncate flex-1">{name}{isYou ? " (You)" : ""}</span>
      <button type="button" onClick={onSwap} title={swapLabel}
        className="text-[10px] font-semibold text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded shrink-0">{swapLabel}</button>
      <button type="button" onClick={onRemove} title="Unassign"
        className="ms text-slate-500 hover:text-rose-300 shrink-0" style={{ fontSize: 16 }}>close</button>
    </div>
  );
}

function Stepper({ value, min, max, disabled, onChange }: {
  value: number; min: number; max?: number; disabled?: boolean; onChange: (v: number) => void;
}) {
  const atMax = max !== undefined && value >= max;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}
        className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10 disabled:opacity-30">
        <span className="ms" style={{ fontSize: 16 }}>remove</span>
      </button>
      <span className={`w-8 text-center font-bold text-sm ${disabled ? "text-slate-600" : ""}`}>{value}</span>
      <button type="button" disabled={disabled || atMax} onClick={() => onChange(value + 1)}
        className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10 disabled:opacity-30">
        <span className="ms" style={{ fontSize: 16 }}>add</span>
      </button>
    </div>
  );
}
