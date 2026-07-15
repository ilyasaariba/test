import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import NotificationsBell from "@/components/NotificationsBell";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const supabase = await createClient();

  const [{ count: live }, { count: unread }, { data: notifData }] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", profile.id).eq("is_read", false),
    supabase.from("notifications").select("id,type,title,body,event_id,is_read,created_at")
      .eq("user_id", profile.id).order("created_at", { ascending: false }).limit(15),
  ]);

  const notifications = (notifData ?? []).map((n: any) => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    eventId: n.event_id, isRead: n.is_read, createdAt: n.created_at,
  }));

  const canCreate = profile.role === "engineer" || profile.role === "admin";

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- top bar ---- */}
      <header className="h-14 shrink-0 bg-[var(--surface)] border-b border-[var(--border)] flex items-center gap-4 px-4 sticky top-0 z-30 max-lg:pl-16">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg grad grid place-items-center font-bold text-[11px] tracking-tight shrink-0">M212</span>
          <span className="font-semibold text-[15px] whitespace-nowrap">
            M212 <span className="text-[var(--sub)] font-normal">Logistics</span>
          </span>
        </Link>

        {/* global search — lands on the events list filtered by the term */}
        <form action="/events" method="get" className="flex-1 max-w-xl hidden md:flex">
          <div className="w-full flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 focus-within:border-[var(--accent-hex)]">
            <span className="ms text-[var(--faint)]" style={{ fontSize: 18 }}>search</span>
            <input
              name="q"
              type="text"
              placeholder="Search events…"
              autoComplete="off"
              className="bg-transparent outline-none text-sm w-full placeholder:text-[var(--faint)]"
            />
          </div>
        </form>

        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-2 border border-[var(--border)] rounded-lg px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)] dot-live" />
            <span className="text-xs text-[var(--sub)] font-medium num">{live ?? 0} live</span>
          </div>

          <NotificationsBell items={notifications} unread={unread ?? 0} />

          {canCreate && (
            <Link
              href="/events/new"
              className="btn-primary text-sm font-semibold rounded-lg px-3.5 py-2 hidden sm:flex items-center gap-1.5"
            >
              <span className="ms" style={{ fontSize: 18 }}>add</span> New event
            </Link>
          )}

          <form action={signOut}>
            <button
              className="h-9 w-9 grid place-items-center rounded-lg border border-transparent text-[var(--sub)] hover:bg-[var(--surface2)] hover:text-[var(--ink)] transition"
              title="Sign out"
            >
              <span className="ms" style={{ fontSize: 20 }}>logout</span>
            </button>
          </form>
        </div>
      </header>

      {/* ---- sidenav + content ---- */}
      <div className="flex-1 flex min-h-0">
        <Sidebar role={profile.role} fullName={profile.full_name} />
        <main className="flex-1 min-w-0 px-5 lg:px-7 py-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
