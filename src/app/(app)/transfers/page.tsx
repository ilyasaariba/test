import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { fmtDMY } from "@/lib/ui";

const T: Record<string, { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30" },
  planned: { label: "Planned", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  sent: { label: "Sent", cls: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
  received: { label: "Received", cls: "bg-teal-500/15 text-teal-300 ring-teal-400/30" },
  completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  refused: { label: "Refused", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
  cancelled: { label: "Cancelled", cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
};

export default async function TransfersPage() {
  const profile = await getProfile();
  if (!["engineer", "admin", "boss"].includes(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: transfers }, { data: allEvents }] = await Promise.all([
    supabase.from("transfers")
      .select("id,quantity,status,scheduled_time,from_event_id,to_event_id,from_event_name,to_event_name,equipment_name, equipment(name)")
      .order("created_at", { ascending: false }),
    supabase.from("events").select("id,name"),
  ]);
  const list = transfers ?? [];
  const nameOf = (eid: string | null, fallback: string | null) =>
    fallback ?? (eid ? allEvents?.find((e: any) => e.id === eid)?.name : null) ?? "—";

  return (
    <div className="max-w-4xl space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <h1 className="text-3xl font-extrabold tracking-tight">Transfers</h1>
        <p className="text-slate-400 text-sm mt-1">{list.length} total · gear moving directly between events</p>
      </div>

      <div className="card glass rounded-2xl divide-y divide-white/5 reveal" style={{ animationDelay: ".12s" }}>
        {list.length ? list.map((t: any) => {
          const st = T[t.status] ?? T.planned;
          return (
            <div key={t.id} className="row flex items-center gap-4 px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-fuchsia-500/15 text-fuchsia-300 grid place-items-center text-lg shrink-0">⇄</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{t.quantity}× {t.equipment?.name ?? t.equipment_name ?? "equipment"}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{nameOf(t.from_event_id, t.from_event_name)}</span>
                  <span className="ms text-slate-500" style={{ fontSize: 14 }}>arrow_forward</span>
                  <span>{nameOf(t.to_event_id, t.to_event_name)}</span>
                </div>
              </div>
              <div className="text-xs text-slate-400 hidden sm:block">{fmtDMY(t.scheduled_time)}</div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${st.cls}`}>{st.label}</span>
            </div>
          );
        }) : <p className="px-5 py-10 text-sm text-slate-400 text-center">No transfers yet. They're created from an event when you resolve a shortfall.</p>}
      </div>
    </div>
  );
}
