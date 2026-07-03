"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageEvent } from "@/lib/eventPerm";

const EDITABLE = ["draft", "sent_to_warehouse", "prepared"];
const CLOSED = ["archived", "cancelled"];

type SB = Awaited<ReturnType<typeof createClient>>;
type Ctx =
  | { error: string }
  | { supabase: SB; profileId: string; status: string; eventName: string };

async function guard(eventId: string): Promise<Ctx> {
  const profile = await getProfile();
  const supabase = await createClient();
  if (!(await canManageEvent(supabase, eventId, profile))) return { error: "Not allowed." };
  const { data: ev } = await supabase.from("events").select("status,name").eq("id", eventId).single();
  if (!ev) return { error: "Event not found." };
  if (!EDITABLE.includes(ev.status)) return { error: "This event is locked at its current stage." };
  return { supabase, profileId: profile.id, status: ev.status, eventName: ev.name };
}

// When the list changes AFTER it's been sent to the warehouse, let the WM know what changed.
async function notifyWmOfChange(g: { supabase: SB; status: string; eventName: string }, eventId: string, change: string) {
  if (g.status !== "sent_to_warehouse" && g.status !== "prepared") return;
  const { data: wms } = await g.supabase.from("app_users").select("id").eq("role", "warehouse_manager").eq("is_active", true);
  if (wms?.length) {
    await g.supabase.from("notifications").insert(wms.map((w: any) => ({
      user_id: w.id, type: "event", title: "Equipment list changed",
      body: `${g.eventName}: ${change}`, event_id: eventId, is_read: false,
    })));
  }
}

async function equipName(sb: SB, equipmentId: string) {
  const { data } = await sb.from("equipment").select("name").eq("id", equipmentId).single();
  return data?.name ?? "an item";
}
async function lineEquipName(sb: SB, lineId: string) {
  const { data } = await sb.from("event_equipment").select("equipment(name)").eq("id", lineId).single();
  return (data as any)?.equipment?.name ?? "an item";
}

export async function addLine(eventId: string, equipmentId: string, quantity: number) {
  const g = await guard(eventId); if ("error" in g) return g;
  const qty = Math.max(1, quantity);
  const { data: av } = await g.supabase.from("equipment_availability").select("available").eq("equipment_id", equipmentId).single();
  const available = Math.max(0, av?.available ?? 0);
  const { data: line, error } = await g.supabase
    .from("event_equipment").insert({ event_id: eventId, equipment_id: equipmentId, quantity: qty })
    .select("id").single();
  if (error || !line) return { error: error?.message ?? "Could not add equipment." };
  const wh = Math.min(qty, available);
  if (wh > 0) await g.supabase.from("equipment_allocations").insert({ event_equipment_id: line.id, source: "warehouse", quantity: wh });
  await notifyWmOfChange(g, eventId, `added ${qty}× ${await equipName(g.supabase, equipmentId)}`);
  revalidatePath(`/events/${eventId}`);
}

export async function setLineQty(eventId: string, lineId: string, quantity: number) {
  const g = await guard(eventId); if ("error" in g) return g;
  if (quantity < 1) return { error: "Quantity must be at least 1." };
  const name = await lineEquipName(g.supabase, lineId);
  await g.supabase.from("event_equipment").update({ quantity }).eq("id", lineId);
  await notifyWmOfChange(g, eventId, `${name} quantity changed to ${quantity}`);
  revalidatePath(`/events/${eventId}`);
}

export async function removeLine(eventId: string, lineId: string) {
  const g = await guard(eventId); if ("error" in g) return g;
  const name = await lineEquipName(g.supabase, lineId);
  await g.supabase.from("event_equipment").delete().eq("id", lineId); // cascades allocations
  await notifyWmOfChange(g, eventId, `removed ${name}`);
  revalidatePath(`/events/${eventId}`);
}

export async function addWarehouseSource(eventId: string, lineId: string, quantity: number) {
  const g = await guard(eventId); if ("error" in g) return g;
  if (quantity < 1) return { error: "Quantity must be at least 1." };
  await g.supabase.from("equipment_allocations").insert({ event_equipment_id: lineId, source: "warehouse", quantity });
  revalidatePath(`/events/${eventId}`);
}

export async function addRentalSource(
  eventId: string, lineId: string, equipmentId: string, lender: string, quantity: number, dueBack: string | null,
) {
  const g = await guard(eventId); if ("error" in g) return g;
  if (!lender.trim() || quantity < 1) return { error: "Lender and quantity are required." };
  const { data: rental, error } = await g.supabase
    .from("rentals").insert({ event_id: eventId, equipment_id: equipmentId, lender_name: lender.trim(), quantity, due_back: dueBack || null })
    .select("id").single();
  if (error || !rental) return { error: error?.message ?? "Could not add rental." };
  await g.supabase.from("equipment_allocations").insert({ event_equipment_id: lineId, source: "rental", quantity, rental_id: rental.id });
  revalidatePath(`/events/${eventId}`);
}

export async function addTransferSource(
  eventId: string, lineId: string, equipmentId: string, fromEventId: string, quantity: number,
) {
  const g = await guard(eventId); if ("error" in g) return g;
  if (!fromEventId || quantity < 1) return { error: "Source event and quantity are required." };
  if (fromEventId === eventId) return { error: "Pick a different source event." };
  const { data: transfer, error } = await g.supabase
    .from("transfers")
    .insert({ from_event_id: fromEventId, to_event_id: eventId, equipment_id: equipmentId, quantity, status: "planned", created_by: g.profileId })
    .select("id").single();
  if (error || !transfer) return { error: error?.message ?? "Could not set up transfer." };
  await g.supabase.from("equipment_allocations").insert({ event_equipment_id: lineId, source: "transfer", quantity, transfer_id: transfer.id });
  revalidatePath(`/events/${eventId}`);
}

