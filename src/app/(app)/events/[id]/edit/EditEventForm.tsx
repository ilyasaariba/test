"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtDMY } from "@/lib/ui";
import RangeCalendar from "@/components/RangeCalendar";
import { updateEventDetails, type EditEventInput } from "../manage";

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

const inputCls = "w-full rounded-xl glass px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";
const labelCls = "block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide";

export default function EditEventForm({
  eventId, initial,
}: {
  eventId: string;
  initial: {
    name: string; client: string; location: string; notes: string;
    montage_start: string; live_start: string; live_end: string; demontage_end: string;
  };
}) {
  const [name, setName] = useState(initial.name);
  const [client, setClient] = useState(initial.client);
  const [location, setLocation] = useState(initial.location);
  const [notes, setNotes] = useState(initial.notes);
  const [start, setStart] = useState(initial.montage_start);
  const [end, setEnd] = useState(initial.demontage_end);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => daysBetween(start, end), [start, end]);
  const [liveStart, setLiveStart] = useState(0);
  const [liveEnd, setLiveEnd] = useState(0);
  const [selecting, setSelecting] = useState(false);
  // track whether the user has touched the calendar (so we keep the original live window until they do)
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const n = days.length;
    if (!touched) {
      const ls = days.indexOf(initial.live_start);
      const le = days.indexOf(initial.live_end);
      if (ls >= 0 && le >= 0) { setLiveStart(ls); setLiveEnd(le); setSelecting(false); return; }
    }
    if (n <= 1) { setLiveStart(0); setLiveEnd(Math.max(0, n - 1)); }
    else if (n === 2) { setLiveStart(0); setLiveEnd(1); }
    else { setLiveStart(1); setLiveEnd(n - 2); }
    setSelecting(false);
  }, [days.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function clickDay(i: number) {
    setTouched(true);
    if (!selecting) { setLiveStart(i); setLiveEnd(i); setSelecting(true); }
    else if (i >= liveStart) { setLiveEnd(i); setSelecting(false); }
    else { setLiveStart(i); setLiveEnd(i); setSelecting(true); }
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Event name is required.");
    if (!days.length) return setError("Pick a start and end day.");
    setBusy(true);
    const payload: EditEventInput = {
      name, client, location, notes,
      montage_start: days[0], live_start: days[liveStart], live_end: days[liveEnd], demontage_end: days[days.length - 1],
    };
    const res = await updateEventDetails(eventId, payload);
    if (res?.error) { setError(res.error); setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".05s" }}>
        <Link href={`/events/${eventId}`} className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 w-fit">
          <span className="ms" style={{ fontSize: 16 }}>arrow_back</span> Back to event
        </Link>
        <h1 className="text-xl font-semibold tracking-tight mt-2">Edit event</h1>
        <p className="text-slate-400 text-sm mt-1">Update the details and dates. Manage equipment from the event page.</p>
      </div>

      {error && <div className="rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3.5 py-2.5 text-sm font-medium reveal">{error}</div>}

      <section className="card glass rounded-2xl p-6 space-y-4 reveal" style={{ animationDelay: ".12s" }}>
        <div><label className={labelCls}>Event name *</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Client</label>
            <input className={inputCls} placeholder="Client / customer" value={client} onChange={(e) => setClient(e.target.value)} /></div>
          <div><label className={labelCls}>Location</label>
            <input className={inputCls} placeholder="Venue / city" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        </div>
        <div><label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} min-h-20`} placeholder="Internal notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </section>

      <section className="card glass rounded-2xl p-6 reveal" style={{ animationDelay: ".18s" }}>
        <h2 className="font-bold">Dates</h2>
        <p className="text-slate-400 text-xs mt-0.5 mb-4">Pick the first and last day (DD/MM/YYYY).</p>
        <RangeCalendar start={start} end={end} onChange={(s, e) => { setTouched(true); setStart(s); setEnd(e); }} />

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
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${cls} transition hover:scale-105`}>{dm(d)}</button>
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

      <div className="flex justify-end gap-2">
        <Link href={`/events/${eventId}`} className="px-4 py-2.5 rounded-xl glass text-sm font-semibold hover:bg-white/10 transition">Cancel</Link>
        <button onClick={submit} disabled={busy}
          className="btn-primary grad text-white text-sm font-semibold rounded-xl px-5 py-2.5 flex items-center gap-2 disabled:opacity-60">
          {busy ? "Saving…" : <>Save changes <span className="ms" style={{ fontSize: 18 }}>check</span></>}
        </button>
      </div>
    </div>
  );
}
