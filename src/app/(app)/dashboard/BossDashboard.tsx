import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { statusBadge, fmtDMY, fmtRange, ROLE_LABEL } from "@/lib/ui";
import CountUp from "@/components/CountUp";

const ACTIVE_EXCLUDE = ["archived", "cancelled"];

const STAGES: { key: string; label: string; cls: string }[] = [
  { key: "draft", label: "Draft", cls: "text-slate-300" },
  { key: "sent_to_warehouse", label: "Requested", cls: "text-sky-300" },
  { key: "prepared", label: "Prepared", cls: "text-blue-300" },
  { key: "shipped", label: "Shipped", cls: "text-amber-300" },
  { key: "received_on_site", label: "On site", cls: "text-teal-300" },
  { key: "in_progress", label: "Live", cls: "text-violet-300" },
  { key: "returning", label: "Returning", cls: "text-cyan-300" },
  { key: "archived", label: "Done", cls: "text-emerald-300" },
];

function progressPct(e: any): number {
  const s = e.montage_start ?? e.live_start;
  const en = e.demontage_end ?? e.live_end;
  if (!s || !en) return 0;
  const a = +new Date(s), b = +new Date(en);
  if (b <= a) return 0;
  return Math.max(0, Math.min(1, (Date.now() - a) / (b - a)));
}

function utilTone(pct: number) {
  if (pct >= 85) return { bar: "linear-gradient(90deg,#fb7185,#f43f5e)", text: "text-rose-300" };
  if (pct >= 60) return { bar: "linear-gradient(90deg,#fbbf24,#f59e0b)", text: "text-amber-300" };
  return { bar: "linear-gradient(120deg,var(--ind),var(--vio),var(--fuc))", text: "text-sky-300" };
}

