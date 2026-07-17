"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

type SB = Awaited<ReturnType<typeof createClient>>;

export type NewEventTransfer = { fromEventId: string; quantity: number; assignedTo: string };
export type NewEventLine = {
  equipment_id: string;
  totalNeeded: number;
  warehouseQty: number;              // sourced directly from warehouse (reserved now)
  transfers: NewEventTransfer[];     // requested from other events (become tasks)
};
export type NewEventCrew = { userId: string; isLead: boolean };

export type NewEventInput = {
  name: string;
  client?: string;
  location?: string;
  notes?: string;
  montage_start: string;
  live_start: string;
  live_end: string;
  demontage_end: string;
  lines: NewEventLine[];
  crew: NewEventCrew[];
};

// How many warehouse units the source event still holds for an item (what it can lend).
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

export async function createEvent(input: NewEventInput): Promise<{ error: string } | never> {
  const profile = await getProfile();
  if (profile.role !== "engineer" && profile.role !== "admin") {
    return { error: "Only the Engineer can create events." };
  }
  if (!input.name?.trim()) return { error: "Event name is required." };

  const sb = await createClient();

  const lines = (input.lines || [])
    .map((l) => ({
      equipment_id: l.equipment_id,
      totalNeeded: Math.max(1, Math.floor(l.totalNeeded || 0)),
      warehouseQty: Math.max(0, Math.floor(l.warehouseQty || 0)),
      transfers: (l.transfers || []).filter((t) => t.fromEventId && (t.quantity || 0) > 0),
    }))
    .filter((l) => l.equipment_id && l.totalNeeded >= 1);

  // Validate every transfer BEFORE writing anything: assignee must be on the source
  // event's crew, and the source must actually hold enough to lend.
  for (const l of lines) {
    const allocated = l.warehouseQty + l.transfers.reduce((s, t) => s + t.quantity, 0);
    if (allocated > l.totalNeeded) return { error: "One item has more allocated than it needs." };
    for (const t of l.transfers) {
      if (!t.assignedTo) return { error: "Assign a technician for each event you borrow from." };
      const { data: crew } = await sb.from("event_technicians")
        .select("user_id").eq("event_id", t.fromEventId).eq("user_id", t.assignedTo).limit(1).maybeSingle();
      if (!crew) return { error: "The technician must be on the source event's crew." };
      const held = await heldWarehouseAt(sb, t.fromEventId, l.equipment_id);
      if (t.quantity > held) {
        const { data: fe } = await sb.from("events").select("name").eq("id", t.fromEventId).single();
        return { error: `${fe?.name ?? "That event"} only has ${held}× to lend — lower it or source the rest elsewhere.` };
      }
    }
  }

  // Create the event.
  const { data: ev, error } = await sb
    .from("events")
    .insert({
      name: input.name.trim(),
      client: input.client?.trim() || null,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      montage_start: input.montage_start || null,
      live_start: input.live_start || null,
      live_end: input.live_end || null,
      demontage_end: input.demontage_end || null,
      status: "draft",
      created_by: profile.id,
    })
    .select("id,name")
    .single();

  if (error || !ev) return { error: error?.message ?? "Could not create the event." };

  // Assign the crew (deduped) and let them know.
  const seen = new Set<string>();
  const crewRows = (input.crew || [])
    .filter((c) => c.userId && !seen.has(c.userId) && (seen.add(c.userId), true))
    .map((c) => ({ event_id: ev.id, user_id: c.userId, is_lead: !!c.isLead }));
  if (crewRows.length) {
    await sb.from("event_technicians").insert(crewRows);
    await sb.from("notifications").insert(crewRows.map((r) => ({
      user_id: r.user_id, type: "event",
      title: r.is_lead ? "You're leading a new event" : "Assigned to a new event",
      body: `${ev.name} — you're on the crew${r.is_lead ? " as the lead" : ""}.`,
      event_id: ev.id, is_read: false,
    })));
  }

  // Equipment need lines, then source each: warehouse portions are reserved directly,
  // event portions become transfer requests + a task for the source event's tech (the
  // same mechanism as a mid-event request — each tech gets one grouped form).
  const warehouseWanted = lines.filter((l) => l.warehouseQty > 0).map((l) => l.equipment_id);
  const availMap = new Map<string, number>();
  if (warehouseWanted.length) {
    const { data: av } = await sb.from("equipment_availability")
      .select("equipment_id, available").in("equipment_id", warehouseWanted);
    for (const a of av ?? []) availMap.set((a as any).equipment_id, (a as any).available ?? 0);
  }

  for (const l of lines) {
    const { data: line } = await sb.from("event_equipment")
      .insert({ event_id: ev.id, equipment_id: l.equipment_id, quantity: l.totalNeeded })
      .select("id").single();
    const toLineId = line?.id ?? null;

    if (l.warehouseQty > 0 && toLineId) {
      const wh = Math.min(l.warehouseQty, Math.max(0, availMap.get(l.equipment_id) ?? 0));
      if (wh > 0) {
        await sb.from("equipment_allocations")
          .insert({ event_equipment_id: toLineId, source: "warehouse", quantity: wh });
      }
    }

    if (l.transfers.length) {
      const { data: eq } = await sb.from("equipment").select("name").eq("id", l.equipment_id).single();
      for (const t of l.transfers) {
        const { data: fromEv } = await sb.from("events").select("name").eq("id", t.fromEventId).single();
        const { data: tr } = await sb.from("transfers").insert({
          from_event_id: t.fromEventId, to_event_id: ev.id, equipment_id: l.equipment_id,
          quantity: t.quantity, requested_quantity: t.quantity, status: "requested",
          created_by: profile.id, to_line_id: toLineId,
          equipment_name: eq?.name ?? null, from_event_name: fromEv?.name ?? null, to_event_name: ev.name,
          requested_by_name: profile.full_name,
        }).select("id").single();
        await sb.from("tasks").insert({
          type: "transfer", transfer_id: tr!.id, event_id: t.fromEventId,
          assigned_to: t.assignedTo, assigned_by: profile.id, status: "pending",
          title: `Send ${t.quantity}× ${eq?.name ?? "gear"} → ${ev.name}`,
          description: `Requested by ${profile.full_name}, from ${fromEv?.name ?? "event"}. Ship it or reject with a note.`,
        });
        await sb.from("notifications").insert({
          user_id: t.assignedTo, type: "task", title: "Transfer to send",
          body: `Send ${t.quantity}× ${eq?.name ?? "gear"} to ${ev.name}.`, event_id: t.fromEventId, is_read: false,
        });
      }
    }
  }

  redirect(`/events/${ev.id}`);
}
