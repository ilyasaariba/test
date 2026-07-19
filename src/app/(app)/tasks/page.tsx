import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isAged } from "@/lib/historyWindow";
import TaskList from "./TaskList";
import PageHeader from "@/components/PageHeader";

export default async function TasksPage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const mine = profile.role === "technician";

  let query = supabase
    .from("tasks")
    .select("id,title,description,type,status,due_time,done_at,assigned_by,transfer_id, events(name), assignee:app_users!tasks_assigned_to_fkey(full_name), transfers(requested_quantity,quantity,status,equipment_name,from_event_name,to_event_name)")
    .order("due_time", { ascending: true });
  if (mine) query = query.eq("assigned_to", profile.id);
  // Managers (engineer/admin) track transfers on the Transfer Record page, not here —
  // only the technician who has to carry one out sees it as a task.
  else query = query.neq("type", "transfer");

  const { data } = await query;
  const isAdmin = profile.role === "admin";
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
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <PageHeader
          icon="task_alt"
          title={mine ? "My tasks" : "Tasks"}
          sub={<>{mine
            ? "Jobs assigned to you by the Engineer — start them and mark them done."
            : "Jobs the Engineer assigns to technicians on site. Transfers live on the Transfer Record."} · {tasks.length} total</>}
        />
      </div>

      <TaskList tasks={tasks} canAct={mine} showAssignee={!mine} />
    </div>
  );
}
