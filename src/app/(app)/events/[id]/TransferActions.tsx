"use client";

import { useState, useTransition } from "react";
import NumberInput from "@/components/NumberInput";
import DateField from "@/components/DateField";
import { editTransfer, cancelTransfer } from "./transfer-actions";

// Edit / cancel a transfer — shown only to its creator (or an admin).
export default function TransferActions({
  transferId, quantity, scheduledTime,
}: {
  transferId: string;
  quantity: number;
  scheduledTime: string | null; // YYYY-MM-DD or null
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [qty, setQty] = useState(quantity);
  const [when, setWhen] = useState(scheduledTime ?? "");

  function run(p: Promise<{ error: string } | void>, after: () => void) {
    setErr(null);
    start(async () => {
      const r = await p;
      if (r && "error" in r) setErr(r.error); else after();
    });
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Transfer actions"
        className="h-8 w-8 grid place-items-center rounded-lg glass text-slate-300 hover:text-white hover:bg-white/10 transition">
        <span className="ms" style={{ fontSize: 18 }}>more_horiz</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setConfirming(false); }} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl z-20 p-3 space-y-2">
            {err && <p className="text-xs text-rose-300">{err}</p>}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Quantity</label>
              <NumberInput min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
                className="w-full rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Scheduled</label>
              <DateField value={when} onChange={setWhen} placeholder="Pick date" className="w-full" />
            </div>
            <button disabled={pending} onClick={() => run(editTransfer(transferId, qty, when || null), () => setOpen(false))}
              className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2 w-full disabled:opacity-50">
              Save changes
            </button>

            {!confirming ? (
              <button onClick={() => setConfirming(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10 transition">
                <span className="ms" style={{ fontSize: 16 }}>cancel</span> Cancel transfer
              </button>
            ) : (
              <div className="rounded-lg bg-rose-500/5 ring-1 ring-rose-400/20 p-2">
                <p className="text-[11px] text-slate-400 mb-2">Cancel this transfer? It drops as a source on the destination event.</p>
                <div className="flex gap-2">
                  <button disabled={pending} onClick={() => run(cancelTransfer(transferId), () => { setConfirming(false); setOpen(false); })}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/30 transition disabled:opacity-50">
                    {pending ? "Cancelling…" : "Yes, cancel"}
                  </button>
                  <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold glass hover:bg-white/10">Keep</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
