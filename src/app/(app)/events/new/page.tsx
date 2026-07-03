import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import EventForm from "./EventForm";

export default async function NewEventPage() {
  const profile = await getProfile();
  if (profile.role !== "engineer" && profile.role !== "admin") redirect("/events");

  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment_availability")
    .select("equipment_id,name,category,available")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const equipment = (data ?? []).map((e: any) => ({
    id: e.equipment_id,
    name: e.name,
    category: e.category,
    available: e.available,
  }));

  return <EventForm equipment={equipment} />;
}
