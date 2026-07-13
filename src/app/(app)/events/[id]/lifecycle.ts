"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isKnownDriver } from "@/lib/drivers";
import { isEventLead, canManageEvent } from "@/lib/eventPerm";

type SB = Awaited<ReturnType<typeof createClient>>;

async function notifyWarehouse(sb: SB, eventId: string, title: string, body: string) {
  const { data: wms } = await sb.from("app_users").select("id").eq("role", "warehouse_manager").eq("is_active", true);
  if (wms?.length) {
    await sb.from("notifications").insert(
      wms.map((w: any) => ({ user_id: w.id, type: "event", title, body, event_id: eventId, is_read: false })),
    );
  }
}

async function notifyUser(sb: SB, userId: string | null, eventId: string, title: string, body: string) {
  if (userId) await sb.from("notifications").insert({ user_id: userId, type: "event", title, body, event_id: eventId, is_read: false });
}

type MoveOk = { ok: true; sb: SB; event: any; profileId: string };
async function move(
  eventId: string,
  opts: { roles: string[]; from: string[]; to: string; allowLead?: boolean },
): Promise<{ error: string } | MoveOk> {
  const profile = await getProfile();
  const sb = await createClient();
  let permitted = opts.roles.includes(profile.role);
  if (!permitted && opts.allowLead) permitted = await isEventLead(sb, eventId, profile.id);
  if (!permitted) return { error: "You don't have permission for this step." };
  const { data: event } = await sb.from("events").select("id, created_by, status, name").eq("id", eventId).single();
  if (!event) return { error: "Event not found." };
  if (!opts.from.includes(event.status)) return { error: "This action isn't available at the current stage." };
  const { error } = await sb.from("events").update({ status: opts.to }).eq("id", eventId);
  if (error) return { error: error.message };
  return { ok: true, sb, event, profileId: profile.id };
}

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/warehouse/requests");
  revalidatePath(`/warehouse/requests/${eventId}`);
  revalidatePath("/dashboard");
  revalidatePath("/events");
}

/* ---- Engineer: send the request to the warehouse ---- */
export async function sendToWarehouse(eventId: string) {
  const r = await move(eventId, { roles: ["engineer", "admin"], from: ["draft"], to: "sent_to_warehouse", allowLead: true });
  if ("error" in r) return r;
  await notifyWarehouse(r.sb, eventId, "New equipment request", `${r.event.name} needs preparing.`);
  refresh(eventId);
}

/* ---- Warehouse: gear gathered & packed ---- */
export async function markPrepared(eventId: string) {
  const r = await move(eventId, { roles: ["warehouse_manager", "admin"], from: ["sent_to_warehouse"], to: "prepared" });
  if ("error" in r) return r;
  await notifyUser(r.sb, r.event.created_by, eventId, "Equipment prepared", `${r.event.name} is packed and ready to ship.`);
  refresh(eventId);
}

/* ---- Warehouse: hand off / send to the event site (with the chosen driver) ---- */
export async function shipToEvent(eventId: string, driver: string) {
  if (!driver?.trim()) return { error: "Pick a driver to ship with." };
  if (!isKnownDriver(driver)) return { error: "Unknown driver." };
  const r = await move(eventId, { roles: ["warehouse_manager", "admin"], from: ["prepared"], to: "shipped" });
  if ("error" in r) return r;
  await r.sb.from("events").update({ shipper: driver }).eq("id", eventId);
  await notifyUser(r.sb, r.event.created_by, eventId, "Equipment shipped", `${r.event.name} gear is on the way with ${driver} — confirm when it arrives.`);
  refresh(eventId);
}

/* ---- Engineer / lead: tick a delivered line as checked-in on arrival ---- */
export async function toggleLineConfirmed(eventId: string, lineId: string, confirmed: boolean) {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, eventId, profile))) return { error: "Not allowed." };
  const { error } = await sb.from("event_equipment").update({ tech_confirmed: confirmed }).eq("id", lineId);
  if (error) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
}

/* ---- Engineer / lead: tick ALL delivered lines at once (receiving shortcut) ---- */
export async function setAllLinesConfirmed(eventId: string, confirmed: boolean) {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, eventId, profile))) return { error: "Not allowed." };
  const { error } = await sb.from("event_equipment").update({ tech_confirmed: confirmed }).eq("event_id", eventId);
  if (error) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
}

/* ---- Engineer: confirm the gear reached the site ---- */
export async function confirmReceived(eventId: string) {
  const r = await move(eventId, { roles: ["engineer", "admin"], from: ["shipped"], to: "received_on_site", allowLead: true });
  if ("error" in r) return r;
  await notifyWarehouse(r.sb, eventId, "Delivery confirmed", `${r.event.name} gear arrived on site.`);
  refresh(eventId);
}

