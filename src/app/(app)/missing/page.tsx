import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import MissingBoard from "./MissingBoard";

export default async function MissingPage() {
  const profile = await getProfile();
  // Cross-event view for staff + read-only boss. Technicians declare from their
  // event's detail page (if they're the lead), not here.
  if (profile.role === "technician") redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: rows }, { data: equip }, { data: evs }] = await Promise.all([
    supabase.from("missing_items")
      .select("id,quantity,is_critical,status,phase,reason,location,notes,reported_at, equipment(name), events(name), reporter:app_users!missing_items_reported_by_fkey(full_name)")
      .order("reported_at", { ascending: false }),
    supabase.from("equipment").select("id,name,importance").order("name"),
    supabase.from("events").select("id,name,status").not("status", "in", "(archived,cancelled)").order("live_start", { ascending: false }),
  ]);

  const items = (rows ?? []).map((r: any) => ({
    id: r.id,
    equipment: r.equipment?.name ?? "—",
    quantity: r.quantity,
    isCritical: !!r.is_critical,
    status: r.status,
    phase: r.phase ?? "other",
    reason: r.reason ?? "missing",
    location: r.location,
    eventName: r.events?.name ?? null,
    reporter: r.reporter?.full_name ?? null,
    reportedAt: r.reported_at,
    notes: r.notes,
  }));
  const equipment = (equip ?? []).map((e: any) => ({ id: e.id, name: e.name, importance: e.importance }));
  const events = (evs ?? []).map((e: any) => ({ id: e.id, name: e.name }));

  const isStaff = ["warehouse_manager", "engineer", "admin"].includes(profile.role);

  return (
    <div className="max-w-4xl mx-auto">
      <MissingBoard items={items} equipment={equipment} events={events} canDeclare={isStaff} canResolve={isStaff} />
    </div>
  );
}
