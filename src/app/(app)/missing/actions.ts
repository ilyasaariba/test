"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isEventLead } from "@/lib/eventPerm";

const STAFF = ["warehouse_manager", "engineer", "admin"];

export type DeclareInput = {
  equipmentId: string;
  quantity: number;
  eventId: string | null;
  phase: string;   // transit | event | return | other
  reason: string;  // missing | lost | damaged
  location: string;
  note: string;
};

// Declare an item missing / lost / damaged. Allowed for WM, engineer, admin, and
// the lead ("responsable") of the event it's tied to.
export async function declareMissing(input: DeclareInput): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  const allowed = STAFF.includes(profile.role)
    || (input.eventId ? await isEventLead(sb, input.eventId, profile.id) : false);
  if (!allowed) return { error: "You don't have permission to declare missing equipment." };
  if (!input.equipmentId) return { error: "Pick which equipment is missing." };
  if (input.quantity < 1) return { error: "Quantity must be at least 1." };

  const { data: eq } = await sb.from("equipment").select("name,importance").eq("id", input.equipmentId).single();
  const { error } = await sb.from("missing_items").insert({
    event_id: input.eventId || null,
    equipment_id: input.equipmentId,
    quantity: input.quantity,
    location: input.location.trim() || null,
    is_critical: eq?.importance === "critical",
    status: "missing",
    reported_by: profile.id,
    phase: input.phase || "other",
    reason: input.reason || "missing",
    notes: input.note.trim() || null,
  });
  if (error) return { error: error.message };

  // Keep the event owner in the loop (loss may need their call / blocks archiving).
  if (input.eventId) {
    const { data: ev } = await sb.from("events").select("name,created_by").eq("id", input.eventId).single();
    if (ev?.created_by && ev.created_by !== profile.id) {
      await sb.from("notifications").insert({
        user_id: ev.created_by, type: "missing",
        title: eq?.importance === "critical" ? "Critical gear declared missing" : "Gear declared missing",
        body: `${input.quantity}× ${eq?.name ?? "item"} on ${ev.name} — ${input.reason} (${phaseLabel(input.phase)}).`,
        event_id: input.eventId, is_read: false,
      });
    }
  }

  revalidatePath("/missing");
  revalidatePath("/dashboard");
  if (input.eventId) revalidatePath(`/events/${input.eventId}`);
}

// Resolve a declared item: "found" (back to stock, no change) or "written_off"
// (permanent loss → reduce owned inventory). WM / engineer / admin.
export async function resolveMissingItem(
  missingId: string, resolution: "found" | "written_off",
): Promise<{ error: string } | void> {
  const profile = await getProfile();
  if (!STAFF.includes(profile.role)) return { error: "Not allowed." };
  const sb = await createClient();
  const { data: mi } = await sb.from("missing_items")
    .select("id,equipment_id,quantity,status,event_id").eq("id", missingId).single();
  if (!mi) return { error: "Record not found." };
  if (mi.status !== "missing") return { error: "This item is already resolved." };

  await sb.from("missing_items").update({
    status: resolution, resolved_by: profile.id, resolved_at: new Date().toISOString(),
  }).eq("id", missingId);

  if (resolution === "written_off") {
    const { data: eq } = await sb.from("equipment").select("total_quantity").eq("id", mi.equipment_id).single();
    const next = Math.max(0, (eq?.total_quantity ?? 0) - mi.quantity);
    await sb.from("equipment").update({ total_quantity: next }).eq("id", mi.equipment_id);
  }

  revalidatePath("/missing");
  revalidatePath("/warehouse");
  revalidatePath("/dashboard");
  if (mi.event_id) revalidatePath(`/events/${mi.event_id}`);
}

function phaseLabel(p: string): string {
  return p === "transit" ? "in transit"
    : p === "event" ? "at the event"
    : p === "return" ? "on return"
    : "unspecified";
}
