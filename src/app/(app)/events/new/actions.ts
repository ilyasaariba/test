"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export type NewEventInput = {
  name: string;
  client?: string;
  location?: string;
  notes?: string;
  montage_start: string;
  live_start: string;
  live_end: string;
  demontage_end: string;
  lines: { equipment_id: string; quantity: number }[];
};

export async function createEvent(input: NewEventInput): Promise<{ error: string } | never> {
  const profile = await getProfile();
  if (profile.role !== "engineer" && profile.role !== "admin") {
    return { error: "Only the Engineer can create events." };
  }
  if (!input.name?.trim()) return { error: "Event name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
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
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create the event." };

  const lines = (input.lines || []).filter((l) => l.equipment_id && l.quantity > 0);
  if (lines.length) {
    // Insert the need lines, then commit them against warehouse stock by default
    // (this is what makes the gear "leave" available stock — Engineer can re-source
    // a line to transfer/rental later).
    const { data: inserted } = await supabase
      .from("event_equipment")
      .insert(lines.map((l) => ({ event_id: data.id, equipment_id: l.equipment_id, quantity: l.quantity })))
      .select("id, equipment_id, quantity");

    if (inserted?.length) {
      // Auto-source from warehouse up to what's actually available; the rest is a
      // shortfall the Engineer resolves on the event detail (transfer / rental).
      const ids = inserted.map((i: any) => i.equipment_id);
      const { data: avail } = await supabase
        .from("equipment_availability").select("equipment_id, available").in("equipment_id", ids);
      const availMap = new Map((avail ?? []).map((a: any) => [a.equipment_id, a.available]));
      const allocs = inserted
        .map((ee: any) => {
          const wh = Math.min(ee.quantity, Math.max(0, availMap.get(ee.equipment_id) ?? 0));
          return wh > 0 ? { event_equipment_id: ee.id, source: "warehouse", quantity: wh } : null;
        })
        .filter(Boolean);
      if (allocs.length) await supabase.from("equipment_allocations").insert(allocs as any);
    }
  }

  redirect(`/events/${data.id}`);
}
