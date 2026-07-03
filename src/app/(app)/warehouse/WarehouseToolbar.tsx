"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const FILTERS: [string, string][] = [
  ["", "All"], ["out", "In use"], ["available", "Available"], ["zero", "Out of stock"],
];

export default function WarehouseToolbar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const filter = sp.get("filter") ?? "";

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const p = new URLSearchParams(Array.from(sp.entries()));
      if (q.trim()) p.set("q", q.trim()); else p.delete("q");
      router.replace(`/warehouse${p.toString() ? `?${p}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function setFilter(f: string) {
    const p = new URLSearchParams(Array.from(sp.entries()));
    if (f) p.set("filter", f); else p.delete("filter");
    router.replace(`/warehouse${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 reveal" style={{ animationDelay: ".1s" }}>
      <div className="flex items-center gap-2 glass rounded-xl px-3 py-2 flex-1 min-w-[12rem]">
        <span className="ms text-slate-400" style={{ fontSize: 18 }}>search</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment or category…"
          className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
        {q && <button onClick={() => setQ("")} className="ms text-slate-500 hover:text-slate-300" style={{ fontSize: 18 }}>close</button>}
      </div>
      <div className="flex gap-1 glass rounded-xl p-1">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === k ? "grad text-white" : "text-slate-300 hover:bg-white/10"}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}
