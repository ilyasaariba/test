import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isAged, agedCutoffISO } from "@/lib/historyWindow";
import { fmtDMY } from "@/lib/ui";
import TaskList from "./TaskList";
import PageHeader from "@/components/PageHeader";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const profile = await getProfile();
  // Tasks are a technician workspace (transfer prep & shipping jobs land here).
  // Managers coordinate by phone / the Transfer Record — no tasks page for them.
  if (profile.role !== "technician") redirect("/dashboard");
  const supabase = await createClient();
  const showHistory = view === "history";

  /* ================= HISTORY: tasks done 24h+ ago, kept forever ================= */
  if (showHistory) {
    let hq = supabase
      .from("tasks")
      .select("id,title,description,type,status,due_time,done_at, events(name), assignee:app_users!tasks_assigned_to_fkey(full_name), transfers(quantity,requested_quantity,equipment_name,from_event_name,to_event_name)")
      .eq("status", "done").lte("done_at", agedCutoffISO())
      .order("done_at", { ascending: false });
    hq = hq.eq("assigned_to", profile.id);
    const { data } = await hq;
    const old = data ?? [];

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="reveal" style={{ animationDelay: ".06s" }}>
          <PageHeader
            icon="history"
            title="Tasks history"
            sub={`${old.length} completed task${old.length === 1 ? "" : "s"} — click one for its details`}
            action={
              <Link href="/tasks" className="glass rounded-xl px-3.5 py-2 text-sm font-semibold flex items-center gap-1.5 hover:bg-[var(--surface2)] transition">
                <span className="ms" style={{ fontSize: 18 }}>arrow_back</span> Current tasks
              </Link>
            }
          />
        </div>

        <div className="card glass rounded-2xl divide-y divide-white/5 reveal" style={{ animationDelay: ".12s" }}>
          {old.length ? old.map((t: any) => (
            <details key={t.id} className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden row flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${t.type === "transfer" ? "bg-fuchsia-500/15 text-fuchsia-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                    <span className="ms" style={{ fontSize: 18 }}>{t.type === "transfer" ? "swap_horiz" : "task_alt"}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.title}</div>
                    <div className="text-xs text-slate-500 truncate">{t.events?.name ?? "—"} · done {fmtDMY(t.done_at)}</div>
                  </div>
                </div>
                <span className="ms acc-chevron text-slate-500 transition-transform shrink-0" style={{ fontSize: 20 }}>expand_more</span>
              </summary>
              <div className="px-5 pb-4 pl-[68px] space-y-1.5">
                {t.description && <p className="text-sm text-slate-300">{t.description}</p>}
                {t.transfers && (
                  <p className="text-xs text-slate-400">
                    {t.transfers.requested_quantity ?? t.transfers.quantity}× {t.transfers.equipment_name} · {t.transfers.from_event_name} → {t.transfers.to_event_name}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  due {fmtDMY(t.due_time)} · completed {fmtDMY(t.done_at)}
                </p>
              </div>
            </details>
          )) : (
            <p className="px-5 py-10 text-sm text-slate-400 text-center">
              No archived tasks yet. Tasks move here 24 hours after they're done.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ================= CURRENT ================= */
  let query = supabase
    .from("tasks")
    .select("id,title,description,type,status,due_time,done_at,assigned_by,transfer_id, events(name), assignee:app_users!tasks_assigned_to_fkey(full_name), transfers(requested_quantity,quantity,status,equipment_name,from_event_name,to_event_name)")
    .order("due_time", { ascending: true });
  query = query.eq("assigned_to", profile.id);

  const { data } = await query;
  // Tasks done more than 24h ago have moved to History — drop them from the page.
  const tasks = (data ?? []).filter((t: any) => !(t.status === "done" && isAged(t.done_at))).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    eventName: t.events?.name ?? null,
    assigneeName: t.assignee?.full_name ?? null,
    dueTime: t.due_time,
    // can the viewer edit/cancel this task? only its creator
    canManage: t.assigned_by === profile.id,
    transferId: t.transfer_id ?? null,
    transfer: t.transfers ? {
      status: t.transfers.status,
      requestedQty: t.transfers.requested_quantity ?? t.transfers.quantity ?? 1,
      equipmentName: t.transfers.equipment_name ?? "gear",
      fromName: t.transfers.from_event_name ?? "an event",
      toName: t.transfers.to_event_name ?? "an event",
    } : null,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <PageHeader
          icon="task_alt"
          title="My tasks"
          sub={<>Jobs assigned to you — transfer shipments and on-site work. · {tasks.length} total</>}
          action={
            <Link href="/tasks?view=history" title="Tasks history"
              className="glass rounded-xl px-3.5 py-2 text-sm font-semibold flex items-center gap-1.5 hover:bg-[var(--surface2)] transition">
              <span className="ms" style={{ fontSize: 18 }}>history</span> History
            </Link>
          }
        />
      </div>

      <TaskList tasks={tasks} canAct showAssignee={false} />
    </div>
  );
}
