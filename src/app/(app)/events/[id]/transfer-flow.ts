"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/eventPerm";
import { isKnownDriver } from "@/lib/drivers";

type SB = Awaited<ReturnType<typeof createClient>>;

/* ---------- shared helpers ---------- */

// Notify an event's owner + any leads.
async function notifyManagers(sb: SB, eventId: string | null, title: string, body: string) {
  if (!eventId) return;
  const [{ data: ev }, { data: leads }] = await Promise.all([
    sb.from("events").select("created_by").eq("id", eventId).single(),
    sb.from("event_technicians").select("user_id").eq("event_id", eventId).eq("is_lead", true),
  ]);
  const ids = new Set<string>();
  if (ev?.created_by) ids.add(ev.created_by);
  for (const l of leads ?? []) ids.add(l.user_id);
  if (ids.size) {
    await sb.from("notifications").insert([...ids].map((uid) => ({
      user_id: uid, type: "transfer", title, body, event_id: eventId, is_read: false,
    })));
  }
}

async function notifyWarehouse(sb: SB, eventId: string | null, title: string, body: string) {
  const { data: wms } = await sb.from("app_users").select("id").eq("role", "warehouse_manager").eq("is_active", true);
  if (wms?.length) {
    await sb.from("notifications").insert(wms.map((w: any) => ({
      user_id: w.id, type: "transfer", title, body, event_id: eventId, is_read: false,
    })));
  }
}

