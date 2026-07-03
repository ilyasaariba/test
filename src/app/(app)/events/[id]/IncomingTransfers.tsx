"use client";

import { useState, useTransition } from "react";
import { acceptTransfer, refuseTransfer } from "./transfer-flow";

type Req = { id: string; equipmentName: string; quantity: number; toEventName: string; requestedByName: string | null };

export default function IncomingTransfers({ requests }: { requests: Req[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function run(id: string, fn: () => Promise<{ error: string } | void>) {
    setErr(null); setBusy(id);
    start(async () => {
      const r = await fn();
      if (r && "error" in r) setErr(r.error);
      setBusy(null);
    });
  }

  if (!requests.length) return null;

  return (
    <section className="card gborder glass rounded-2xl reveal" style={{ animationDelay: ".16s" }}>
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <span className="ms text-fuchsia-300" style={{ fontSize: 18 }}>swap_horiz</span>
        <h2 className="font-bold">Transfer requests</h2>
        <span className="text-xs text-slate-500">· {requests.length} awaiting your call</span>
      </div>

      {err && <div className="mx-5 mt-4 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      <div className="p-5 space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl glass p-3">
            <div className="h-9 w-9 rounded-lg bg-fuchsia-500/15 text-fuchsia-300 grid place-items-center font-bold shrink-0">⇄</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{r.quantity}× {r.equipmentName}</p>
              <p className="text-xs text-slate-500 truncate">for {r.toEventName}{r.requestedByName ? ` · asked by ${r.requestedByName}` : ""}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button disabled={pending} onClick={() => run(r.id, () => acceptTransfer(r.id))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25 transition disabled:opacity-50">
                {busy === r.id && pending ? "…" : "Accept"}
              </button>
              <button disabled={pending} onClick={() => run(r.id, () => refuseTransfer(r.id))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold glass hover:bg-white/10 transition disabled:opacity-50">Refuse</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
