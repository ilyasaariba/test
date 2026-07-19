import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { eventBadge, fmtRange, fmtDMY } from "@/lib/ui";
import { agedCutoffISO } from "@/lib/historyWindow";
import EventsToolbar from "./EventsToolbar";
import PageHeader from "@/components/PageHeader";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const { q, status, view } = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();
  const isTech = profile.role === "technician";
  const showHistory = view === "history";

  /* ================= HISTORY: events archived 24h+ ago, kept forever ================= */
  if (showHistory) {
    let arch: any[] = [];
    const { data } = await supabase
      .from("event_archives")
      .select("event_id,event_name,client,location,live_start,live_end,total_lines,total_units,transfer_count,archived_at,archived_by_name")
      .lte("archived_at", agedCutoffISO())
      .order("archived_at", { ascending: false });
    arch = data ?? [];
    if (isTech) {
      // technicians only see events they were crewed on
      const { data: mine } = await supabase
        .from("event_technicians").select("event_id").eq("user_id", profile.id);
      const mineIds = new Set((mine ?? []).map((r: any) => r.event_id));
      arch = arch.filter((a: any) => mineIds.has(a.event_id));
    }

    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="reveal" style={{ animationDelay: ".06s" }}>
          <PageHeader
            icon="history"
            title="Events history"
            sub={`${arch.length} archived event${arch.length === 1 ? "" : "s"} — click one for its details`}
            action={
              <Link href="/events" className="glass rounded-xl px-3.5 py-2 text-sm font-semibold flex items-center gap-1.5 hover:bg-[var(--surface2)] transition">
                <span className="ms" style={{ fontSize: 18 }}>arrow_back</span> Current events
              </Link>
            }
          />
        </div>

        <div className="card glass rounded-2xl divide-y divide-white/5 reveal" style={{ animationDelay: ".12s" }}>
          {arch.length ? arch.map((a: any) => (
            <Link key={a.event_id ?? a.archived_at} href={a.event_id ? `/events/${a.event_id}` : "/events?view=history"}
              className="row flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-hex)] grid place-items-center shrink-0">
                  <span className="ms" style={{ fontSize: 20 }}>archive</span>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.event_name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {a.client ? `${a.client} · ` : ""}{a.location ?? ""}
                    {a.total_units != null ? ` · ${a.total_units} units` : ""}
                    {a.transfer_count ? ` · ${a.transfer_count} transfers` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400 hidden sm:block">{fmtRange(a.live_start, a.live_end)}</span>
                <span className="text-[11px] text-slate-500 hidden md:block">archived {fmtDMY(a.archived_at)}</span>
                <span className="ms text-slate-500" style={{ fontSize: 18 }}>chevron_right</span>
              </div>
            </Link>
          )) : (
            <p className="px-5 py-10 text-sm text-slate-400 text-center">
              No archived events yet. Events move here 24 hours after they're closed out.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ================= CURRENT ================= */
  // Events archived more than 24h ago have moved to History — keep them off the list.
  const { data: agedArch } = await supabase
    .from("event_archives").select("event_id").lte("archived_at", agedCutoffISO());
  const agedIds = new Set((agedArch ?? []).map((r: any) => r.event_id));

  let events: any[] = [];
  if (isTech) {
    const { data } = await supabase
      .from("event_technicians")
      .select("events(id,name,client,location,status,live_start,live_end,demontage_end)")
      .eq("user_id", profile.id);
    events = (data ?? []).map((r: any) => r.events).filter(Boolean)
      .sort((a: any, b: any) => (b.live_end ?? "").localeCompare(a.live_end ?? ""));
  } else {
    let query = supabase
      .from("events")
      .select("id,name,client,location,status,live_start,live_end,demontage_end")
      .order("live_end", { ascending: false, nullsFirst: false });
    if (q) query = query.or(`name.ilike.%${q}%,client.ilike.%${q}%,location.ilike.%${q}%`);
    if (status) query = query.eq("status", status);
    const { data } = await query;
    events = data ?? [];
  }
  events = events.filter((e: any) => !agedIds.has(e.id));

  const canCreate = profile.role === "engineer" || profile.role === "admin";
  const filtered = !!(q || status);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <PageHeader
          icon="event"
          title={isTech ? "My events" : "Events"}
          sub={`${events.length}${filtered ? " match" + (events.length === 1 ? "" : "es") : " total"}`}
          action={
            <div className="flex items-center gap-2">
              <Link href="/events?view=history" title="Events history"
                className="glass rounded-xl px-3.5 py-2 text-sm font-semibold flex items-center gap-1.5 hover:bg-[var(--surface2)] transition">
                <span className="ms" style={{ fontSize: 18 }}>history</span> History
              </Link>
              {canCreate && (
                <Link href="/events/new" className="btn-primary text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span className="ms" style={{ fontSize: 18 }}>add</span> New event
                </Link>
              )}
            </div>
          }
        />
      </div>

      {!isTech && <EventsToolbar />}

      <div className="card glass rounded-2xl divide-y divide-white/5 reveal" style={{ animationDelay: ".12s" }}>
        {events.length ? events.map((e) => {
          const b = eventBadge(e);
          return (
            <Link key={e.id} href={`/events/${e.id}`} className="row flex items-center justify-between px-5 py-4">
              <div>
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-slate-500">{e.client ? `${e.client} · ` : ""}{e.location ?? ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 hidden sm:block">{fmtRange(e.live_start, e.live_end)}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 ${b.cls}`}>
                  {b.live && <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)] dot-live" />}{b.label}
                </span>
              </div>
            </Link>
          );
        }) : <p className="px-5 py-10 text-sm text-slate-400 text-center">{filtered ? "No events match your search." : "No events yet."}</p>}
      </div>
    </div>
  );
}
