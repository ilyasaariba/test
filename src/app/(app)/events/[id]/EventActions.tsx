"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelEvent } from "./manage";

export default function EventActions({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function doCancel() {
    setErr(null);
    start(async () => {
      const r = await cancelEvent(eventId);
      if (r && "error" in r) setErr(r.error);
      else { setConfirming(false); setOpen(false); }
    });
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 grid place-items-center rounded-lg glass text-slate-300 hover:text-white hover:bg-white/10 transition" title="Event actions">
        <span className="ms" style={{ fontSize: 20 }}>more_horiz</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setConfirming(false); }} />
          <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0c1022] backdrop-blur-xl ring-1 ring-white/10 shadow-2xl z-20 p-1.5">
            <Link href={`/events/${eventId}/edit`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition">
              <span className="ms text-slate-300" style={{ fontSize: 18 }}>edit</span> Edit details &amp; dates
            </Link>

            {!confirming ? (
              <button onClick={() => setConfirming(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10 transition">
                <span className="ms" style={{ fontSize: 18 }}>cancel</span> Cancel event
              </button>
            ) : (
              <div className="px-3 py-2">
                <p className="text-xs text-slate-400 mb-2">Cancel this event? Its stock is released.</p>
                {err && <p className="text-xs text-rose-300 mb-2">{err}</p>}
                <div className="flex gap-2">
                  <button disabled={pending} onClick={doCancel}
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
