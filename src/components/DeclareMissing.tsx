"use client";

import { useState, useTransition } from "react";
import NumberInput from "@/components/NumberInput";
import { declareMissing } from "@/app/(app)/missing/actions";

type Equip = { id: string; name: string; importance?: string };
type Ev = { id: string; name: string };

const PHASES = [
  { v: "transit", label: "In transit (driver)" },
  { v: "event", label: "At the event" },
  { v: "return", label: "On return to warehouse" },
  { v: "other", label: "Other / unsure" },
];
const REASONS = [
  { v: "missing", label: "Missing" },
  { v: "lost", label: "Lost" },
  { v: "damaged", label: "Damaged" },
];

const inputCls = "w-full rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";
const selectCls = `${inputCls} bg-slate-900`;

// Declare an item missing / lost / damaged. Reused on the global Missing page
// (with an event picker) and on an event's detail (locked to that event).
export default function DeclareMissing({
  equipment, events, fixedEvent, defaultPhase = "other", buttonLabel = "Declare missing item",
}: {
  equipment: Equip[];
  events?: Ev[];
  fixedEvent?: Ev;
  defaultPhase?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [equipmentId, setEquipmentId] = useState("");
  const [qty, setQty] = useState(1);
  const [eventId, setEventId] = useState(fixedEvent?.id ?? "");
  const [phase, setPhase] = useState(defaultPhase);
  const [reason, setReason] = useState("missing");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    setErr(null); setOk(false);
    start(async () => {
      const r = await declareMissing({
        equipmentId, quantity: qty, eventId: (fixedEvent?.id ?? eventId) || null,
        phase, reason, location, note,
      });
      if (r && "error" in r) setErr(r.error);
      else {
        setOk(true);
        setEquipmentId(""); setQty(1); setLocation(""); setNote("");
        if (!fixedEvent) setEventId("");
      }
    });
  }

  return (
    <div>
      <button onClick={() => { setOpen((o) => !o); setOk(false); setErr(null); }}
        className="inline-flex items-center gap-1.5 rounded-lg btn-primary grad text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
        <span className="ms" style={{ fontSize: 18 }}>{open ? "close" : "report"}</span>{open ? "Close" : buttonLabel}
      </button>

      {open && (
        <div className="mt-3 glass rounded-xl p-3 space-y-2">
          {err && <p className="text-xs text-rose-300">{err}</p>}
          {ok && <p className="text-xs text-emerald-300">Declared ✓ — add another or close.</p>}

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Equipment</label>
              <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={selectCls}>
                <option value="">Pick equipment…</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}{e.importance === "critical" ? " — critical" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Quantity</label>
              <NumberInput min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value || "1", 10))} className={inputCls} />
            </div>

            {!fixedEvent && events && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Event</label>
                <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={selectCls}>
                  <option value="">No specific event</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">When / where in the flow</label>
              <select value={phase} onChange={(e) => setPhase(e.target.value)} className={selectCls}>
                {PHASES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectCls}>
                {REASONS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Location (where exactly)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. venue, the truck, …" className={inputCls} />
            </div>
          </div>

          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? (optional)" className={inputCls} />

          <div className="flex justify-end">
            <button disabled={pending || !equipmentId} onClick={submit}
              className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-50">
              {pending ? "Declaring…" : "Declare"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