function touch(toEventId: string | null, fromEventId: string | null) {
  if (toEventId) revalidatePath(`/events/${toEventId}`);
  if (fromEventId) revalidatePath(`/events/${fromEventId}`);
  revalidatePath("/transfers");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/requests");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

// Find the requesting event's line for this item, bumping its needed qty (mid-event top-up
// = the event genuinely needs more). Creates the line if the event didn't list the item.
async function ensureLine(sb: SB, eventId: string, equipmentId: string, addNeed: number): Promise<string | null> {
  const { data: existing } = await sb.from("event_equipment")
    .select("id,quantity").eq("event_id", eventId).eq("equipment_id", equipmentId).limit(1).maybeSingle();
  if (existing) {
    if (addNeed > 0) await sb.from("event_equipment").update({ quantity: (existing.quantity ?? 0) + addNeed }).eq("id", existing.id);
    return existing.id;
  }
  const { data: created } = await sb.from("event_equipment")
    .insert({ event_id: eventId, equipment_id: equipmentId, quantity: Math.max(1, addNeed) }).select("id").single();
  return created?.id ?? null;
}

// Free up to `qty` warehouse units the source event A still holds for this item.
// Returns the number actually freed (so we can move exactly that many to B).
async function shrinkWarehouseAt(sb: SB, fromEventId: string, equipmentId: string, qty: number): Promise<number> {
  const { data: aLines } = await sb.from("event_equipment")
    .select("id, equipment_allocations(id,source,quantity,returned_quantity)")
    .eq("event_id", fromEventId).eq("equipment_id", equipmentId);
  const whAllocs: { id: string; quantity: number; returned_quantity: number }[] = [];
  for (const l of aLines ?? []) {
    for (const a of (l as any).equipment_allocations ?? []) {
      if (a.source === "warehouse") whAllocs.push({ id: a.id, quantity: a.quantity ?? 0, returned_quantity: a.returned_quantity ?? 0 });
    }
  }
  const held = whAllocs.reduce((s, a) => s + Math.max(0, a.quantity - a.returned_quantity), 0);
  const move = Math.min(qty, held);
  let remaining = move;
  for (const a of whAllocs) {
    if (remaining <= 0) break;
    const avail = Math.max(0, a.quantity - a.returned_quantity);
    const take = Math.min(avail, remaining);
    const nextQty = a.quantity - take;
    if (nextQty <= a.returned_quantity) {
      if (a.returned_quantity === 0) await sb.from("equipment_allocations").delete().eq("id", a.id);
      else await sb.from("equipment_allocations").update({ quantity: a.returned_quantity }).eq("id", a.id);
    } else {
      await sb.from("equipment_allocations").update({ quantity: nextQty }).eq("id", a.id);
    }
    remaining -= take;
  }
  return move;
}

// Read-only: how many warehouse units the event still holds for this item (what it can lend).
async function heldWarehouseAt(sb: SB, eventId: string, equipmentId: string): Promise<number> {
  const { data: aLines } = await sb.from("event_equipment")
    .select("equipment_allocations(source,quantity,returned_quantity)")
    .eq("event_id", eventId).eq("equipment_id", equipmentId);
  let held = 0;
  for (const l of aLines ?? []) {
    for (const a of (l as any).equipment_allocations ?? []) {
      if (a.source === "warehouse") held += Math.max(0, (a.quantity ?? 0) - (a.returned_quantity ?? 0));
    }
  }
  return held;
}

async function assignedTechOf(sb: SB, transferId: string) {
  const { data: task } = await sb.from("tasks")
    .select("id,assigned_to,assigned_by,event_id").eq("transfer_id", transferId).limit(1).maybeSingle();
  return task ?? null;
}

/* ---------- B requests gear from ONE OR MORE sources (available in every state) ---------- */

type ReqAlloc = {
  sourceType: "warehouse" | "event";
  fromEventId?: string | null;   // event sources only
  quantity: number;
  assignedTo?: string | null;    // event sources only — must be on that event's crew
};
type ReqItem = { equipmentId: string; totalNeeded: number; allocations: ReqAlloc[] };

// One submission can cover SEVERAL equipment items, and each item's need can be split
// across the warehouse + several events. Every event portion becomes a transfer + a task
// for the assigned crew tech; warehouse portions go to the WM. Quantities are validated
// against what each source actually holds, and techs against the source event's crew.
export async function requestEquipment(
  toEventId: string, items: ReqItem[],
): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, toEventId, profile))) return { error: "Not allowed." };

  const list = (items ?? [])
    .map((it) => ({ ...it, allocations: (it.allocations ?? []).filter((a) => (a.quantity ?? 0) > 0) }))
    .filter((it) => it.equipmentId && it.totalNeeded >= 1 && it.allocations.length);
  if (!list.length) return { error: "Add at least one equipment item, allocated from a source." };

  const { data: toEv } = await sb.from("events").select("name").eq("id", toEventId).single();

  // Validate everything BEFORE writing anything.
  for (const it of list) {
    const sum = it.allocations.reduce((s, a) => s + a.quantity, 0);
    if (sum > it.totalNeeded) return { error: "One of the items has more allocated than needed." };
    for (const a of it.allocations) {
      if (a.sourceType !== "event") continue;
      if (!a.fromEventId) return { error: "Missing source event." };
      if (a.fromEventId === toEventId) return { error: "Can't borrow from the same event." };
      if (!a.assignedTo) return { error: "Assign a technician for each event you borrow from." };
      const { data: crew } = await sb.from("event_technicians")
        .select("user_id").eq("event_id", a.fromEventId).eq("user_id", a.assignedTo).limit(1).maybeSingle();
      if (!crew) return { error: "The technician must be on the source event's crew." };
      const held = await heldWarehouseAt(sb, a.fromEventId, it.equipmentId);
      if (a.quantity > held) {
        const { data: fe } = await sb.from("events").select("name").eq("id", a.fromEventId).single();
        return { error: `${fe?.name ?? "That event"} only has ${held}× to lend — request the rest elsewhere.` };
      }
    }
  }

  const warehouseNotes: string[] = [];
  const sourceEventIds = new Set<string>();

  for (const it of list) {
    const { data: eq } = await sb.from("equipment").select("name").eq("id", it.equipmentId).single();
    const toLineId = await ensureLine(sb, toEventId, it.equipmentId, it.totalNeeded);
    for (const a of it.allocations) {
      if (a.sourceType === "warehouse") {
        await sb.from("transfers").insert({
          from_event_id: null, to_event_id: toEventId, equipment_id: it.equipmentId,
          quantity: a.quantity, requested_quantity: a.quantity, status: "requested", created_by: profile.id, to_line_id: toLineId,
          equipment_name: eq?.name ?? null, from_event_name: "Warehouse", to_event_name: toEv?.name ?? null,
          requested_by_name: profile.full_name,
        });
        warehouseNotes.push(`${a.quantity}× ${eq?.name ?? "gear"}`);
      } else {
        const { data: fromEv } = await sb.from("events").select("name").eq("id", a.fromEventId!).single();
        const { data: inserted } = await sb.from("transfers").insert({
          from_event_id: a.fromEventId, to_event_id: toEventId, equipment_id: it.equipmentId,
          quantity: a.quantity, requested_quantity: a.quantity, status: "requested", created_by: profile.id, to_line_id: toLineId,
          equipment_name: eq?.name ?? null, from_event_name: fromEv?.name ?? null, to_event_name: toEv?.name ?? null,
          requested_by_name: profile.full_name,
        }).select("id").single();
        await sb.from("tasks").insert({
          type: "transfer", transfer_id: inserted!.id, event_id: a.fromEventId,
          assigned_to: a.assignedTo, assigned_by: profile.id, status: "pending",
          title: `Send ${a.quantity}× ${eq?.name ?? "gear"} → ${toEv?.name ?? "event"}`,
          description: `Requested by ${profile.full_name}, from ${fromEv?.name ?? "event"}. Ship it or reject with a note.`,
        });
        await sb.from("notifications").insert({
          user_id: a.assignedTo, type: "task", title: "Transfer to send",
          body: `Send ${a.quantity}× ${eq?.name ?? "gear"} to ${toEv?.name ?? "an event"}.`, event_id: a.fromEventId, is_read: false,
        });
        sourceEventIds.add(a.fromEventId!);
      }
    }
  }

  if (warehouseNotes.length) {
    await notifyWarehouse(sb, toEventId, "Warehouse top-up requested",
      `${toEv?.name ?? "An event"} needs: ${warehouseNotes.join(", ")} — prepare & ship.`);
  }
  for (const eid of sourceEventIds) revalidatePath(`/events/${eid}`);
  touch(toEventId, null);
}

