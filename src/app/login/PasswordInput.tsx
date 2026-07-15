"use client";

import { useState } from "react";

export default function PasswordInput() {
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 focus-within:border-[var(--accent-hex)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
      <span className="ms text-[var(--faint)]" style={{ fontSize: 19 }}>lock</span>
      <input
        name="password"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        placeholder="••••••••"
        className="bg-transparent outline-none text-sm w-full placeholder:text-[var(--faint)]"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="ms text-[var(--sub)] hover:text-[var(--ink)] transition-colors shrink-0"
        style={{ fontSize: 20 }}
      >
        {show ? "visibility" : "visibility_off"}
      </button>
    </div>
  );
}