/* ---- Engineer: event goes live ---- */
export async function goLive(eventId: string) {
  const r = await move(eventId, { roles: ["engineer", "admin"], from: ["received_on_site"], to: "in_progress", allowLead: true });
  if ("error" in r) return r;
  refresh(eventId);
}

/* ---- Engineer / lead: the show is over — open the teardown (démontage) pack-down ---- */
export async function beginTeardown(eventId: string) {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, eventId, profile))) return { error: "Not allowed." };
  const { data: ev } = await sb.from("events").select("id, name, status, created_by, teardown_started_at").eq("id", eventId).single();
  if (!ev) return { error: "Event not found." };
  if (ev.status !== "in_progress") return { error: "Teardown starts once the event is live." };
  if (ev.teardown_started_at) { refresh(eventId); return; } // already under way

  await sb.from("events").update({ teardown_started_at: new Date().toISOString() }).eq("id", eventId);
  // fresh pack-down checklist
  await sb.from("event_equipment").update({ packed: false }).eq("event_id", eventId);

  // alert whoever packs the gear: this event's lead(s) + its engineer (minus the clicker)
  const { data: leads } = await sb.from("event_technicians").select("user_id").eq("event_id", eventId).eq("is_lead", true);
  const recipients = new Set<string>();
  for (const l of leads ?? []) if (l.user_id) recipients.add(l.user_id);
  if (ev.created_by) recipients.add(ev.created_by);
  recipients.delete(profile.id);
  if (recipients.size) {
    await sb.from("notifications").insert([...recipients].map((uid) => ({
      user_id: uid, type: "event", title: "Teardown started",
      body: `${ev.name} is over — pack the gear so it's ready to ship back.`, event_id: eventId, is_read: false,
    })));
  }
  refresh(eventId);
}

/* ---- Engineer / lead: tick a line as packed for the return trip ---- */
export async function toggleLinePacked(eventId: string, lineId: string, packed: boolean) {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, eventId, profile))) return { error: "Not allowed." };
  const { error } = await sb.from("event_equipment").update({ packed }).eq("id", lineId);
  if (error) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
}

/* ---- Engineer / lead: tick ALL lines packed at once (teardown shortcut) ---- */
export async function setAllLinesPacked(eventId: string, packed: boolean) {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, eventId, profile))) return { error: "Not allowed." };
  const { error } = await sb.from("event_equipment").update({ packed }).eq("event_id", eventId);
  if (error) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
}

/* ---- Engineer: event finished, gear coming back ---- */
export async function endEvent(eventId: string) {
  const pre = await createClient();
  // teardown must be under way before the event can be closed out
  const { data: ev0 } = await pre.from("events").select("status, teardown_started_at").eq("id", eventId).single();
  if (ev0?.status === "in_progress" && !ev0?.teardown_started_at)
    return { error: "Begin teardown before ending the event." };

  const r = await move(eventId, { roles: ["engineer", "admin"], from: ["in_progress"], to: "returning", allowLead: true });
  if ("error" in r) return r;
  // Fresh return checklist — the WM ticks items back in as they physically arrive.
  await r.sb.from("event_equipment").update({ wm_prepared: false }).eq("event_id", eventId);
  await notifyWarehouse(r.sb, eventId, "Gear returning", `${r.event.name} is over — check the equipment back in.`);
  refresh(eventId);
}

function isWmOrAdmin(role: string) {
  return role === "warehouse_manager" || role === "admin";
}

/* ---- Warehouse: tick a line as physically returned (frees its warehouse units now) ---- */
export async function markLineReturned(eventId: string, lineId: string, returned: boolean) {
  const profile = await getProfile();
  if (!isWmOrAdmin(profile.role)) return { error: "Not allowed." };
  const sb = await createClient();
  const { data: allocs } = await sb.from("equipment_allocations")
    .select("id, quantity").eq("event_equipment_id", lineId).eq("source", "warehouse");
  for (const a of allocs ?? []) {
    await sb.from("equipment_allocations").update({ returned_quantity: returned ? a.quantity : 0 }).eq("id", a.id);
  }
  await sb.from("event_equipment").update({ wm_prepared: returned }).eq("id", lineId);
  revalidatePath(`/warehouse/requests/${eventId}`);
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");
}

