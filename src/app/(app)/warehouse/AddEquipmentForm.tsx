"use client";

import { useEffect, useRef, useState } from "react";
import { addEquipment } from "./actions";
import NumberInput from "@/components/NumberInput";

const inputCls =
  "w-full rounded-xl glass px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";

type Cat = { name: string; count: number };

// Engineer/Admin quick-add for catalog items. Category comes from a styled
// picker over the existing categories (+ "New category" to type a fresh one);
// importance is a two-way segmented toggle instead of a native select.
export default function AddEquipmentForm({ categories }: { categories: Cat[] }) {
  const [cat, setCat] = useState("");
  const [newMode, setNewMode] = useState(categories.length === 0);
  const [open, setOpen] = useState(false);
  const [imp, setImp] = useState<"normal" | "critical">("normal");
  const ref = useRef<HTMLDivElement>(null);

  // close the category panel on outside click / Esc
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <form action={addEquipment} className="card glass rounded-2xl p-4 reveal" style={{ animationDelay: ".1s" }}>
      <div className="grid sm:grid-cols-12 gap-3 items-end">
        <div className="sm:col-span-4">
          <label className="block text-xs font-semibold text-slate-300 mb-1">Name</label>
          <input name="name" required className={inputCls} placeholder="e.g. Line-array speakers" />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
          {newMode ? (
            <div className="flex gap-1.5">
              <input
                name="category"
                required
                autoFocus={categories.length > 0}
                className={inputCls}
                placeholder="New category…"
              />
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setNewMode(false)}
                  className="shrink-0 w-[42px] rounded-xl glass grid place-items-center text-[var(--sub)] hover:text-[var(--ink)] transition"
                  title="Choose an existing category instead"
                >
                  <span className="ms" style={{ fontSize: 18 }}>undo</span>
                </button>
              )}
            </div>
          ) : (
            <div ref={ref} className="relative">
              <input type="hidden" name="category" value={cat} />
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`${inputCls} flex items-center justify-between gap-2 text-left ${open ? "ring-2 ring-indigo-500" : ""}`}
              >
                <span className={`truncate ${cat ? "" : "text-[var(--faint)]"}`}>{cat || "Choose…"}</span>
                <span className="ms text-[var(--faint)] shrink-0 transition-transform" style={{ fontSize: 18, transform: open ? "rotate(180deg)" : "none" }}>expand_more</span>
              </button>

              {open && (
                <div className="absolute z-30 mt-1.5 w-full rounded-xl p-1 bg-[var(--surface)] border border-[var(--border)] shadow-xl max-h-64 overflow-auto">
                  {categories.map((c) => {
                    const active = c.name === cat;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => { setCat(c.name); setOpen(false); }}
                        className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface2)]"}`}
                      >
                        <span className={`text-sm truncate ${active ? "text-[var(--accent-hex)] font-semibold" : "text-[var(--ink)]"}`}>{c.name}</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-[var(--faint)] num">{c.count}</span>
                          {active && <span className="ms text-[var(--accent-hex)]" style={{ fontSize: 16 }}>check</span>}
                        </span>
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-[var(--border2)]" />
                  <button
                    type="button"
                    onClick={() => { setNewMode(true); setOpen(false); }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--accent-hex)] hover:bg-[var(--accent-soft)] transition"
                  >
                    <span className="ms" style={{ fontSize: 18 }}>add</span> New category
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-300 mb-1">Qty</label>
          <NumberInput name="total_quantity" min="0" defaultValue={0} className={inputCls} />
        </div>

        <div className="sm:col-span-3">
          <label className="block text-xs font-semibold text-slate-300 mb-1">Importance</label>
          <input type="hidden" name="importance" value={imp} />
          <div className="grid grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <button
              type="button"
              onClick={() => setImp("normal")}
              className={`h-[40px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition ${imp === "normal" ? "bg-[var(--accent-soft)] text-[var(--accent-hex)]" : "text-[var(--sub)] hover:bg-[var(--surface2)]"}`}
            >
              {imp === "normal" && <span className="ms" style={{ fontSize: 15 }}>check</span>}
              Normal
            </button>
            <button
              type="button"
              onClick={() => setImp("critical")}
              className={`h-[40px] text-[13px] font-semibold flex items-center justify-center gap-1.5 border-l border-[var(--border)] transition ${imp === "critical" ? "bg-[var(--crit-soft)] text-[var(--crit)]" : "text-[var(--sub)] hover:bg-[var(--surface2)]"}`}
            >
              <span className="ms" style={{ fontSize: 15 }}>priority_high</span>
              Critical
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border2)] flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--faint)]">
          {newMode || !cat ? "Items are grouped by category in the catalog." : <>Adding to <span className="font-semibold text-[var(--sub)]">{cat}</span>.</>}
        </p>
        <button className="btn-primary text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-1.5">
          <span className="ms" style={{ fontSize: 18 }}>add</span> Add item
        </button>
      </div>
    </form>
  );
}
