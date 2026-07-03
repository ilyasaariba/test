import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import CardFx from "@/components/CardFx";
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
    <div className="relative min-h-screen" data-role={profile.role}>
      <div className="aurora"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>
      <div className="grid-fx" />
      <CardFx />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar role={profile.role} fullName={profile.full_name} />

        <div className="flex-1 flex flex-col min-w-0 p-3">
          <header className="glass rounded-3xl px-5 py-3 flex items-center gap-3 reveal" style={{ animationDelay: ".12s" }}>
            <div className="flex-1" />

            <div className="hidden md:flex items-center gap-2 glass rounded-xl px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-300 font-medium">{live ?? 0} events live</span>
            </div>

            <NotificationsBell items={notifications} unread={unread ?? 0} />

            {canCreate && (
              <Link
                href="/events/new"
                className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 hidden sm:flex items-center gap-2"
              >
                <span className="ms" style={{ fontSize: 18 }}>add</span> New event
              </Link>
            )}

            <form action={signOut}>
              <button className="h-10 w-10 grid place-items-center rounded-xl glass text-slate-300 hover:text-white transition" title="Sign out">
                <span className="ms" style={{ fontSize: 20 }}>logout</span>
              </button>
            </form>
          </header>

          <main className="flex-1 overflow-auto pt-5 pr-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