/* ---------- The assigned technician executes the send ---------- */

// Ship all or part of the request. Any shortfall (ship fewer than asked) is recorded.
export async function shipTransfer(
  transferId: string, shipQty: number, note?: string,
): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  const { data: tr } = await sb.from("transfers")
    .select("id,from_event_id,to_event_id,equipment_id,quantity,requested_quantity,status,to_line_id,from_event_name,equipment_name")
    .eq("id", transferId).single();
  if (!tr) return { error: "Transfer not found." };
  if (tr.status !== "requested") return { error: "This request was already handled." };
  if (!tr.from_event_id) return { error: "Warehouse top-ups are shipped by the warehouse." };

  const task = await assignedTechOf(sb, transferId);
  if (!(profile.role === "admin" || task?.assigned_to === profile.id))
    return { error: "Only the assigned technician can ship this transfer." };

  const req = tr.requested_quantity ?? tr.quantity;
  const want = Math.max(1, Math.min(shipQty, req));
  const moved = await shrinkWarehouseAt(sb, tr.from_event_id, tr.equipment_id, want);
  if (moved <= 0) return { error: "The source event no longer has warehouse gear to send for this item." };

  let toLineId = tr.to_line_id as string | null;
  if (!toLineId) {
    const { data: bLine } = await sb.from("event_equipment").select("id")
      .eq("event_id", tr.to_event_id).eq("equipment_id", tr.equipment_id).limit(1).maybeSingle();
    toLineId = bLine?.id ?? null;
  }
  if (!toLineId) return { error: "The requesting event no longer lists this equipment." };

  // B gains warehouse-origin units tagged to this transfer, marked in transit until B confirms.
  await sb.from("equipment_allocations").insert({
    event_equipment_id: toLineId, source: "warehouse", quantity: moved, transfer_id: tr.id, in_transit: true,
  });

  await sb.from("transfers").update({
    status: "sent", quantity: moved, note: note?.trim() || null,
    sent_by: profile.id, sent_at: new Date().toISOString(),
    decided_by_name: profile.full_name, decided_at: new Date().toISOString(),
  }).eq("id", transferId);

  if (task) await sb.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", task.id);

  const partial = moved < req;
  await notifyManagers(sb, tr.to_event_id, "Transfer on the way",
    `${moved}× ${tr.equipment_name ?? "gear"} shipped from ${tr.from_event_name ?? "an event"}${partial ? ` (of ${req} asked)` : ""} — confirm on arrival.`);
  touch(tr.to_event_id, tr.from_event_id);
}

