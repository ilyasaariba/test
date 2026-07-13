"use client";

import { useState, useTransition } from "react";
import { DRIVERS } from "@/lib/drivers";
import Dropdown from "@/components/Dropdown";
import { shipTopup } from "../../events/[id]/transfer-flow";

type Topup = {
  id: string; equipmentName: string; quantity: number;
  toEventName: string; requestedByName: string | null;
};

export default function TopupCard({ topup }: { topup: Topup }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [driver, setDriver] = useState("");

  function ship() {
    setErr(null);
    start(async () => {
      const r = await shipTopup(topup.id, driver);
      if (r && "error" in r) setErr(r.error);
    });
  }

  return (
    <div className="card glass rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-300 grid place-items-center shrink-0">
          <span className="ms" style={{ fontSize: 20 }}>bolt</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{topup.quantity}× {topup.equipmentName}</div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
            <span className="ms text-slate-500" style={{ fontSize: 13 }}>arrow_forward</span>
            {topup.toEventName}{topup.requestedByName ? <span className="text-slate-500"> · by {topup.requestedByName}</span> : null}
          </div>
        </div>
      </div>

      {err && <div className="mt-3 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      <div className="mt-3 flex items-center gap-2">
        <Dropdown className="flex-1" value={driver} onChange={setDriver} placeholder="Choose a driver…"
          options={DRIVERS.map((d) => ({ value: d, label: d }))} />
        <button disabled={pending || !driver} onClick={ship}
          className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-1.5 disabled:opacity-50 shrink-0">
          <span className="ms" style={{ fontSize: 16 }}>local_shipping</span> Ship
        </button>
      </div>
    </div>
  );
}
