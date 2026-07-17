import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { statusBadge, fmtDMY } from "@/lib/ui";
import PrepBoard from "./PrepBoard";
import PageHeader from "@/components/PageHeader";

export default async function WarehousePrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  if (profile.role !== "warehouse_manager" && profile.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  const [{ data: lines }, { data: allEvents }, { data: missing }] = await Promise.all([
    supabase.from("event_equipment")
      .select("id,quantity,wm_prepared, equipment(id,name,category,importance), equipment_allocations(source,quantity, rentals(lender_name), transfers(from_event_id))")
      .eq("event_id", id),
    supabase.from("events").select("id,name"),
    supabase.from("missing_items").select("id,quantity,is_critical,status,notes, equipment(name)").eq("event_id", id).order("reported_at", { ascending: true }),
  ]);

  const eventNames: Record<string, string> = Object.fromEntries((allEvents ?? []).map((e: any) => [e.id, e.name]));

  const shaped = (lines ?? []).map((l: any) => ({
    id: l.id,
    equipmentId: l.equipment?.id,
    name: l.equipment?.name ?? "—",
    category: l.equipment?.category ?? "—",
    importance: l.equipment?.importance ?? "normal",
    quantity: l.quantity,
    prepared: l.wm_prepared,
    sources: (l.equipment_allocations ?? []).map((a: any) => ({
      source: a.source,
      quantity: a.quantity,
      label: a.source === "rental" ? `rental ← ${a.rentals?.lender_name ?? "lender"}`
        : a.source === "transfer" ? `transfer ← ${a.transfers?.from_event_id ? eventNames[a.transfers.from_event_id] ?? "event" : "event"}`
        : "warehouse",
    })),
  }));

  const discrepancies = (missing ?? []).map((m: any) => ({
    id: m.id,
    equipment: m.equipment?.name ?? "—",
    quantity: m.quantity,
    isCritical: m.is_critical,
    status: m.status,
    notes: m.notes,
  }));

  const b = statusBadge(event.status);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <PageHeader
          icon="assignment"
          back={{ href: "/warehouse/requests", label: "Requests" }}
          title={event.name}
          sub={<>{event.client ? `${event.client} · ` : ""}{event.location ?? ""} · live {fmtDMY(event.live_start)}</>}
          action={<span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 ${b.cls}`}>{b.label}</span>}
        />
      </div>

      <PrepBoard eventId={id} status={event.status} lines={shaped} discrepancies={discrepancies} />
    </div>
  );
}
