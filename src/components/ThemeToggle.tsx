"use client";

// Switches between dark (default) and light and remembers the choice.
// Which icon shows is decided purely in CSS (.tt-when-*), so the server
// render never disagrees with the client.
export default function ThemeToggle() {
  function toggle() {
    const el = document.documentElement;
    const next = el.getAttribute("data-theme") === "dark" ? "light" : "dark";
    el.setAttribute("data-theme", next);
    try {
      localStorage.setItem("m212-theme", next);
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="h-9 w-9 grid place-items-center rounded-lg cursor-pointer text-[var(--sub)] hover:bg-[var(--surface2)] hover:text-[var(--ink)] transition"
      title="Switch theme"
    >
      <span className="ms tt-when-dark" style={{ fontSize: 20 }}>light_mode</span>
      <span className="ms tt-when-light" style={{ fontSize: 20 }}>dark_mode</span>
    </button>
  );
}
