"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/eventPerm";

type SB = Awaited<ReturnType<typeof createClient>>;

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

function touch(toEventId: string | null, fromEventId: string | null) {
  if (toEventId) revalidatePath(`/events/${toEventId}`);
  if (fromEventId) revalidatePath(`/events/${fromEventId}`);
  revalidatePath("/transfers");
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");
}

/* ---- B asks event A for gear. Nothing moves until A accepts. ---- */
export async function requestTransfer(
  toEventId: string, toLineId: string, equipmentId: string, fromEventId: string, quantity: number,
): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, toEventId, profile))) return { error: "Not allowed." };
  if (!fromEventId) return { error: "Pick which event to request from." };
  if (fromEventId === toEventId) return { error: "Pick a different source event." };
  if (quantity < 1) return { error: "Quantity must be at least 1." };

  const [{ data: fromEv }, { data: toEv }, { data: eq }] = await Promise.all([
    sb.from("events").select("name").eq("id", fromEventId).single(),
    sb.from("events").select("name").eq("id", toEventId).single(),
    sb.from("equipment").select("name").eq("id", equipmentId).single(),
  ]);
  if (!fromEv) return { error: "Source event not found." };

  const { error } = await sb.from("transfers").insert({
    from_event_id: fromEventId, to_event_id: toEventId, equipment_id: equipmentId,
    quantity, status: "requested", created_by: profile.id, to_line_id: toLineId,
    equipment_name: eq?.name ?? null, from_event_name: fromEv?.name ?? null, to_event_name: toEv?.name ?? null,
    requested_by_name: profile.full_name,
  });
  if (error) return { error: error.message };

  await notifyManagers(sb, fromEventId, "Transfer requested",
    `${toEv?.name ?? "An event"} is asking for ${quantity}× ${eq?.name ?? "gear"}.`);
  touch(toEventId, fromEventId);
}

/* ---- A accepts: the warehouse units move A → B (A shrinks, B gains, tagged). ---- */
export async function acceptTransfer(transferId: string): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  const { data: tr } = await sb.from("transfers")
    .select("id,from_event_id,to_event_id,equipment_id,quantity,status,to_line_id,from_event_name,equipment_name")
    .eq("id", transferId).single();
  if (!tr) return { error: "Transfer not found." };
  if (!tr.from_event_id) return { error: "The source event no longer exists." };
  if (!(await canManageEvent(sb, tr.from_event_id, profile))) return { error: "Only the source event's engineer or lead can accept." };
  if (tr.status !== "requested") return { error: "This request was already handled." };

  // What warehouse gear does A actually still hold for this equipment?
  const { data: aLines } = await sb.from("event_equipment")
    .select("id, equipment_allocations(id,source,quantity,returned_quantity)")
    .eq("event_id", tr.from_event_id).eq("equipment_id", tr.equipment_id);
  const whAllocs: { id: string; quantity: number; returned_quantity: number }[] = [];
  for (const l of aLines ?? []) {
    for (const a of (l as any).equipment_allocations ?? []) {
      if (a.source === "warehouse") whAllocs.push({ id: a.id, quantity: a.quantity ?? 0, returned_quantity: a.returned_quantity ?? 0 });
    }
  }
  const held = whAllocs.reduce((s, a) => s + Math.max(0, a.quantity - a.returned_quantity), 0);
  if (held <= 0) return { error: "The source event no longer has warehouse gear to lend for this item." };
  const move = Math.min(tr.quantity, held);

  // Shrink A's warehouse allocation(s) by `move`.
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

  // Where does B receive it?
  let toLineId = tr.to_line_id as string | null;
  if (!toLineId) {
    const { data: bLine } = await sb.from("event_equipment").select("id")
      .eq("event_id", tr.to_event_id).eq("equipment_id", tr.equipment_id).limit(1).maybeSingle();
    toLineId = bLine?.id ?? null;
  }
  if (!toLineId) return { error: "The requesting event no longer lists this equipment." };

  // B gains a warehouse-origin allocation tagged with the transfer (so the warehouse
  // "out" view attributes the units to B, and B's board shows "transfer ← A").
  await sb.from("equipment_allocations").insert({
    event_equipment_id: toLineId, source: "warehouse", quantity: move, transfer_id: tr.id,
  });

  await sb.from("transfers").update({
    status: "planned", quantity: move,
    decided_by: profile.id, decided_by_name: profile.full_name, decided_at: new Date().toISOString(),
  }).eq("id", transferId);

  await notifyManagers(sb, tr.to_event_id, "Transfer accepted",
    `${move}× ${tr.equipment_name ?? "gear"} approved from ${tr.from_event_name ?? "an event"}.`);
  touch(tr.to_event_id, tr.from_event_id);
}

/* ---- A refuses: nothing moves; B keeps its shortfall. ---- */
export async function refuseTransfer(transferId: string, note?: string): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  const { data: tr } = await sb.from("transfers")
    .select("id,from_event_id,to_event_id,status,quantity,equipment_name")
    .eq("id", transferId).single();
  if (!tr) return { error: "Transfer not found." };
  if (!tr.from_event_id) return { error: "The source event no longer exists." };
  if (!(await canManageEvent(sb, tr.from_event_id, profile))) return { error: "Only the source event's engineer or lead can refuse." };
  if (tr.status !== "requested") return { error: "This request was already handled." };

  await sb.from("transfers").update({
    status: "refused", note: note?.trim() || null,
    decided_by: profile.id, decided_by_name: profile.full_name, decided_at: new Date().toISOString(),
  }).eq("id", transferId);

  await notifyManagers(sb, tr.to_event_id, "Transfer refused",
    `Your request for ${tr.quantity}× ${tr.equipment_name ?? "gear"} was declined.`);
  touch(tr.to_event_id, tr.from_event_id);
}
