import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import EventForm from "./EventForm";

export default async function NewEventPage() {
  const profile = await getProfile();
  if (profile.role !== "engineer" && profile.role !== "admin") redirect("/events");

  const supabase = await createClient();
  const [{ data: avail }, { data: whHolders }, { data: crewRows }, { data: allTechs }] = await Promise.all([
    supabase.from("equipment_availability")
      .select("equipment_id,name,category,available")
      .order("category", { ascending: true }).order("name", { ascending: true }),
    // Which active events currently hold warehouse units (what they could lend via transfer).
    supabase.from("equipment_allocations")
      .select("quantity,returned_quantity, event_equipment!inner(equipment_id, events!inner(id,name,status))")
      .eq("source", "warehouse"),
    // Crew of every event — a transfer can only be handed to the source event's own crew.
    supabase.from("event_technicians").select("event_id, app_users(id,full_name,username)"),
    // Full technician roster — to staff this new event.
    supabase.from("app_users").select("id,full_name,username").eq("role", "technician").eq("is_active", true).order("full_name"),
  ]);

  const equipment = (avail ?? []).map((e: any) => ({
    id: e.equipment_id, name: e.name, category: e.category, available: e.available,
  }));

  const holdersByEquip: Record<string, { id: string; name: string; qty: number }[]> = {};
  for (const r of whHolders ?? []) {
    const ee: any = (r as any).event_equipment; const ev: any = ee?.events;
    if (!ee || !ev || ["archived", "cancelled"].includes(ev.status)) continue;
    const q = Math.max(0, ((r as any).quantity ?? 0) - ((r as any).returned_quantity ?? 0));
    if (q <= 0) continue;
    const arr = (holdersByEquip[ee.equipment_id] ??= []);
    const hit = arr.find((x) => x.id === ev.id);
    if (hit) hit.qty += q; else arr.push({ id: ev.id, name: ev.name, qty: q });
  }

  const crewByEvent: Record<string, { id: string; full_name: string }[]> = {};
  for (const r of crewRows ?? []) {
    const u: any = (r as any).app_users; const evId = (r as any).event_id;
    if (!u || !evId) continue;
    (crewByEvent[evId] ??= []).push({ id: u.id, full_name: u.full_name ?? u.username ?? "—" });
  }

  const technicians = (allTechs ?? []).map((t: any) => ({
    id: t.id, full_name: t.full_name ?? t.username ?? "—", username: t.username ?? "",
  }));

  return (
    <EventForm
      equipment={equipment}
      holdersByEquip={holdersByEquip}
      crewByEvent={crewByEvent}
      technicians={technicians}
    />
  );
}
