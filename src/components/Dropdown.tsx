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
        className={`w-full bg-[var(--surface)] border rounded-lg ${pad} flex items-center justify-between gap-2 outline-none transition
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--surface2)]"} ${open ? "border-[var(--accent-hex)] ring-2 ring-[var(--accent-soft)]" : "border-[var(--border)]"}`}>
        <span className={`truncate ${selected ? "text-[var(--ink)]" : "text-[var(--faint)]"}`}>{selected ? selected.label : placeholder}</span>
        <span className="ms text-slate-400 shrink-0 transition-transform" style={{ fontSize: 18, transform: open ? "rotate(180deg)" : "none" }}>expand_more</span>
      </button>

      {open && (
        <div className="pop absolute z-30 mt-1 w-full rounded-lg p-1 bg-[var(--surface)] border border-[var(--border)] shadow-lg max-h-56 overflow-auto">
          {options.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No options.</p>}
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button key={o.value} type="button" disabled={o.disabled}
                onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false); } }}
                className={`w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition
                  ${o.disabled ? "opacity-40 cursor-not-allowed" : active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface2)]"}`}>
                <span className={`text-sm truncate ${active ? "text-[var(--accent-hex)] font-semibold" : "text-[var(--ink)]"}`}>{o.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {o.hint && <span className="text-[11px] text-[var(--faint)]">{o.hint}</span>}
                  {active && <span className="ms text-[var(--accent-hex)]" style={{ fontSize: 16 }}>check</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
