"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

// Defining the equipment catalog belongs to the Engineer (and Admin).
function canManageCatalog(role: string) {
  return role === "admin" || role === "engineer";
}

export async function addEquipment(formData: FormData) {
  const profile = await getProfile();
  if (!canManageCatalog(profile.role)) return;

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const quantity = parseInt(String(formData.get("total_quantity") ?? "0"), 10);
  const importance = String(formData.get("importance") ?? "normal");
  if (!name || !category) return;

  const supabase = await createClient();
  await supabase.from("equipment").insert({
    name,
    category,
    total_quantity: Number.isFinite(quantity) ? quantity : 0,
    importance: importance === "critical" ? "critical" : "normal",
  });

  revalidatePath("/warehouse");
}

export async function deleteEquipment(id: string) {
  const profile = await getProfile();
  if (!canManageCatalog(profile.role)) return { error: "Not allowed." };

  const supabase = await createClient();
  // Protect the record trail: an item that any event has ever used can't be deleted.
  const { count } = await supabase
    .from("event_equipment")
    .select("id", { count: "exact", head: true })
    .eq("equipment_id", id);
  if ((count ?? 0) > 0) return { error: "This item is used by events — it can't be removed." };

  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) return { error: "Couldn't remove this item (it may be referenced elsewhere)." };

  revalidatePath("/warehouse");
}
