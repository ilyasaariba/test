"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function addEquipment(formData: FormData) {
  const profile = await getProfile();
  // Managing warehouse stock belongs to the Warehouse Manager (and Admin) — not the Engineer.
  if (profile.role !== "admin" && profile.role !== "warehouse_manager") return;

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
