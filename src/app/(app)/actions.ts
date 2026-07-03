"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function markNotificationRead(id: string) {
  const profile = await getProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", profile.id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const profile = await getProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
  revalidatePath("/", "layout");
}