export default async function BossDashboard({ profile }: { profile: { full_name: string } }) {
  const supabase = await createClient();
  const firstName = profile.full_name.split(" ")[0];

  const [
    eventsRes, equipRes, transfersRes, missingRes, rentalsRes,
    archivesRes, usersRes, crewRes, linesRes, tasksRes,
  ] = await Promise.all([
    supabase.from("events").select("id,name,client,location,status,montage_start,live_start,live_end,demontage_end").order("created_at", { ascending: false }),
    supabase.from("equipment_availability").select("name,category,owned,committed,available"),
    supabase.from("transfers").select("id,status, equipment(name)"),
    supabase.from("missing_items").select("id,is_critical,quantity, equipment(name)").eq("status", "missing"),
    supabase.from("rentals").select("id,quantity,lender_name, equipment(name)").eq("returned", false),
    supabase.from("event_archives").select("event_name,total_units,transfer_count,archived_at").order("archived_at", { ascending: false }),
    supabase.from("app_users").select("id,full_name,role,is_active"),
    supabase.from("event_technicians").select("event_id,user_id"),
    supabase.from("event_equipment").select("event_id,quantity, equipment_allocations(quantity)"),
    supabase.from("tasks").select("assigned_to,status"),
  ]);

  const events = eventsRes.data ?? [];
  const equip = equipRes.data ?? [];
  const transfers = transfersRes.data ?? [];
  const missing = missingRes.data ?? [];
  const rentals = rentalsRes.data ?? [];
  const archives = archivesRes.data ?? [];
  const users = usersRes.data ?? [];
  const crew = crewRes.data ?? [];
  const lines = linesRes.data ?? [];
  const tasks = tasksRes.data ?? [];

  // ---- KPIs ----
  const activeEvents = events.filter((e: any) => !ACTIVE_EXCLUDE.includes(e.status));
  const liveEvents = events.filter((e: any) => e.status === "in_progress");
  const totalOwned = equip.reduce((s: number, e: any) => s + (e.owned ?? 0), 0);
  const totalOut = equip.reduce((s: number, e: any) => s + (e.committed ?? 0), 0);
  const utilPct = totalOwned ? Math.round((totalOut / totalOwned) * 100) : 0;
  const plannedTransfers = transfers.filter((t: any) => t.status === "planned").length;
  const criticalMissing = missing.filter((m: any) => m.is_critical);
  const rentalUnits = rentals.reduce((s: number, r: any) => s + (r.quantity ?? 0), 0);
  const completed = archives.length;
  const archivedUnits = archives.reduce((s: number, a: any) => s + (a.total_units ?? 0), 0);

  // ---- pipeline counts ----
  const stageCount: Record<string, number> = {};
  for (const e of events) stageCount[e.status] = (stageCount[e.status] ?? 0) + 1;
  const maxStage = Math.max(1, ...STAGES.map((s) => stageCount[s.key] ?? 0));

  // ---- utilization by category ----
  const catMap: Record<string, { owned: number; out: number }> = {};
  for (const e of equip) {
    const c = (catMap[e.category] ??= { owned: 0, out: 0 });
    c.owned += e.owned ?? 0; c.out += e.committed ?? 0;
  }
  const categories = Object.entries(catMap)
    .map(([name, v]) => ({ name, ...v, pct: v.owned ? Math.round((v.out / v.owned) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  // ---- per-event crew + sourcing health ----
  const crewByEvent: Record<string, number> = {};
  for (const c of crew) crewByEvent[c.event_id] = (crewByEvent[c.event_id] ?? 0) + 1;

  const sourcedByEvent: Record<string, { needed: number; sourced: number }> = {};
  for (const l of lines as any[]) {
    const s = (sourcedByEvent[l.event_id] ??= { needed: 0, sourced: 0 });
    s.needed += l.quantity ?? 0;
    s.sourced += (l.equipment_allocations ?? []).reduce((a: number, x: any) => a + (x.quantity ?? 0), 0);
  }
  const shortfallEvents = activeEvents
    .map((e: any) => ({ e, gap: Math.max(0, (sourcedByEvent[e.id]?.needed ?? 0) - (sourcedByEvent[e.id]?.sourced ?? 0)) }))
    .filter((x) => x.gap > 0);

  const zeroStock = equip.filter((e: any) => (e.available ?? 0) <= 0);

  // ---- team ----
  const roleCounts: Record<string, number> = {};
  for (const u of users) if (u.is_active) roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1;
  const openTaskByUser: Record<string, number> = {};
  for (const t of tasks as any[]) if (!["done", "cancelled"].includes(t.status) && t.assigned_to) openTaskByUser[t.assigned_to] = (openTaskByUser[t.assigned_to] ?? 0) + 1;
  const technicians = users.filter((u: any) => u.role === "technician" && u.is_active);

  const kpis = [
    { label: "Active events", value: activeEvents.length, icon: "event_available", sub: `${liveEvents.length} live now`, tone: "text-violet-300", live: liveEvents.length > 0 },
    { label: "Fleet in use", value: utilPct, suffix: "%", icon: "donut_large", sub: `${totalOut.toLocaleString()} of ${totalOwned.toLocaleString()} units out`, tone: utilTone(utilPct).text },
    { label: "Planned transfers", value: plannedTransfers, icon: "swap_horiz", sub: "awaiting a technician", tone: "text-amber-300" },
    { label: "Rentals in", value: rentalUnits, icon: "south_west", sub: `${rentals.length} active`, tone: "text-fuchsia-300" },
    { label: "Critical missing", value: criticalMissing.length, icon: "priority_high", sub: `${missing.length} flagged total`, tone: "text-rose-300" },
    { label: "Events delivered", value: completed, icon: "verified", sub: `${archivedUnits.toLocaleString()} units moved`, tone: "text-emerald-300" },
  ];

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="flex items-end justify-between gap-4 reveal" style={{ animationDelay: ".05s" }}>
        <div>
          <span className="text-xs font-semibold tracking-widest text-indigo-300/80">COMMAND CENTER</span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">Welcome back, <span className="grad-text">{firstName}</span></h1>
          <p className="text-slate-400 text-sm mt-1">The whole operation, at a glance — {fmtDMY(new Date().toISOString())}.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 glass rounded-xl px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 dot-live" />
          <span className="text-xs text-slate-300 font-medium">{liveEvents.length} live · {activeEvents.length} active</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k, i) => (
          <div key={k.label} className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{k.label}</span>
              <span className={`ms ${k.tone}`} style={{ fontSize: 20 }}>{k.icon}</span>
            </div>
            <div className={`text-4xl font-extrabold mt-2 flex items-baseline ${k.tone}`}>
              <CountUp value={k.value} />{k.suffix && <span className="text-2xl ml-0.5">{k.suffix}</span>}
            </div>
            <div className="text-xs mt-1 font-medium text-slate-500 flex items-center gap-1.5">
              {k.live && <span className="h-1.5 w-1.5 rounded-full bg-violet-400 dot-live" />}{k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* pipeline */}
      <section className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".2s" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Operations pipeline</h2>
          <Link href="/events" className="text-sm text-indigo-300 font-semibold hover:text-indigo-200 flex items-center gap-1">All events <span className="ms" style={{ fontSize: 16 }}>arrow_forward</span></Link>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {STAGES.map((s, i) => {
            const n = stageCount[s.key] ?? 0;
            return (
              <div key={s.key} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3 flex flex-col items-center gap-2">
                <div className={`text-2xl font-extrabold ${s.cls}`}><CountUp value={n} /></div>
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full grad barfill" style={{ width: `${(n / maxStage) * 100}%`, animationDelay: `${0.3 + i * 0.05}s` }} />
                </div>
                <div className="text-[10px] font-semibold text-slate-400 text-center leading-tight">{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* utilization by category */}
        <section className="lg:col-span-2 card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".26s" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Fleet utilization by category</h2>
            <Link href="/warehouse" className="text-sm text-indigo-300 font-semibold hover:text-indigo-200 flex items-center gap-1">Warehouse <span className="ms" style={{ fontSize: 16 }}>arrow_forward</span></Link>
          </div>
          <div className="space-y-3">
            {categories.map((c, i) => {
              const tone = utilTone(c.pct);
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-slate-400 text-xs"><span className={`font-bold ${tone.text}`}>{c.out}</span> / {c.owned} out · {c.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full barfill" style={{ width: `${c.pct}%`, background: tone.bar, animationDelay: `${0.34 + i * 0.05}s` }} />
                  </div>
                </div>
              );
            })}
            {!categories.length && <p className="text-sm text-slate-500">No equipment yet.</p>}
          </div>
        </section>

        {/* needs attention */}
        <section className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".3s" }}>
          <h2 className="font-bold mb-4">Needs attention</h2>
          <div className="space-y-3">
            {criticalMissing.slice(0, 3).map((m: any) => (
              <div key={m.id} className="rounded-xl p-3 bg-rose-500/10 ring-1 ring-rose-400/25">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm"><span className="ms" style={{ fontSize: 16 }}>priority_high</span>Critical missing</div>
                <p className="text-xs text-rose-200/70 mt-0.5">{m.quantity}× {m.equipment?.name ?? "item"} — blocks archive.</p>
              </div>
            ))}
            {shortfallEvents.slice(0, 3).map(({ e, gap }) => (
              <div key={e.id} className="rounded-xl p-3 bg-amber-500/10 ring-1 ring-amber-400/25">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm"><span className="ms" style={{ fontSize: 16 }}>error</span>Unsourced gear</div>
                <p className="text-xs text-amber-200/70 mt-0.5">{e.name} — {gap} unit{gap === 1 ? "" : "s"} still to source.</p>
              </div>
            ))}
            {zeroStock.slice(0, 3).map((z: any) => (
              <div key={z.name} className="rounded-xl p-3 bg-white/5 ring-1 ring-white/10">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm"><span className="ms" style={{ fontSize: 16 }}>inventory_2</span>Out of stock</div>
                <p className="text-xs text-slate-400 mt-0.5">{z.name} — 0 available.</p>
              </div>
            ))}
            {!criticalMissing.length && !shortfallEvents.length && !zeroStock.length && (
              <p className="text-sm text-slate-400">All clear ✨</p>
            )}
          </div>
        </section>
      </div>

      {/* live now */}
      {liveEvents.length > 0 && (
        <section className="reveal" style={{ animationDelay: ".34s" }}>
          <h2 className="font-bold mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-300 dot-live" />Live right now</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveEvents.map((e: any) => {
              const pct = progressPct(e);
              const ringOff = (213.6 * (1 - pct)).toFixed(1);
              return (
                <Link key={e.id} href={`/events/${e.id}`} className="card gborder glass rounded-2xl p-5 flex items-center gap-4">
                  <svg className="ring" width="76" height="76" viewBox="0 0 84 84" style={{ "--ring-off": ringOff } as React.CSSProperties}>
                    <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
                    <circle className="prog" cx="42" cy="42" r="34" fill="none" stroke="url(#bg)" strokeWidth="7" strokeLinecap="round" transform="rotate(-90 42 42)" />
                    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--ind)" /><stop offset="1" stopColor="var(--fuc)" /></linearGradient></defs>
                    <text x="42" y="47" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">{Math.round(pct * 100)}%</text>
                  </svg>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{e.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">{e.location ?? "—"}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><span className="ms" style={{ fontSize: 14 }}>group</span>{crewByEvent[e.id] ?? 0} crew · {fmtRange(e.live_start, e.live_end)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* active events table */}
        <section className="lg:col-span-2 card glass rounded-2xl reveal" style={{ animationDelay: ".4s" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="font-bold">Active events</h2>
            <span className="text-xs text-slate-500">{activeEvents.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {activeEvents.slice(0, 8).map((e: any) => {
              const b = statusBadge(e.status);
              const gap = Math.max(0, (sourcedByEvent[e.id]?.needed ?? 0) - (sourcedByEvent[e.id]?.sourced ?? 0));
              return (
                <Link key={e.id} href={`/events/${e.id}`} className="row flex items-center justify-between px-5 py-3.5 gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{e.name}</div>
                    <div className="text-xs text-slate-500 truncate">{e.client ? `${e.client} · ` : ""}{e.location ?? ""}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {gap > 0
                      ? <span className="text-[11px] text-amber-300 hidden sm:flex items-center gap-1"><span className="ms" style={{ fontSize: 14 }}>error</span>{gap} short</span>
                      : <span className="text-[11px] text-emerald-400 hidden sm:flex items-center gap-1"><span className="ms" style={{ fontSize: 14 }}>check_circle</span>sourced</span>}
                    <span className="text-[11px] text-slate-500 hidden md:flex items-center gap-1"><span className="ms" style={{ fontSize: 14 }}>group</span>{crewByEvent[e.id] ?? 0}</span>
                    <span className="text-xs text-slate-400 hidden lg:block">{fmtRange(e.live_start, e.live_end)}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 ${b.cls}`}>
                      {b.live && <span className="h-1.5 w-1.5 rounded-full bg-violet-300 dot-live" />}{b.label}
                    </span>
                  </div>
                </Link>
              );
            })}
            {!activeEvents.length && <p className="px-5 py-8 text-sm text-slate-400">No active events.</p>}
          </div>
        </section>

        {/* team + recent completions */}
        <div className="space-y-5">
          <section className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".44s" }}>
            <h2 className="font-bold mb-3">Team</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(roleCounts).map(([role, n]) => (
                <span key={role} className="px-2.5 py-1 rounded-full glass text-xs font-semibold">{n} {ROLE_LABEL[role] ?? role}</span>
              ))}
            </div>
            <div className="space-y-1.5">
              {technicians.map((t: any) => {
                const open = openTaskByUser[t.id] ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/15 text-indigo-300 grid place-items-center font-bold text-sm shrink-0">{t.full_name.charAt(0)}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{t.full_name}</div></div>
                    <span className={`text-[11px] font-semibold ${open ? "text-amber-300" : "text-slate-500"}`}>{open} open</span>
                  </div>
                );
              })}
              {!technicians.length && <p className="text-sm text-slate-500">No technicians yet.</p>}
            </div>
          </section>

          <section className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".48s" }}>
            <h2 className="font-bold mb-3 flex items-center gap-2"><span className="ms text-emerald-300" style={{ fontSize: 18 }}>history</span>Recently delivered</h2>
            <div className="space-y-1.5">
              {archives.slice(0, 5).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <div className="min-w-0"><div className="text-sm font-medium truncate">{a.event_name}</div><div className="text-[11px] text-slate-500">{fmtDMY(a.archived_at)}</div></div>
                  <div className="text-right shrink-0"><div className="text-xs font-bold text-emerald-300">{a.total_units} units</div>{a.transfer_count > 0 && <div className="text-[10px] text-fuchsia-300">{a.transfer_count} transfer{a.transfer_count === 1 ? "" : "s"}</div>}</div>
                </div>
              ))}
              {!archives.length && <p className="text-sm text-slate-500">No completed events yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
