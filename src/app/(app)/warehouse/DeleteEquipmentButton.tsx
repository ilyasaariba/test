"use client";

import { useState, useTransition } from "react";
import { deleteEquipment } from "./actions";

export default function DeleteEquipmentButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {err && <span className="text-[11px] text-rose-300">{err}</span>}
        <button disabled={pending} onClick={() => {
            setErr(null);
            start(async () => {
              const r = await deleteEquipment(id);
              if (r && "error" in r) { setErr(r.error); setConfirming(false); }
            });
          }}
          className="rounded-lg bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 px-2.5 py-1 text-xs font-semibold hover:bg-rose-500/25 transition disabled:opacity-50">
          {pending ? "Removing…" : "Remove"}
        </button>
        <button disabled={pending} onClick={() => setConfirming(false)}
          className="rounded-lg glass px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 transition">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {err && <span className="text-[11px] text-rose-300">{err}</span>}
      <button onClick={() => { setErr(null); setConfirming(true); }} title={`Remove ${name}`}
        className="ms text-slate-500 hover:text-rose-300 transition p-1" style={{ fontSize: 18 }}>
        delete
      </button>
    </span>
  );
}
