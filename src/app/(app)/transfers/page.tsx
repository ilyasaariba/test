import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { fmtDMY } from "@/lib/ui";
import { isAged } from "@/lib/historyWindow";
import PageHeader from "@/components/PageHeader";

const T: Record<string, { label: string; cls: string; dot: string }> = {
  requested: { label: "Requested", cls: "pill-accent", dot: "bg-fuchsia-400" },
  planned: { label: "Planned", cls: "pill-warn", dot: "bg-amber-400" },
  sent: { label: "In transit", cls: "pill-info", dot: "bg-sky-400" },
  received: { label: "Received", cls: "pill-teal", dot: "bg-teal-400" },
  completed: { label: "Completed", cls: "pill-good", dot: "bg-emerald-400" },
  refused: { label: "Refused", cls: "pill-crit", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", cls: "pill-neutral", dot: "bg-slate-400" },
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="glass rounded-xl px-4 py-3">
      <div className={`text-[22px] font-bold num ${tone}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
    </div>
  );
}

// One transfer, shown inside its destination-event group (so the route only
// needs to name the source — the destination is the group title).
function TransferRow({ t }: { t: any }) {
  const st = T[t.status] ?? T.planned;
  const fromWarehouse = !t.from_event_id;
  const req = t.requested_quantity ?? t.quantity;
  const shipped = ["sent", "received", "completed"].includes(t.status);
  const arrived = t.status === "completed";
  const refusedT = t.status === "refused";
  const cancelledT = t.status === "cancelled";
  const movedQty = t.quantity ?? req;
  const recvQty = t.received_quantity ?? movedQty;
  const partial = shipped && movedQty < req;

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${fromWarehouse ? "bg-sky-500/15 text-sky-300" : "bg-fuchsia-500/15 text-fuchsia-300"}`}>
          <span className="ms" style={{ fontSize: 22 }}>{fromWarehouse ? "warehouse" : "swap_horiz"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold">{req}× {t.equipment_name ?? "equipment"}</div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 shrink-0 ${st.cls}`}>
              {(t.status === "sent" || t.status === "requested") && <span className={`h-1.5 w-1.5 rounded-full ${st.dot} dot-live`} />}
              {st.label}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span className="ms text-slate-500" style={{ fontSize: 14 }}>input</span>
            from <span className="font-medium text-slate-300">{fromWarehouse ? "Warehouse" : (t.from_event_name ?? "—")}</span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row gap-3 sm:gap-2">
        <Step done icon="edit_note" title="Requested"
          lines={[t.requested_by_name ? `by ${t.requested_by_name}` : null, `${req}× asked`, fmtDMY(t.created_at)]}
          tone="bg-fuchsia-500/15 text-fuchsia-300" />
        {refusedT ? (
          <Step done icon="block" title="Refused"
            lines={[t.decided_by_name ? `by ${t.decided_by_name}` : null, fmtDMY(t.decided_at)]}
            tone="bg-rose-500/15 text-rose-300" />
        ) : cancelledT ? (
          <Step done icon="cancel" title="Cancelled" lines={[fmtDMY(t.decided_at ?? t.created_at)]}
            tone="bg-slate-500/15 text-slate-300" />
        ) : (
          <Step done={shipped} icon="local_shipping" title="Shipped"
            lines={[t.decided_by_name ? `by ${t.decided_by_name}` : null, shipped ? `${movedQty}× sent${partial ? ` of ${req}` : ""}` : null, shipped ? fmtDMY(t.decided_at) : "pending"]}
            tone="bg-sky-500/15 text-sky-300" />
        )}
        {!refusedT && !cancelledT && (
          <Step done={arrived} icon="check_circle" title="Arrived"
            lines={[arrived ? `${recvQty}× received` : null, arrived ? fmtDMY(t.received_at) : "awaiting confirmation"]}
            tone="bg-emerald-500/15 text-emerald-300" />
        )}
      </div>

      {t.note && (
        <div className="mt-3 text-xs text-slate-400 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2 flex items-start gap-1.5">
          <span className="ms text-slate-500" style={{ fontSize: 14 }}>sticky_note_2</span>{t.note}
        </div>
      )}
    </div>
  );
}

// One node of the requested → shipped → arrived timeline.
function Step({ done, active, icon, title, lines, tone = "" }: {
  done: boolean; active?: boolean; icon: string; title: string; lines: (string | null)[]; tone?: string;
}) {
  return (
    <div className="flex-1 flex gap-2.5 min-w-0">
      <div className="flex flex-col items-center">
        <div className={`h-7 w-7 rounded-full grid place-items-center shrink-0 ring-1 ${done ? `${tone || "bg-[var(--accent-soft)] text-[var(--accent-hex)]"} ring-transparent` : "bg-white/5 text-slate-600 ring-white/10"}`}>
          <span className="ms" style={{ fontSize: 15 }}>{done ? icon : "circle"}</span>
        </div>
      </div>
      <div className="min-w-0 pt-0.5">
        <div className={`text-xs font-bold ${done ? "" : "text-slate-600"}`}>{title}</div>
        {lines.filter(Boolean).map((l, i) => (
          <div key={i} className={`text-[11px] mt-0.5 ${done ? "text-slate-400" : "text-slate-600"}`}>{l}</div>
        ))}
      </div>
    </div>
  );
}

export default async function TransferRecordPage() {
  const profile = await getProfile();
  if (!["engineer", "admin", "boss"].includes(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: transfers } = await supabase
    .from("transfers")
    .select("id,quantity,requested_quantity,received_quantity,status,from_event_id,from_event_name,to_event_name,equipment_name,requested_by_name,decided_by_name,created_at,decided_at,received_at,note")
    .order("created_at", { ascending: false });
  // Transfers that finished (delivered/refused/cancelled) more than 24h ago live
  // in History now — keep only active + recently-finished ones on the record.
  const list = (transfers ?? []).filter((t: any) => {
    if (t.status === "completed") return !isAged(t.received_at);
    if (t.status === "refused" || t.status === "cancelled") return !isAged(t.decided_at);
    return true;
  });

  const completed = list.filter((t: any) => t.status === "completed").length;
  const active = list.filter((t: any) => ["requested", "sent", "planned", "received"].includes(t.status)).length;
  const refused = list.filter((t: any) => ["refused", "cancelled"].includes(t.status)).length;

  // Group every move by the event it's going TO, so the page collapses to a list
  // of event titles you expand for the detail (list is already newest-first).
  const groupsMap = new Map<string, any[]>();
  for (const t of list) {
    const key = t.to_event_name ?? "—";
    const arr = groupsMap.get(key) ?? [];
    arr.push(t);
    groupsMap.set(key, arr);
  }
  const groups = [...groupsMap.entries()].map(([eventName, items]) => ({
    eventName,
    items,
    active: items.filter((t) => ["requested", "sent", "planned", "received"].includes(t.status)).length,
    done: items.filter((t) => t.status === "completed").length,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <PageHeader
          icon="swap_horiz"
          title="Transfer Record"
          sub="Every equipment move — who asked, who shipped, from where to where, and when."
        />
      </div>

      {list.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 reveal" style={{ animationDelay: ".1s" }}>
          <Stat label="Total" value={list.length} tone="" />
          <Stat label="In progress" value={active} tone="text-sky-300" />
          <Stat label="Completed" value={completed} tone="text-emerald-300" />
          <Stat label="Refused" value={refused} tone="text-rose-300" />
        </div>
      )}

      {list.length ? (
        <div className="space-y-3">
          {groups.map((g) => (
            <details key={g.eventName} className="card glass rounded-2xl overflow-hidden reveal">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface2)] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-hex)] grid place-items-center shrink-0">
                    <span className="ms" style={{ fontSize: 20 }}>event</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{g.eventName}</div>
                    <div className="text-xs text-slate-500">
                      {g.items.length} move{g.items.length === 1 ? "" : "s"}
                      {g.active ? ` · ${g.active} in progress` : ""}{g.done ? ` · ${g.done} done` : ""}
                    </div>
                  </div>
                </div>
                <span className="ms acc-chevron text-slate-400 transition-transform shrink-0" style={{ fontSize: 22 }}>expand_more</span>
              </summary>
              <div className="border-t border-white/10 divide-y divide-white/5">
                {g.items.map((t: any) => <TransferRow key={t.id} t={t} />)}
              </div>
            </details>
          ))}
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
