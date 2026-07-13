import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import TaskList from "./TaskList";

export default async function TasksPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const mine = profile.role === "technician";

  let query = supabase
    .from("tasks")
    .select("id,title,description,type,status,due_time,assigned_by,transfer_id, events(name), assignee:app_users!tasks_assigned_to_fkey(full_name), transfers(requested_quantity,quantity,status,equipment_name,from_event_name,to_event_name)")
    .order("due_time", { ascending: true });
  if (mine) query = query.eq("assigned_to", profile.id);

  const { data } = await query;
  const isAdmin = profile.role === "admin";
  const tasks = (data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    eventName: t.events?.name ?? null,
    assigneeName: t.assignee?.full_name ?? null,
    dueTime: t.due_time,
    // can the viewer edit/cancel this task? only its creator (or an admin)
    canManage: isAdmin || t.assigned_by === profile.id,
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
    <div className="max-w-4xl space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <h1 className="text-3xl font-extrabold tracking-tight">{mine ? "My tasks" : "Tasks"}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {mine
            ? "Jobs assigned to you by the Engineer — start them and mark them done."
            : "Jobs the Engineer assigns to technicians (split/distribute gear, transfer tasks)."} · {tasks.length} total
        </p>
      </div>

      <TaskList tasks={tasks} canAct={mine} showAssignee={!mine} />
    </div>
  );
}