/* ---- Warehouse: report a line as missing or damaged (creates a discrepancy) ---- */
export async function reportMissing(
  eventId: string, equipmentId: string, quantity: number, reason: "missing" | "damaged", note: string,
) {
  const profile = await getProfile();
  if (!isWmOrAdmin(profile.role)) return { error: "Not allowed." };
  if (quantity < 1) return { error: "Quantity must be at least 1." };
  const sb = await createClient();
  const { data: eq } = await sb.from("equipment").select("importance").eq("id", equipmentId).single();
  const { error } = await sb.from("missing_items").insert({
    event_id: eventId, equipment_id: equipmentId, quantity,
    is_critical: eq?.importance === "critical", status: "missing", reported_by: profile.id,
    phase: "return", reason, notes: note?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/warehouse/requests/${eventId}`);
  revalidatePath("/dashboard");
}

/* ---- Warehouse: confirm the return check-in → reconciliation (if discrepancies) or Done ---- */
export async function confirmReturned(eventId: string) {
  const profile = await getProfile();
  if (!isWmOrAdmin(profile.role)) return { error: "Not allowed." };
  const sb = await createClient();
  const { data: ev } = await sb.from("events").select("id, name, status, created_by").eq("id", eventId).single();
  if (!ev) return { error: "Event not found." };
  if (ev.status !== "returning") return { error: "This action isn't available at the current stage." };

  const { count } = await sb.from("missing_items").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("status", "missing");
  const hasMissing = (count ?? 0) > 0;

  await sb.from("events").update({ status: hasMissing ? "reconciliation" : "archived" }).eq("id", eventId);
  if (hasMissing) {
    await notifyUser(sb, ev.created_by, eventId, "Reconciliation needed", `${ev.name} came back with missing/damaged gear to resolve.`);
  } else {
    await sb.rpc("fn_archive_event", { p_event_id: eventId, p_actor: profile.id });
    await notifyUser(sb, ev.created_by, eventId, "Gear returned", `${ev.name} — all equipment back, stock freed.`);
  }
  refresh(eventId);
}

/* ---- Warehouse: resolve a discrepancy — found (back to stock) or written off (lost) ---- */
export async function resolveMissing(eventId: string, missingId: string, resolution: "found" | "written_off") {
  const profile = await getProfile();
  if (!isWmOrAdmin(profile.role)) return { error: "Not allowed." };
  const sb = await createClient();
  const { data: mi } = await sb.from("missing_items").select("id, equipment_id, quantity").eq("id", missingId).single();
  if (!mi) return { error: "Discrepancy not found." };

  await sb.from("missing_items").update({
    status: resolution, resolved_by: profile.id, resolved_at: new Date().toISOString(),
  }).eq("id", missingId);

  if (resolution === "written_off") {
    // Permanent loss — reduce owned inventory.
    const { data: eq } = await sb.from("equipment").select("total_quantity").eq("id", mi.equipment_id).single();
    const next = Math.max(0, (eq?.total_quantity ?? 0) - mi.quantity);
    await sb.from("equipment").update({ total_quantity: next }).eq("id", mi.equipment_id);
  }
  revalidatePath(`/warehouse/requests/${eventId}`);
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");
}

/* ---- Warehouse: close out a fully-reconciled event → Done ---- */
export async function completeReconciliation(eventId: string) {
  const profile = await getProfile();
  if (!isWmOrAdmin(profile.role)) return { error: "Not allowed." };
  const sb = await createClient();
  const { data: ev } = await sb.from("events").select("id, name, status, created_by").eq("id", eventId).single();
  if (!ev) return { error: "Event not found." };
  if (ev.status !== "reconciliation") return { error: "This event isn't in reconciliation." };

  const { count } = await sb.from("missing_items").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("status", "missing");
  if ((count ?? 0) > 0) return { error: "Resolve every discrepancy before closing." };

  await sb.from("events").update({ status: "archived" }).eq("id", eventId);
  await sb.rpc("fn_archive_event", { p_event_id: eventId, p_actor: profile.id });
  await notifyUser(sb, ev.created_by, eventId, "Event closed", `${ev.name} reconciled and archived.`);
  refresh(eventId);
}

/* ---- Warehouse: tick a line as picked/packed ---- */
export async function toggleLinePrepared(eventId: string, lineId: string, prepared: boolean) {
  const profile = await getProfile();
  if (profile.role !== "warehouse_manager" && profile.role !== "admin") return { error: "Not allowed." };
  const sb = await createClient();
  const { error } = await sb.from("event_equipment").update({ wm_prepared: prepared }).eq("id", lineId);
  if (error) return { error: error.message };
  revalidatePath(`/warehouse/requests/${eventId}`);
}

/* ---- Warehouse: tick ALL lines at once (prep-stage shortcut) ---- */
export async function setAllLinesPrepared(eventId: string, prepared: boolean) {
  const profile = await getProfile();
  if (profile.role !== "warehouse_manager" && profile.role !== "admin") return { error: "Not allowed." };
  const sb = await createClient();
  const { error } = await sb.from("event_equipment").update({ wm_prepared: prepared }).eq("event_id", eventId);
  if (error) return { error: error.message };
  revalidatePath(`/warehouse/requests/${eventId}`);
}
