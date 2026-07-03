"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isEventLead } from "@/lib/eventPerm";

// Technician advances their own task one step. Transfer tasks also move the linked
// transfer record (planned → sent → completed) so the engineer's view stays in sync.
export async function advanceTask(taskId: string) {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("id,type,status,assigned_to,assigned_by,transfer_id,title,event_id")
    .eq("id", taskId)
    .single();
  if (!task) return { error: "Task not found." };
  if (task.assigned_to !== profile.id && profile.role !== "admin") {
    return { error: "This task isn't assigned to you." };
  }

  let next: string | null = null;
  let transferStatus: string | null = null;
  if (task.type === "transfer") {
    if (task.status === "pending") { next = "sent"; transferStatus = "sent"; }
    else if (task.status === "sent") { next = "done"; transferStatus = "completed"; }
  } else {
    if (task.status === "pending") next = "in_progress";
    else if (task.status === "in_progress") next = "done";
  }
  if (!next) return { error: "This task is already complete." };

  const { error } = await supabase
    .from("tasks")
    .update({ status: next, done_at: next === "done" ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return { error: error.message };

  if (transferStatus && task.transfer_id) {
    await supabase.from("transfers").update({ status: transferStatus }).eq("id", task.transfer_id);
  }

  // Keep the engineer who assigned it in the loop.
  if (task.assigned_by) {
    const verb = next === "done" ? "completed" : next === "sent" ? "picked up (in transit)" : "started";
    await supabase.from("notifications").insert({
      user_id: task.assigned_by, type: "task",
      title: `Task ${verb}`, body: `${profile.full_name}: ${task.title}`,
      event_id: task.event_id, is_read: false,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.event_id) revalidatePath(`/events/${task.event_id}`);
}

// Only the person who created (assigned) the task — or an admin — may edit/cancel it.
type SB = Awaited<ReturnType<typeof createClient>>;
type TaskRow = { id: string; assigned_by: string | null; assigned_to: string | null; event_id: string | null; status: string; title: string };
type TaskCtx = { error: string } | { supabase: SB; task: TaskRow };

async function ownTask(taskId: string): Promise<TaskCtx> {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks").select("id,assigned_by,assigned_to,event_id,status,title").eq("id", taskId).single();
  if (!task) return { error: "Task not found." };
  const privileged = task.assigned_by === profile.id
    || profile.role === "admin"
    || (!!task.event_id && await isEventLead(supabase, task.event_id, profile.id));
  if (!privileged) {
    return { error: "Only the person who created this task (or the event lead) can change it." };
  }
  return { supabase, task };
}

export async function editTask(
  taskId: string, title: string, description: string, dueDate: string | null,
): Promise<{ error: string } | void> {
  const o = await ownTask(taskId); if ("error" in o) return o;
  if (!title.trim()) return { error: "Task title is required." };
  if (o.task.status === "cancelled" || o.task.status === "done") return { error: "This task is closed." };
  const { error } = await o.supabase.from("tasks").update({
    title: title.trim(), description: description.trim() || null, due_time: dueDate || null,
  }).eq("id", taskId);
  if (error) return { error: error.message };

  if (o.task.assigned_to) {
    await o.supabase.from("notifications").insert({
      user_id: o.task.assigned_to, type: "task", title: "Task updated",
      body: title.trim(), event_id: o.task.event_id, is_read: false,
    });
  }
  revalidatePath("/tasks");
  if (o.task.event_id) revalidatePath(`/events/${o.task.event_id}`);
}

export async function cancelTask(taskId: string): Promise<{ error: string } | void> {
  const o = await ownTask(taskId); if ("error" in o) return o;
  if (o.task.status === "cancelled") return { error: "Already cancelled." };
  if (o.task.status === "done") return { error: "This task is already done." };
  const { error } = await o.supabase.from("tasks").update({ status: "cancelled" }).eq("id", taskId);
  if (error) return { error: error.message };

  if (o.task.assigned_to) {
    await o.supabase.from("notifications").insert({
      user_id: o.task.assigned_to, type: "task", title: "Task cancelled",
      body: o.task.title, event_id: o.task.event_id, is_read: false,
    });
  }
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (o.task.event_id) revalidatePath(`/events/${o.task.event_id}`);
}
