"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/eventPerm";

const CLOSED = ["archived", "cancelled"];

export type EditEventInput = {
  name: string; client?: string; location?: string; notes?: string;
  montage_start: string; live_start: string; live_end: string; demontage_end: string;
};

export async function updateEventDetails(eventId: string, input: EditEventInput): Promise<{ error: string } | void> {
  const profile = await getProfile();
  if (!input.name?.trim()) return { error: "Event name is required." };
  const sb = await createClient();
  if (!(await canManageEvent(sb, eventId, profile))) return { error: "Not allowed." };
  const { data: ev } = await sb.from("events").select("status").eq("id", eventId).single();
  if (!ev) return { error: "Event not found." };
  if (CLOSED.includes(ev.status)) return { error: "This event is closed and can't be edited." };

  const { error } = await sb.from("events").update({
    name: input.name.trim(),
    client: input.client?.trim() || null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    montage_start: input.montage_start || null,
    live_start: input.live_start || null,
    live_end: input.live_end || null,
    demontage_end: input.demontage_end || null,
  }).eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function cancelEvent(eventId: string): Promise<{ error: string } | void> {
  const profile = await getProfile();
  const sb = await createClient();
  if (!(await canManageEvent(sb, eventId, profile))) return { error: "Not allowed." };
  const { data: ev } = await sb.from("events").select("status,name,created_by").eq("id", eventId).single();
  if (!ev) return { error: "Event not found." };
  if (CLOSED.includes(ev.status)) return { error: "This event is already closed." };

  const { error } = await sb.from("events").update({ status: "cancelled" }).eq("id", eventId);
  if (error) return { error: error.message };

  // If the warehouse was already involved, let them know the stock is released.
  if (["sent_to_warehouse", "prepared", "shipped"].includes(ev.status)) {
    const { data: wms } = await sb.from("app_users").select("id").eq("role", "warehouse_manager").eq("is_active", true);
    if (wms?.length) {
      await sb.from("notifications").insert(wms.map((w: any) => ({
        user_id: w.id, type: "event", title: "Event cancelled",
        body: `${ev.name} was cancelled — its stock is released.`, event_id: eventId, is_read: false,
      })));
    }
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/warehouse");
}
