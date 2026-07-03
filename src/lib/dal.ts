import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  role: string;
};

// Returns the signed-in user's profile, or redirects to /login.
export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("app_users")
    .select("id, username, full_name, role")
    .eq("id", user.id)
    .single();

  if (!data) redirect("/login");
  return data as Profile;
}
