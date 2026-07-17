import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { fmtDMY } from "@/lib/ui";
import PreparedCard from "./PreparedCard";
import TopupCard from "./TopupCard";

const GROUPS: { status: string; title: string; hint: string; accent: string; icon: string }[] = [
  { status: "sent_to_warehouse", title: "New requests", hint: "Engineer is waiting — start preparing.", accent: "text-sky-300", icon: "inbox" },
  { status: "prepared", title: "Ready to ship", hint: "Packed — hand off to the event.", accent: "text-blue-300", icon: "deployed_code" },
  { status: "shipped", title: "In transit", hint: "On the way — awaiting site confirmation.", accent: "text-amber-300", icon: "local_shipping" },
  { status: "returning", title: "Returning", hint: "Check the gear back in to free the stock.", accent: "text-cyan-300", icon: "keyboard_return" },
  { status: "reconciliation", title: "Reconciliation", hint: "Resolve missing/damaged gear to close out.", accent: "text-orange-300", icon: "rule" },
];

export default async function WarehouseRequestsPage() {
  const profile = await getProfile();
  if (profile.role !== "warehouse_manager" && profile.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id,name,client,location,status,montage_start,live_start,live_end,prepare_deadline,shipper")
    .in("status", ["sent_to_warehouse", "prepared", "shipped", "returning", "reconciliation"])
    .order("live_start", { ascending: true });

  const ids = (events ?? []).map((e: any) => e.id);
  const linesByEvent: Record<string, { total: number; prepared: number; qty: number }> = {};
  if (ids.length) {
    const { data: lines } = await supabase
      .from("event_equipment").select("event_id,quantity,wm_prepared").in("event_id", ids);
    for (const l of lines ?? []) {
      const e = (linesByEvent[l.event_id] ??= { total: 0, prepared: 0, qty: 0 });
      e.total += 1; e.qty += l.quantity ?? 0; if (l.wm_prepared) e.prepared += 1;
    }
  }

  const byStatus = (s: string) => (events ?? []).filter((e: any) => e.status === s);

  // Mid-event warehouse top-up requests (from_event_id null) awaiting a ship.
  const { data: topupRows } = await supabase
    .from("transfers")
    .select("id,quantity,equipment_name,to_event_name,requested_by_name,created_at")
    .is("from_event_id", null).eq("status", "requested")
    .order("created_at", { ascending: true });
  const topups = (topupRows ?? []).map((t: any) => ({
    id: t.id, equipmentName: t.equipment_name ?? "gear", quantity: t.quantity,
    toEventName: t.to_event_name ?? "an event", requestedByName: t.requested_by_name ?? null,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <h1 className="text-xl font-semibold tracking-tight">Requests</h1>
        <p className="text-slate-400 text-sm mt-1">Prepare and ship equipment for the engineer&apos;s events · {events?.length ?? 0} active</p>
      </div>

      {topups.length > 0 && (
        <section className="reveal" style={{ animationDelay: ".1s" }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="ms text-fuchsia-300" style={{ fontSize: 18 }}>bolt</span>
            <h2 className="font-bold">Top-up requests</h2>
            <span className="text-xs text-slate-500">· {topups.length}</span>
            <span className="text-[11px] text-slate-500">— extra gear needed mid-event</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {topups.map((t) => <TopupCard key={t.id} topup={t} />)}
          </div>
        </section>
      )}

      {GROUPS.map((g, gi) => {
        const list = byStatus(g.status);
        return (
          <section key={g.status} className="reveal" style={{ animationDelay: `${0.12 + gi * 0.06}s` }}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={`ms ${g.accent}`} style={{ fontSize: 18 }}>{g.icon}</span>
              <h2 className="font-bold">{g.title}</h2>
              <span className="text-xs text-slate-500">· {list.length}</span>
            </div>

            {list.length === 0 ? (
              <p className="text-sm text-slate-500 px-1 pb-2">{g.status === "sent_to_warehouse" ? "No new requests." : "Nothing here."}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {list.map((e: any) => {
                  const agg = linesByEvent[e.id] ?? { total: 0, prepared: 0, qty: 0 };
                  const pct = agg.total ? Math.round((agg.prepared / agg.total) * 100) : 0;
                  if (g.status === "prepared") {
                    return <PreparedCard key={e.id} event={e} total={agg.total} qty={agg.qty} />;
                  }
                  return (
                    <Link key={e.id} href={`/warehouse/requests/${e.id}`} className="card glass rounded-2xl p-4 block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{e.name}</div>
                          <div className="text-xs text-slate-500 truncate">{e.client ? `${e.client} · ` : ""}{e.location ?? ""}</div>
                        </div>
                        <span className="ms text-slate-500 shrink-0" style={{ fontSize: 18 }}>chevron_right</span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-slate-400">{agg.total} lines · {agg.qty} units</span>
                        <span className="text-slate-400">live {fmtDMY(e.live_start)}</span>
                      </div>

                      {g.status === "sent_to_warehouse" && (
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full grad" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">{agg.prepared}/{agg.total} prepared</div>
                        </div>
                      )}
                      {g.status !== "sent_to_warehouse" && (
                        <div className={`mt-2 text-[11px] ${g.accent}`}>{g.hint}</div>
                      )}
                      {g.status === "shipped" && e.shipper && (
                        <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                          <span className="ms" style={{ fontSize: 13 }}>local_shipping</span> Driver: <span className="font-semibold text-slate-200">{e.shipper}</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {!events?.length && !topups.length && (
        <div className="card glass rounded-2xl px-5 py-10 text-center reveal" style={{ animationDelay: ".18s" }}>
          <p className="text-sm text-slate-300 font-medium">No active requests.</p>
          <p className="text-xs text-slate-500 mt-1">When an engineer sends an event to the warehouse, it shows up here to prepare.</p>
        </div>
      )}
    </div>
  );
}
