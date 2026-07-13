"use client";

import { useState, useTransition } from "react";
import { shipTransfer, rejectTransfer } from "../events/[id]/transfer-flow";

export type TransferLine = { transferId: string; equipmentName: string; requestedQty: number };
type LineState = { qty: number; rejecting: boolean; note: string };

export default function TransferTaskForm({
  fromName, toName, lines,
}: {
  fromName: string;
  toName: string;
  lines: TransferLine[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(lines.map((l) => [l.transferId, { qty: l.requestedQty, rejecting: false, note: "" }])),
  );

  function patch(id: string, p: Partial<LineState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  function send() {
    setErr(null);
    for (const l of lines) {
      const st = state[l.transferId];
      if (st.rejecting && !st.note.trim()) { setErr(`Add a reason for rejecting ${l.equipmentName}.`); return; }
      if (!st.rejecting && st.qty < 1) { setErr(`Set a quantity or reject ${l.equipmentName}.`); return; }
    }
    start(async () => {
      for (const l of lines) {
        const st = state[l.transferId];
        const r = st.rejecting
          ? await rejectTransfer(l.transferId, st.note)
          : await shipTransfer(l.transferId, st.qty, st.note || undefined);
        if (r && "error" in r) { setErr(r.error); return; }
      }
    });
  }

  return (
    <div className="card gborder glass rounded-2xl reveal" style={{ animationDelay: ".1s" }}>
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-md bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30 text-xs font-bold shrink-0">⇄ SEND</span>
        <div className="min-w-0">
          <h3 className="font-bold text-sm truncate">{lines.length} item{lines.length === 1 ? "" : "s"} to send → {toName}</h3>
          <p className="text-xs text-slate-500">from {fromName} · ship or reject each, then send</p>
        </div>
      </div>

      {err && <div className="mx-5 mt-3 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      <div className="p-4 space-y-2">
        {lines.map((l) => {
          const st = state[l.transferId];
          const partial = !st.rejecting && st.qty < l.requestedQty;
          return (
            <div key={l.transferId} className={`rounded-xl px-3 py-2.5 ring-1 ${st.rejecting ? "bg-rose-500/5 ring-rose-400/20" : "bg-white/5 ring-white/10"}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{l.equipmentName}</div>
                  <div className="text-[11px] text-slate-500">asked for {l.requestedQty}</div>
                </div>
                {!st.rejecting && (
                  <Stepper value={st.qty} min={1} max={l.requestedQty} onChange={(v) => patch(l.transferId, { qty: v })} />
                )}
                <button onClick={() => patch(l.transferId, { rejecting: !st.rejecting })}
                  className={`ms rounded-lg px-2 py-1 transition ${st.rejecting ? "text-slate-300 hover:bg-white/10" : "text-rose-300 hover:bg-rose-500/10"}`}
                  style={{ fontSize: 18 }} title={st.rejecting ? "Undo reject" : "Reject this item"}>
                  {st.rejecting ? "undo" : "block"}
                </button>
              </div>
              {st.rejecting ? (
                <input value={st.note} onChange={(e) => patch(l.transferId, { note: e.target.value })} placeholder={`Why reject ${l.equipmentName}? (required)`}
                  className="mt-2 w-full rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500" />
              ) : partial ? (
                <p className="text-[11px] text-amber-300 mt-1.5">Sending {st.qty} of {l.requestedQty} — the rest stays short at {toName}.</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3.5 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">One send handles every item above.</p>
        <button disabled={pending} onClick={send}
          className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-1.5 disabled:opacity-50">
          <span className="ms" style={{ fontSize: 16 }}>{pending ? "hourglass_empty" : "local_shipping"}</span> Send shipment
        </button>
      </div>
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button disabled={value <= min} onClick={() => onChange(value - 1)}
        className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10 disabled:opacity-30">
        <span className="ms" style={{ fontSize: 16 }}>remove</span>
      </button>
      <span className="w-9 text-center font-bold text-sm">{value}</span>
      <button disabled={value >= max} onClick={() => onChange(value + 1)}
        className="h-7 w-7 grid place-items-center rounded-lg glass hover:bg-white/10 disabled:opacity-30">
        <span className="ms" style={{ fontSize: 16 }}>add</span>
      </button>
    </div>
  );
}