// Reject the whole request (note required). Nothing moves; B keeps its shortfall.
export async function rejectTransfer(transferId: string, note: string): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  if (!note?.trim()) return { error: "Add a note explaining why." };
  const { data: tr } = await sb.from("transfers")
    .select("id,from_event_id,to_event_id,status,quantity,requested_quantity,equipment_name").eq("id", transferId).single();
  if (!tr) return { error: "Transfer not found." };
  if (tr.status !== "requested") return { error: "This request was already handled." };

  const task = await assignedTechOf(sb, transferId);
  if (!(profile.role === "admin" || task?.assigned_to === profile.id))
    return { error: "Only the assigned technician can reject this transfer." };

  await sb.from("transfers").update({
    status: "refused", note: note.trim(),
    decided_by_name: profile.full_name, decided_at: new Date().toISOString(),
  }).eq("id", transferId);
  if (task) await sb.from("tasks").update({ status: "cancelled" }).eq("id", task.id);

  await notifyManagers(sb, tr.to_event_id, "Transfer refused",
    `Your request for ${tr.requested_quantity ?? tr.quantity}× ${tr.equipment_name ?? "gear"} was declined: ${note.trim()}`);
  touch(tr.to_event_id, tr.from_event_id);
}

/* ---------- Receiving side confirms arrival (two-sided) ---------- */

export async function confirmTransferReceived(transferId: string): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  const { data: tr } = await sb.from("transfers")
    .select("id,from_event_id,to_event_id,status,quantity,equipment_name,to_event_name").eq("id", transferId).single();
  if (!tr) return { error: "Transfer not found." };
  if (!(await canManageEvent(sb, tr.to_event_id, profile)))
    return { error: "Only the receiving event's engineer or lead can confirm arrival." };
  if (tr.status !== "sent") return { error: "Nothing to confirm for this transfer." };

  await sb.from("transfers").update({
    status: "completed", received_by: profile.id, received_at: new Date().toISOString(), received_quantity: tr.quantity,
  }).eq("id", transferId);

  const { data: allocs } = await sb.from("equipment_allocations").select("id").eq("transfer_id", transferId).eq("in_transit", true);
  for (const a of allocs ?? []) await sb.from("equipment_allocations").update({ in_transit: false }).eq("id", a.id);

  if (tr.from_event_id) {
    await notifyManagers(sb, tr.from_event_id, "Transfer delivered",
      `${tr.quantity}× ${tr.equipment_name ?? "gear"} arrived at ${tr.to_event_name ?? "the event"}.`);
  } else {
    await notifyWarehouse(sb, tr.to_event_id, "Top-up delivered",
      `${tr.quantity}× ${tr.equipment_name ?? "gear"} arrived at ${tr.to_event_name ?? "the event"}.`);
  }
  touch(tr.to_event_id, tr.from_event_id);
}

/* ---------- Warehouse ships a top-up (WM) ---------- */

export async function shipTopup(transferId: string, driver: string): Promise<{ error: string } | void> {
  const profile = await getProfile();
  if (profile.role !== "warehouse_manager" && profile.role !== "admin") return { error: "Only the warehouse can ship a top-up." };
  const sb = await createClient();
  if (!driver?.trim() || !isKnownDriver(driver)) return { error: "Pick a driver to ship with." };

  const { data: tr } = await sb.from("transfers")
    .select("id,from_event_id,to_event_id,equipment_id,quantity,status,to_line_id,equipment_name").eq("id", transferId).single();
  if (!tr) return { error: "Request not found." };
  if (tr.from_event_id !== null) return { error: "This isn't a warehouse request." };
  if (tr.status !== "requested") return { error: "This request was already handled." };

  let toLineId = tr.to_line_id as string | null;
  if (!toLineId) {
    const { data: bLine } = await sb.from("event_equipment").select("id")
      .eq("event_id", tr.to_event_id).eq("equipment_id", tr.equipment_id).limit(1).maybeSingle();
    toLineId = bLine?.id ?? null;
  }
  if (!toLineId) return { error: "The requesting event no longer lists this equipment." };

  await sb.from("equipment_allocations").insert({
    event_equipment_id: toLineId, source: "warehouse", quantity: tr.quantity, transfer_id: tr.id, in_transit: true,
  });
  await sb.from("transfers").update({
    status: "sent", note: `Shipped with ${driver}`,
    sent_by: profile.id, sent_at: new Date().toISOString(),
    decided_by_name: profile.full_name, decided_at: new Date().toISOString(),
  }).eq("id", transferId);

  await notifyManagers(sb, tr.to_event_id, "Top-up on the way",
    `${tr.quantity}× ${tr.equipment_name ?? "gear"} shipped from the warehouse with ${driver} — confirm on arrival.`);
  touch(tr.to_event_id, null);
}
