"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createEvent, type NewEventInput } from "./actions";
import { fmtDMY } from "@/lib/ui";
import RangeCalendar from "@/components/RangeCalendar";
import NumberInput from "@/components/NumberInput";

type Equip = { id: string; name: string; category: string; available: number };

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

const inputCls =
  "w-full rounded-xl glass px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";
const labelCls = "block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide";

export default function EventForm({ equipment }: { equipment: Equip[] }) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [lines, setLines] = useState<{ equipment_id: string; quantity: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  // equipment picker
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = useMemo(() => ["All", ...Array.from(new Set(equipment.map((e) => e.category)))], [equipment]);
  const eqMap = useMemo(() => Object.fromEntries(equipment.map((e) => [e.id, e])), [equipment]);
  const selectedIds = new Set(lines.map((l) => l.equipment_id));
  const filtered = equipment.filter(
    (e) => (cat === "All" || e.category === cat) && e.name.toLowerCase().includes(q.toLowerCase()),
  );

  function addItem(id: string) { if (!selectedIds.has(id)) setLines((l) => [...l, { equipment_id: id, quantity: 1 }]); }
  function setQty(id: string, qty: number) { setLines((l) => l.map((x) => (x.equipment_id === id ? { ...x, quantity: Math.max(1, qty) } : x))); }
  function removeItem(id: string) { setLines((l) => l.filter((x) => x.equipment_id !== id)); }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Event name is required.");
    if (!days.length) return setError("Pick a start and end day.");
    setBusy(true);
    const payload: NewEventInput = {
      name, client, location,
      montage_start: days[0], live_start: days[liveStart], live_end: days[liveEnd], demontage_end: days[days.length - 1],
      lines: lines.filter((l) => l.equipment_id && l.quantity > 0),
    };
    const res = await createEvent(payload);
    if (res?.error) { setError(res.error); setBusy(false); }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="reveal" style={{ animationDelay: ".05s" }}>
        <Link href="/events" className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 w-fit">
          <span className="ms" style={{ fontSize: 16 }}>arrow_back</span> Events
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mt-2">New <span className="grad-text">event</span></h1>
        <p className="text-slate-400 text-sm mt-1">Set the dates, shape the phases, and add the gear you'll need.</p>
      </div>

      {error && <div className="rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3.5 py-2.5 text-sm font-medium reveal">{error}</div>}

      {/* Basics */}
      <section className="card glass rounded-2xl p-6 space-y-4 reveal" style={{ animationDelay: ".12s" }}>
        <div><label className={labelCls}>Event name *</label>
          <input className={inputCls} placeholder="e.g. Summer Festival" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Client</label>
            <input className={inputCls} placeholder="Client / customer" value={client} onChange={(e) => setClient(e.target.value)} /></div>
          <div><label className={labelCls}>Location</label>
            <input className={inputCls} placeholder="Venue / city" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        </div>
      </section>

      {/* Dates */}
      <section className="card glass rounded-2xl p-6 reveal" style={{ animationDelay: ".18s" }}>
        <h2 className="font-bold">Dates</h2>
        <p className="text-slate-400 text-xs mt-0.5 mb-4">Pick the first and last day (DD/MM/YYYY).</p>
        <RangeCalendar start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />

        {days.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Phases</h3>
              <span className="text-xs text-slate-500">Tap the first &amp; last <span className="text-violet-300">Live</span> day · the rest auto-fills montage / démontage</span>
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

      {/* Equipment */}
      <section className="card glass rounded-2xl p-6 reveal" style={{ animationDelay: ".24s" }}>
        <h2 className="font-bold">Equipment needed</h2>
        <p className="text-slate-400 text-xs mt-0.5 mb-4">Search your inventory and add what this event needs. Availability updates live.</p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Browse */}
          <div>
            <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 mb-3">
              <span className="ms text-slate-400" style={{ fontSize: 18 }}>search</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment…"
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {cats.map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${cat === c ? "grad text-white" : "glass text-slate-300 hover:bg-white/10"}`}>{c}</button>
              ))}
            </div>
            <div className="max-h-64 overflow-auto pr-1 space-y-1">
              {filtered.map((e) => {
                const added = selectedIds.has(e.id);
                return (
                  <button key={e.id} type="button" onClick={() => addItem(e.id)} disabled={added}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition ${added ? "opacity-50" : "hover:bg-white/5"}`}>
                    <div>
                      <div className="text-sm font-medium">{e.name}</div>
                      <div className="text-[11px] text-slate-500">{e.category} · <span className={e.available <= 0 ? "text-rose-300" : "text-emerald-300/80"}>{e.available} available</span></div>
                    </div>
                    <span className={`ms ${added ? "text-emerald-300" : "text-indigo-300"}`} style={{ fontSize: 20 }}>{added ? "check_circle" : "add_circle"}</span>
                  </button>
                );
              })}
              {!filtered.length && <p className="text-sm text-slate-500 px-1 py-3">No matches.</p>}
            </div>
          </div>

          {/* Selected */}
          <div className="glass rounded-xl p-3">
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>Selected ({lines.length})</span>
            </div>
            {lines.length === 0 && <p className="text-sm text-slate-500 px-1 py-6 text-center">Nothing added yet.</p>}
            <div className="space-y-2">
              {lines.map((l) => {
                const e = eqMap[l.equipment_id];
                const over = e && l.quantity > e.available;
                return (
                  <div key={l.equipment_id} className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{e?.name ?? "—"}</div>
                      <button type="button" onClick={() => removeItem(l.equipment_id)} className="ms text-slate-500 hover:text-rose-300 transition" style={{ fontSize: 18 }}>close</button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setQty(l.equipment_id, l.quantity - 1)} className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10"><span className="ms" style={{ fontSize: 16 }}>remove</span></button>
                        <NumberInput min={1} value={l.quantity} onChange={(ev) => setQty(l.equipment_id, parseInt(ev.target.value || "1", 10))}
                          className="w-12 text-center rounded-lg glass py-1 text-sm outline-none" />
                        <button type="button" onClick={() => setQty(l.equipment_id, l.quantity + 1)} className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10"><span className="ms" style={{ fontSize: 16 }}>add</span></button>
                      </div>
                      <span className={`text-[11px] ${over ? "text-amber-300" : "text-slate-500"}`}>
                        {over ? `over by ${l.quantity - (e?.available ?? 0)} — needs transfer/rental` : `${e?.available ?? 0} available`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link href="/events" className="px-4 py-2.5 rounded-xl glass text-sm font-semibold hover:bg-white/10 transition">Cancel</Link>
        <button onClick={submit} disabled={busy}
          className="btn-primary grad text-white text-sm font-semibold rounded-xl px-5 py-2.5 flex items-center gap-2 disabled:opacity-60">
          {busy ? "Creating…" : <>Create event <span className="ms" style={{ fontSize: 18 }}>check</span></>}
        </button>
      </div>
    </div>
  );
}
