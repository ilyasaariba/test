import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { statusBadge, fmtRange } from "@/lib/ui";
import EventsToolbar from "./EventsToolbar";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();
  const isTech = profile.role === "technician";

  let events: any[] = [];
  if (isTech) {
    const { data } = await supabase
      .from("event_technicians")
      .select("events(id,name,client,location,status,live_start,live_end)")
      .eq("user_id", profile.id);
    events = (data ?? []).map((r: any) => r.events).filter(Boolean)
      .sort((a: any, b: any) => (b.live_end ?? "").localeCompare(a.live_end ?? ""));
  } else {
    let query = supabase
      .from("events")
      .select("id,name,client,location,status,live_start,live_end")
      .order("live_end", { ascending: false, nullsFirst: false });
    if (q) query = query.or(`name.ilike.%${q}%,client.ilike.%${q}%,location.ilike.%${q}%`);
    if (status) query = query.eq("status", status);
    const { data } = await query;
    events = data ?? [];
  }

  const canCreate = profile.role === "engineer" || profile.role === "admin";
  const filtered = !!(q || status);

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between reveal" style={{ animationDelay: ".06s" }}>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{isTech ? "My events" : "Events"}</h1>
          <p className="text-slate-400 text-sm mt-1">{events.length}{filtered ? " match" + (events.length === 1 ? "" : "es") : " total"}</p>
        </div>
        {canCreate && (
          <Link href="/events/new" className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="ms" style={{ fontSize: 18 }}>add</span> New event
          </Link>
        )}
      </div>

      {!isTech && <EventsToolbar />}

      <div className="card glass rounded-2xl divide-y divide-white/5 reveal" style={{ animationDelay: ".12s" }}>
        {events.length ? events.map((e) => {
          const b = statusBadge(e.status);
          return (
            <Link key={e.id} href={`/events/${e.id}`} className="row flex items-center justify-between px-5 py-4">
              <div>
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-slate-500">{e.client ? `${e.client} · ` : ""}{e.location ?? ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 hidden sm:block">{fmtRange(e.live_start, e.live_end)}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 ${b.cls}`}>
                  {b.live && <span className="h-1.5 w-1.5 rounded-full bg-violet-300 dot-live" />}{b.label}
                </span>
              </div>
            </Link>
          );
        }) : <p className="px-5 py-10 text-sm text-slate-400 text-center">{filtered ? "No events match your search." : "No events yet."}</p>}
      </div>
    </div>
  );
}
