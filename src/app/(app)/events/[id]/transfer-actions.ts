"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { isEventLead } from "@/lib/eventPerm";

const LOCKED = ["completed", "cancelled"];

type SB = Awaited<ReturnType<typeof createClient>>;
type TransferRow = { id: string; created_by: string | null; status: string; quantity: number; from_event_id: string; to_event_id: string };
type TransferCtx = { error: string } | { sb: SB; tr: TransferRow };

// Only the person who set up the transfer — or an admin — may edit/cancel it.
async function ownTransfer(transferId: string): Promise<TransferCtx> {
  const profile = await getProfile();
  const sb = await createClient();
  const { data: tr } = await sb
    .from("transfers")
    .select("id,created_by,status,quantity,from_event_id,to_event_id")
    .eq("id", transferId).single();
  if (!tr) return { error: "Transfer not found." };
  const privileged = tr.created_by === profile.id
    || profile.role === "admin"
    || await isEventLead(sb, tr.to_event_id, profile.id)
    || await isEventLead(sb, tr.from_event_id, profile.id);
  if (!privileged) {
    return { error: "Only the person who set up this transfer (or the event lead) can change it." };
  }
  return { sb, tr };
}

function refresh(tr: { from_event_id: string; to_event_id: string }) {
  revalidatePath(`/events/${tr.to_event_id}`);
  revalidatePath(`/events/${tr.from_event_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

export async function editTransfer(transferId: string, quantity: number, scheduledTime: string | null): Promise<{ error: string } | void> {
  const o = await ownTransfer(transferId); if ("error" in o) return o;
  if (LOCKED.includes(o.tr.status)) return { error: "This transfer is closed." };
  if (quantity < 1) return { error: "Quantity must be at least 1." };
  const { error } = await o.sb.from("transfers")
    .update({ quantity, scheduled_time: scheduledTime || null }).eq("id", transferId);
  if (error) return { error: error.message };
  // keep the destination event's sourcing in sync with the new quantity
  await o.sb.from("equipment_allocations").update({ quantity }).eq("transfer_id", transferId);
  refresh(o.tr);
}

export async function cancelTransfer(transferId: string): Promise<{ error: string } | void> {
  const o = await ownTransfer(transferId); if ("error" in o) return o;
  if (LOCKED.includes(o.tr.status)) return { error: "This transfer is already closed." };
  // free the destination need (drop the sourcing allocation) and cancel the carry task
  await o.sb.from("equipment_allocations").delete().eq("transfer_id", transferId);
  await o.sb.from("tasks").update({ status: "cancelled" }).eq("transfer_id", transferId).neq("status", "done");
  const { error } = await o.sb.from("transfers").update({ status: "cancelled" }).eq("id", transferId);
  if (error) return { error: error.message };
  refresh(o.tr);
}
