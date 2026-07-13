"use client";

import { useState } from "react";

export default function PasswordInput() {
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center gap-2 glass rounded-xl px-3.5 py-2.5">
      <span className="ms text-slate-400" style={{ fontSize: 20 }}>lock</span>
      <input
        name="password"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        placeholder="••••••••"
        className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="ms text-slate-400 hover:text-slate-200 transition-colors shrink-0"
        style={{ fontSize: 20 }}
      >
        {show ? "visibility" : "visibility_off"}
      </button>
    </div>
  );
}
