import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { fmtRange, eventBadge, isOverdue } from "@/lib/ui";
import CountUp from "@/components/CountUp";
import BossDashboard from "./BossDashboard";

function progressPct(e: any): number {
  const s = e.montage_start ?? e.live_start;
  const en = e.demontage_end ?? e.live_end;
  if (!s || !en) return 0;
  const a = +new Date(s), b = +new Date(en);
  if (b <= a) return 0;
  return Math.max(0, Math.min(1, (Date.now() - a) / (b - a)));
}

function Stat({ label, value, icon, sub, tone = "default", href }: {
  label: string; value: number; icon: string; sub?: React.ReactNode;
  tone?: "default" | "amber" | "rose"; href?: string;
}) {
  const iconCls = tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-indigo-300";
  const valCls = tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "";
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`ms ${iconCls}`} style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div className={`text-[27px] font-semibold mt-2 num ${valCls}`}><CountUp value={value} /></div>
      {sub && <div className="text-xs mt-1 font-medium">{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card glass rounded-2xl p-5 block relative group cursor-pointer h-full">
        <span className="ms absolute bottom-3 right-3 text-slate-600 opacity-0 group-hover:opacity-100 transition" style={{ fontSize: 16 }}>arrow_outward</span>
        {inner}
      </Link>
    );
  }
  return <div className="card glass rounded-2xl p-5 h-full">{inner}</div>;
}

