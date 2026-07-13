"use client";

import { useEffect, useRef, useState } from "react";

export type Option = { value: string; label: string; hint?: string; disabled?: boolean };

export default function Dropdown({
  value, onChange, options, placeholder = "Select…", disabled, className = "", size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const selected = options.find((o) => o.value === value);
  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className={`w-full glass rounded-lg ${pad} flex items-center justify-between gap-2 outline-none transition
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5"} ${open ? "ring-2 ring-indigo-500" : ""}`}>
        <span className={`truncate ${selected ? "text-slate-100" : "text-slate-500"}`}>{selected ? selected.label : placeholder}</span>
        <span className="ms text-slate-400 shrink-0 transition-transform" style={{ fontSize: 18, transform: open ? "rotate(180deg)" : "none" }}>expand_more</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl p-1 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-xl max-h-56 overflow-auto"
          style={{ background: "#0c1022" }}>
          {options.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No options.</p>}
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button key={o.value} type="button" disabled={o.disabled}
                onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false); } }}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition
                  ${o.disabled ? "opacity-40 cursor-not-allowed" : active ? "bg-indigo-500/20" : "hover:bg-white/5"}`}>
                <span className={`text-sm truncate ${active ? "text-indigo-200 font-semibold" : "text-slate-200"}`}>{o.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {o.hint && <span className="text-[11px] text-slate-500">{o.hint}</span>}
                  {active && <span className="ms text-indigo-300" style={{ fontSize: 16 }}>check</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
