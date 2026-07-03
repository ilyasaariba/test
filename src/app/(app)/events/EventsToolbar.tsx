"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EVENT_STATUS } from "@/lib/ui";

export default function EventsToolbar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const status = sp.get("status") ?? "";

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const p = new URLSearchParams(Array.from(sp.entries()));
      if (q.trim()) p.set("q", q.trim()); else p.delete("q");
      router.replace(`/events${p.toString() ? `?${p}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function setStatus(s: string) {
    const p = new URLSearchParams(Array.from(sp.entries()));
    if (s) p.set("status", s); else p.delete("status");
    router.replace(`/events${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 reveal" style={{ animationDelay: ".1s" }}>
      <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 flex-1 min-w-[12rem]">
        <span className="ms text-slate-400" style={{ fontSize: 18 }}>search</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, client, location…"
          className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
        {q && <button onClick={() => setQ("")} className="ms text-slate-500 hover:text-slate-300" style={{ fontSize: 18 }}>close</button>}
      </div>
      <select value={status} onChange={(e) => setStatus(e.target.value)}
        className="rounded-xl glass px-3 py-2.5 text-sm outline-none bg-slate-900 focus:ring-2 focus:ring-indigo-500">
        <option value="">All statuses</option>
        {Object.entries(EVENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </div>
  );
}
