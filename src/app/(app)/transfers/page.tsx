import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { fmtDMY } from "@/lib/ui";

const T: Record<string, { label: string; cls: string; dot: string }> = {
  requested: { label: "Requested", cls: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30", dot: "bg-fuchsia-400" },
  planned: { label: "Planned", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30", dot: "bg-amber-400" },
  sent: { label: "In transit", cls: "bg-sky-500/15 text-sky-300 ring-sky-400/30", dot: "bg-sky-400" },
  received: { label: "Received", cls: "bg-teal-500/15 text-teal-300 ring-teal-400/30", dot: "bg-teal-400" },
  completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400" },
  refused: { label: "Refused", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30", dot: "bg-slate-400" },
};

export default async function TransferRecordPage() {
  const profile = await getProfile();
  if (!["engineer", "admin", "boss"].includes(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: transfers } = await supabase
    .from("transfers")
    .select("id,quantity,requested_quantity,status,from_event_id,from_event_name,to_event_name,equipment_name,requested_by_name,decided_by_name,created_at,decided_at,received_at,note")
    .order("created_at", { ascending: false });
  const list = transfers ?? [];

  const completed = list.filter((t: any) => t.status === "completed").length;
  const active = list.filter((t: any) => ["requested", "sent", "planned", "received"].includes(t.status)).length;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <h1 className="text-xl font-semibold tracking-tight">Transfer Record</h1>
        <p className="text-slate-400 text-sm mt-1">
          Every equipment move — who, from where to where, and when · {list.length} total
          {active ? ` · ${active} in progress` : ""}{completed ? ` · ${completed} completed` : ""}
        </p>
      </div>

      {list.length ? (
        <div className="space-y-3">
          {list.map((t: any, i: number) => {
            const st = T[t.status] ?? T.planned;
            const fromWarehouse = !t.from_event_id;
            const req = t.requested_quantity ?? t.quantity;
            const partial = ["sent", "received", "completed"].includes(t.status) && t.quantity < req;
            const handler = t.decided_by_name;
            return (
              <div key={t.id} className="card glass rounded-2xl p-4 reveal" style={{ animationDelay: `${0.1 + Math.min(i, 8) * 0.04}s` }}>
                <div className="flex items-start gap-3">
                  {/* direction avatar */}
                  <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 text-lg
                    ${fromWarehouse ? "bg-sky-500/15 text-sky-300" : "bg-fuchsia-500/15 text-fuchsia-300"}`}>
                    <span className="ms" style={{ fontSize: 22 }}>{fromWarehouse ? "warehouse" : "swap_horiz"}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* equipment + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">
                        {t.quantity}× {t.equipment_name ?? "equipment"}
                        {partial && <span className="ml-2 text-[11px] font-semibold text-amber-300">sent {t.quantity} of {req}</span>}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 shrink-0 ${st.cls}`}>
                        {(t.status === "sent" || t.status === "requested") && <span className={`h-1.5 w-1.5 rounded-full ${st.dot} dot-live`} />}
                        {st.label}
                      </span>
                    </div>

                    {/* route */}
                    <div className="text-sm text-slate-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{fromWarehouse ? "Warehouse" : (t.from_event_name ?? "—")}</span>
                      <span className="ms text-slate-500" style={{ fontSize: 16 }}>arrow_forward</span>
                      <span className="font-medium">{t.to_event_name ?? "—"}</span>
                    </div>

                    {/* responsables + when */}
                    <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
                      {t.requested_by_name && (
                        <span className="flex items-center gap-1"><span className="ms" style={{ fontSize: 13 }}>person</span>Asked by <span className="text-slate-400">{t.requested_by_name}</span></span>
                      )}
                      {handler && (
                        <span className="flex items-center gap-1">
                          <span className="ms" style={{ fontSize: 13 }}>{t.status === "refused" ? "block" : "local_shipping"}</span>
                          {t.status === "refused" ? "Refused by" : "Handled by"} <span className="text-slate-400">{handler}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1"><span className="ms" style={{ fontSize: 13 }}>event</span>{fmtDMY(t.received_at ?? t.decided_at ?? t.created_at)}</span>
                    </div>

                    {t.note && (
                      <div className="mt-2 text-xs text-slate-400 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-1.5 flex items-start gap-1.5">
                        <span className="ms text-slate-500" style={{ fontSize: 14 }}>sticky_note_2</span>{t.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card glass rounded-2xl px-5 py-12 text-center reveal" style={{ animationDelay: ".12s" }}>
          <span className="ms text-slate-600" style={{ fontSize: 40 }}>swap_horiz</span>
          <p className="text-sm text-slate-300 font-medium mt-2">No transfers yet.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When an event requests gear from another event or the warehouse, every move is recorded here.
          </p>
        </div>
      )}
    </div>
  );
}
