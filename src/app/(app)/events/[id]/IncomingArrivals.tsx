"use client";

import { useState, useTransition } from "react";
import { confirmTransferReceived } from "./transfer-flow";

type Arrival = { id: string; equipmentName: string; quantity: number; fromName: string; note: string | null };

export default function IncomingArrivals({ arrivals }: { arrivals: Arrival[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!arrivals.length) return null;

  function confirm(id: string) {
    setErr(null); setBusy(id);
    start(async () => {
      const r = await confirmTransferReceived(id);
      if (r && "error" in r) setErr(r.error);
      setBusy(null);
    });
  }

  return (
    <section className="card gborder glass rounded-2xl reveal" style={{ animationDelay: ".14s" }}>
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <span className="ms text-sky-300" style={{ fontSize: 20 }}>local_shipping</span>
        <div>
          <h2 className="font-bold">Incoming — confirm arrival</h2>
          <p className="text-xs text-slate-500">Gear on its way to this event. Confirm once it physically arrives.</p>
        </div>
      </div>
      {err && <div className="mx-5 mt-3 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}
      <div className="divide-y divide-white/5">
        {arrivals.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <div className="font-semibold text-sm">{a.quantity}× {a.equipmentName}</div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <span className="ms text-slate-500" style={{ fontSize: 13 }}>call_received</span>from {a.fromName}
                {a.note && <span className="text-slate-500">· {a.note}</span>}
              </div>
            </div>
            <button disabled={pending} onClick={() => confirm(a.id)}
              className="btn-primary grad text-white text-xs font-semibold rounded-lg px-3.5 py-2 flex items-center gap-1.5 disabled:opacity-50 shrink-0">
              <span className="ms" style={{ fontSize: 16 }}>{busy === a.id && pending ? "hourglass_empty" : "check_circle"}</span>
              Confirm arrival
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