export default async function DashboardPage() {
  const profile = await getProfile();

  // The Boss gets a dedicated, read-only command center.
  if (profile.role === "boss") return <BossDashboard profile={profile} />;

  const supabase = await createClient();
  const firstName = profile.full_name.split(" ")[0];
  const canCreate = profile.role === "engineer" || profile.role === "admin";
  // Only link a card to a page the viewer can actually open.
  const transfersHref = ["engineer", "admin"].includes(profile.role) ? "/transfers" : undefined;
  const missingHref = profile.role !== "technician" ? "/missing" : undefined;

  const [eventsRes, equipRes, missingRes, transfersRes] = await Promise.all([
    supabase.from("events")
      .select("id,name,client,location,status,live_start,live_end,montage_start,demontage_end")
      .order("live_end", { ascending: false, nullsFirst: false }),
    supabase.from("equipment").select("total_quantity"),
    supabase.from("missing_items").select("id,is_critical,quantity, equipment(name)").eq("status", "missing"),
    supabase.from("transfers").select("id,quantity, equipment(name)").in("status", ["requested", "sent"]),
  ]);

  const events = eventsRes.data ?? [];
  const units = (equipRes.data ?? []).reduce((s: number, r: any) => s + (r.total_quantity ?? 0), 0);
  const missing = missingRes.data ?? [];
  const transfers = transfersRes.data ?? [];

  const active = events.filter((e: any) => !["archived", "cancelled"].includes(e.status)).length;
  // A "Live" event whose scheduled end has passed is overdue, not live.
  const liveEvents = events.filter((e: any) => e.status === "in_progress" && !isOverdue(e));
  const overdueEvents = events.filter((e: any) => isOverdue(e));
  const liveCount = liveEvents.length;
  const criticalMissing = missing.filter((m: any) => m.is_critical);

  const liveEvent = liveEvents[0];
  const pct = liveEvent ? progressPct(liveEvent) : 0;
  const ringOff = (213.6 * (1 - pct)).toFixed(1);

  const isWm = profile.role === "warehouse_manager";
  const newRequests = events.filter((e: any) => e.status === "sent_to_warehouse").length;
  const toShip = events.filter((e: any) => e.status === "prepared").length;
  const toCheckIn = events.filter((e: any) => e.status === "returning").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between reveal" style={{ animationDelay: ".18s" }}>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Good day, {firstName}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {profile.role === "warehouse_manager" ? "Prep, ship, and check the gear back in."
              : profile.role === "technician" ? "Here are your jobs and events."
              : profile.role === "admin" ? "Full control across every workspace."
              : "Plan events, source the gear, run the show."}
          </p>
        </div>
      </div>

      {isWm && (
        <Link href="/warehouse/requests" className="card gborder glass rounded-2xl p-5 flex items-center justify-between gap-4 reveal" style={{ animationDelay: ".2s" }}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-500/15 text-sky-300 grid place-items-center">
              <span className="ms" style={{ fontSize: 24 }}>assignment</span>
            </div>
            <div>
              <div className="font-bold">Equipment requests</div>
              <div className="text-sm text-slate-400">
                <span className="text-sky-300 font-semibold">{newRequests} new</span> to prepare · <span className="text-blue-300 font-semibold">{toShip}</span> ready to ship · <span className="text-cyan-300 font-semibold">{toCheckIn}</span> to check in
              </div>
            </div>
          </div>
          <span className="btn-primary grad text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2">
            Open requests <span className="ms" style={{ fontSize: 18 }}>arrow_forward</span>
          </span>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="reveal" style={{ animationDelay: ".24s" }}>
          <Stat label="Active events" value={active} icon="event_available" href="/events"
            sub={<span className="text-emerald-400 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 dot-live" />{liveCount} live now</span>} />
        </div>
        <div className="reveal" style={{ animationDelay: ".30s" }}>
          <Stat label="Equipment units" value={units} icon="inventory_2" href="/warehouse" sub={<span className="text-slate-500">owned in warehouse</span>} />
        </div>
        <div className="reveal" style={{ animationDelay: ".36s" }}>
          <Stat label="Active transfers" value={transfers.length} icon="swap_horiz" tone="amber" href={transfersHref} sub={<span className="text-amber-400/80">requested + in transit</span>} />
        </div>
        <div className="reveal" style={{ animationDelay: ".42s" }}>
          <Stat label="Missing items" value={missing.length} icon="error" tone="rose" href={missingHref}
            sub={<span className="text-rose-400/80">{criticalMissing.length} critical · blocks archive</span>} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Events */}
        <section className="lg:col-span-2 card glass rounded-2xl reveal" style={{ animationDelay: ".48s" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-bold">Events</h2>
            <Link href="/events" className="text-sm text-indigo-300 font-semibold hover:text-indigo-200 flex items-center gap-1">
              View all <span className="ms" style={{ fontSize: 16 }}>arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {events.length ? events.slice(0, 6).map((e: any) => {
              const p = eventBadge(e);
              return (
                <Link key={e.id} href={`/events/${e.id}`} className="row flex items-center justify-between px-5 py-3.5">
                  <div>
                    <div className="font-semibold">{e.name}</div>
                    <div className="text-xs text-slate-500">{e.client ? `${e.client} · ` : ""}{e.location ?? ""}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{fmtRange(e.live_start, e.live_end)}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 ${p.cls}`}>
                      {p.live && <span className="h-1.5 w-1.5 rounded-full bg-[#16803C] dot-live" />}{p.label}
                    </span>
                  </div>
                </Link>
              );
            }) : <p className="px-5 py-8 text-sm text-slate-400">No events yet.{canCreate && <> Create your first one.</>}</p>}
          </div>
        </section>

        {/* Right column */}
        <div className="space-y-4">
          {/* Live event */}
          {liveEvent ? (
            <Link href={`/events/${liveEvent.id}`} className="card gborder glass rounded-2xl p-5 reveal block" style={{ animationDelay: ".52s" }}>
              <span className="text-xs font-semibold text-[#16803C] flex items-center gap-2 tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16803C] dot-live" />LIVE NOW
              </span>
              <div className="flex items-center gap-4 mt-3">
                <svg className="ring" width="84" height="84" viewBox="0 0 84 84" style={{ "--ring-off": ringOff } as React.CSSProperties}>
                  <circle cx="42" cy="42" r="34" fill="none" stroke="#F0F3F6" strokeWidth="7" />
                  <circle className="prog" cx="42" cy="42" r="34" fill="none" stroke="var(--accent-hex)" strokeWidth="7" strokeLinecap="round" transform="rotate(-90 42 42)" />
                  <text x="42" y="47" textAnchor="middle" fill="#1B2A3A" fontSize="15" fontWeight="700">{Math.round(pct * 100)}%</text>
                </svg>
                <div>
                  <div className="font-semibold">{liveEvent.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Live · {liveEvent.location ?? "—"}</div>
                  <div className="text-xs text-slate-500 mt-1">{fmtRange(liveEvent.live_start, liveEvent.live_end)}</div>
                </div>
              </div>
            </Link>
          ) : (
            <section className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".52s" }}>
              <span className="text-xs font-semibold text-slate-400">LIVE NOW</span>
              <p className="text-sm text-slate-400 mt-2">No events are live right now.</p>
            </section>
          )}

          {/* Needs attention panel */}
          <section className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".58s" }}>
            <h2 className="font-bold mb-4">Needs attention</h2>

            {overdueEvents.slice(0, 2).map((e: any) => (
              <Link key={e.id} href={`/events/${e.id}`} className="block rounded-xl p-4 mb-3 bg-amber-500/10 ring-1 ring-amber-400/25 hover:bg-amber-500/15 transition">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <span className="ms" style={{ fontSize: 18 }}>schedule</span>Event overdue
                </div>
                <p className="text-xs text-amber-200/70 mt-1">{e.name} — ended but still live. End it to send the gear back.</p>
              </Link>
            ))}

            {criticalMissing.slice(0, 2).map((m: any) => (
              <div key={m.id} className="rounded-xl p-4 mb-3 bg-rose-500/10 ring-1 ring-rose-400/25">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                  <span className="ms" style={{ fontSize: 18 }}>priority_high</span>Critical missing
                </div>
                <p className="text-xs text-rose-200/70 mt-1">{m.quantity}× {m.equipment?.name ?? "item"} — blocks archive.</p>
              </div>
            ))}

            {transfers.slice(0, 2).map((t: any) => (
              <div key={t.id} className="rounded-xl p-4 mb-3 bg-white/5 ring-1 ring-white/10">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                  <span className="ms" style={{ fontSize: 18 }}>swap_horiz</span>Transfer in progress
                </div>
                <p className="text-xs text-slate-400 mt-1">{t.quantity}× {t.equipment?.name ?? "item"} — being moved between events.</p>
              </div>
            ))}

            {!overdueEvents.length && !criticalMissing.length && !transfers.length && (
              <p className="text-sm text-slate-400">All clear — nothing needs your attention.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
