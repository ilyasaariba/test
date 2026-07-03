"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendToWarehouse, goLive, endEvent } from "./lifecycle";

const FLOW: [string, string][] = [
  ["draft", "Draft"],
  ["sent_to_warehouse", "Requested"],
  ["prepared", "Prepared"],
  ["shipped", "Shipped"],
  ["received_on_site", "On site"],
  ["in_progress", "Live"],
  ["returning", "Returning"],
  ["reconciliation", "Reconcile"],
];

const STAGE_DESC: Record<string, string> = {
  draft: "Building the equipment list — not sent to the warehouse yet.",
  sent_to_warehouse: "Request sent — the warehouse is preparing the gear.",
  prepared: "Gear is packed and ready to leave the warehouse.",
  shipped: "On the way to the event site.",
  received_on_site: "Gear has arrived on site, ready to set up.",
  in_progress: "The event is happening now (live).",
  returning: "Event over — gear is heading back to the warehouse.",
  reconciliation: "Checking returned gear against the list.",
  archived: "Closed — all gear returned to stock.",
  cancelled: "This event was cancelled.",
};

const SHIPPED_OR_LATER = ["shipped", "received_on_site", "in_progress", "returning", "reconciliation"];

export default function LifecycleBar({
  eventId, role, status, shipper, isLead,
}: {
  eventId: string;
  role: string;
  status: string;
  shipper?: string | null;
  isLead?: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const isEng = role === "engineer" || role === "admin" || !!isLead;
  const isWm = role === "warehouse_manager" || role === "admin";
  const idx = FLOW.findIndex(([k]) => k === status);
  const closed = status === "cancelled" || status === "archived";

  function run(fn: () => Promise<{ error: string } | void>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r) setErr(r.error);
    });
  }

  // The single contextual action for the current stage + viewer's role.
  function action() {
    if (status === "draft" && isEng)
      return <Btn pending={pending} icon="send" label="Send to warehouse" onClick={() => run(() => sendToWarehouse(eventId))} />;
    if (status === "shipped" && isEng)
      return <span className="text-sm text-slate-400 flex items-center gap-1"><span className="ms" style={{ fontSize: 16 }}>south</span>Check the gear in below</span>;
    if (status === "received_on_site" && isEng)
      return <Btn pending={pending} icon="play_arrow" label="Go live" onClick={() => run(() => goLive(eventId))} />;
    if (status === "in_progress" && isEng)
      return <Btn pending={pending} icon="stop_circle" label="End event" onClick={() => run(() => endEvent(eventId))} />;

    // Warehouse acts on its dedicated prep screen.
    if ((status === "sent_to_warehouse" || status === "prepared" || status === "returning" || status === "reconciliation") && isWm)
      return (
        <Link href={`/warehouse/requests/${eventId}`} className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="ms" style={{ fontSize: 18 }}>warehouse</span> Open in warehouse
        </Link>
      );

    // Otherwise show who we're waiting on.
    const hint =
      status === "sent_to_warehouse" ? "Waiting for the warehouse to prepare the gear."
      : status === "prepared" ? "Prepared — waiting for the warehouse to ship."
      : status === "shipped" ? "In transit — engineer confirms on arrival."
      : status === "returning" ? "Event over — gear is being returned."
      : status === "reconciliation" ? "Reconciling — warehouse is resolving missing/damaged gear."
      : status === "cancelled" ? "This event was cancelled."
      : status === "archived" ? "Archived."
      : null;
    return hint ? <span className="text-sm text-slate-400">{hint}</span> : null;
  }

  return (
    <div className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".09s" }}>
      {/* stepper */}
      {!closed && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
          {FLOW.map(([key, label], i) => {
            const done = idx >= 0 && i < idx;
            const active = i === idx;
            return (
              <div key={key} className="flex items-center gap-1.5 shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 transition
                  ${active ? "grad text-white ring-transparent"
                    : done ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                    : "bg-white/5 text-slate-500 ring-white/10"}`}>
                  {done ? <span className="ms" style={{ fontSize: 14 }}>check</span>
                    : active ? <span className="h-1.5 w-1.5 rounded-full bg-white dot-live" /> : null}
                  {label}
                </div>
                {i < FLOW.length - 1 && <span className={`ms ${done ? "text-emerald-400/50" : "text-slate-600"}`} style={{ fontSize: 16 }}>chevron_right</span>}
              </div>
            );
          })}
        </div>
      )}

      {err && <div className="mb-3 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm">
            <span className="text-slate-500">Stage · </span>
            <span className="text-slate-100 font-semibold">{FLOW[idx]?.[1] ?? status}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{STAGE_DESC[status] ?? ""}</p>
          {shipper && SHIPPED_OR_LATER.includes(status) && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="ms text-slate-500" style={{ fontSize: 14 }}>local_shipping</span>
              Shipped with <span className="font-semibold text-slate-200">{shipper}</span>
            </p>
          )}
        </div>
        {action()}
      </div>
    </div>
  );
}

function Btn({ pending, icon, label, onClick }: { pending: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button disabled={pending} onClick={onClick}
      className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
      <span className="ms" style={{ fontSize: 18 }}>{icon}</span> {label}
    </button>
  );
}