export async function removeSource(eventId: string, allocationId: string) {
  const g = await guard(eventId); if ("error" in g) return g;
  const { data: a } = await g.supabase
    .from("equipment_allocations").select("id, rental_id, transfer_id").eq("id", allocationId).single();
  await g.supabase.from("equipment_allocations").delete().eq("id", allocationId);
  if (a?.rental_id) await g.supabase.from("rentals").delete().eq("id", a.rental_id);
  if (a?.transfer_id) await g.supabase.from("transfers").delete().eq("id", a.transfer_id);
  revalidatePath(`/events/${eventId}`);
}

/* ------------------------------------------------------------------ */
/* Crew & tasks — engineer assigns technicians and gives them jobs.    */
/* Allowed on any event that isn't archived/cancelled (wider than the  */
/* sourcing lock — you still manage crew after gear is prepared/shipped).*/
/* ------------------------------------------------------------------ */

async function guardCrew(eventId: string): Promise<Ctx> {
  const profile = await getProfile();
  const supabase = await createClient();
  if (!(await canManageEvent(supabase, eventId, profile))) return { error: "Not allowed." };
  const { data: ev } = await supabase.from("events").select("status,name").eq("id", eventId).single();
  if (!ev) return { error: "Event not found." };
  if (CLOSED.includes(ev.status)) return { error: "This event is closed." };
  return { supabase, profileId: profile.id, status: ev.status, eventName: ev.name };
}

/* ---- Delegate / revoke "event lead" — give an assigned crew member engineer-level
        authority for this one event (so they can run it when the engineer is busy). ---- */
export async function setEventLead(eventId: string, userId: string, makeLead: boolean) {
  const g = await guardCrew(eventId); if ("error" in g) return g;
  const { data: row } = await g.supabase
    .from("event_technicians").select("user_id").eq("event_id", eventId).eq("user_id", userId).maybeSingle();
  if (!row) return { error: "Assign them to the event first." };
  const { error } = await g.supabase
    .from("event_technicians").update({ is_lead: makeLead }).eq("event_id", eventId).eq("user_id", userId);
  if (error) return { error: error.message };
  await g.supabase.from("notifications").insert({
    user_id: userId, type: "event",
    title: makeLead ? "You're now the event lead" : "Event lead access removed",
    body: makeLead
      ? `${g.eventName}: you can now run this event like the engineer.`
      : `${g.eventName}: your event-lead access was removed.`,
    event_id: eventId, is_read: false,
  });
  revalidatePath(`/events/${eventId}`);
}

export async function assignTechnician(eventId: string, userId: string) {
  const g = await guardCrew(eventId); if ("error" in g) return g;
  if (!userId) return { error: "Pick a technician." };
  const { error } = await g.supabase.from("event_technicians").insert({ event_id: eventId, user_id: userId });
  if (error && !/duplicate/i.test(error.message)) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
}

export async function unassignTechnician(eventId: string, userId: string) {
  const g = await guardCrew(eventId); if ("error" in g) return g;
  await g.supabase.from("event_technicians").delete().eq("event_id", eventId).eq("user_id", userId);
  revalidatePath(`/events/${eventId}`);
}

export async function createTechnician(
  eventId: string, fullName: string, username: string, password: string,
) {
  const g = await guardCrew(eventId); if ("error" in g) return g;
  const u = username.trim().toLowerCase();
  if (!fullName.trim()) return { error: "Full name is required." };
  if (!/^[a-z0-9_.]{3,}$/.test(u)) return { error: "Username: 3+ chars, letters/numbers/dot/underscore only." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${u}@avlogistics.local`,
    password,
    email_confirm: true,
    user_metadata: { username: u, full_name: fullName.trim(), role: "technician" },
  });
  if (error || !data.user) {
    const msg = /already|exists|registered/i.test(error?.message ?? "")
      ? "That username is already taken." : (error?.message ?? "Could not create the account.");
    return { error: msg };
  }
  // The handle_new_user trigger creates the app_users row from metadata; stamp the creator and assign.
  await admin.from("app_users").update({ created_by: g.profileId }).eq("id", data.user.id);
  await g.supabase.from("event_technicians").insert({ event_id: eventId, user_id: data.user.id });
  revalidatePath(`/events/${eventId}`);
}

export async function createTask(
  eventId: string, assignedTo: string, title: string, description: string, dueDate: string | null,
) {
  const g = await guardCrew(eventId); if ("error" in g) return g;
  if (!assignedTo) return { error: "Pick a technician." };
  if (!title.trim()) return { error: "Task title is required." };
  const { error } = await g.supabase.from("tasks").insert({
    type: "generic",
    title: title.trim(),
    description: description.trim() || null,
    event_id: eventId,
    assigned_to: assignedTo,
    assigned_by: g.profileId,
    due_time: dueDate || null,
    status: "pending",
  });
  if (error) return { error: error.message };
  // Ping the technician so it shows in their notifications.
  await g.supabase.from("notifications").insert({
    user_id: assignedTo, type: "task", title: "New task assigned",
    body: title.trim(), event_id: eventId, is_read: false,
  });
  revalidatePath(`/events/${eventId}`);
}

export async function removeTask(eventId: string, taskId: string) {
  const g = await guardCrew(eventId); if ("error" in g) return g;
  await g.supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath(`/events/${eventId}`);
}
