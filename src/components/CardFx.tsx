"use client";

import { useEffect } from "react";

// Cursor-reactive spotlight: sets --mx/--my on the hovered .card element.
export default function CardFx() {
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const card = target?.closest?.(".card") as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
