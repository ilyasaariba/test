import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { eventBadge, isOverdue, scheduledEnd, fmtDMY } from "@/lib/ui";
import EquipmentBoard from "./EquipmentBoard";
import CrewBoard from "./CrewBoard";
import LifecycleBar from "./LifecycleBar";
import EventActions from "./EventActions";
import TransferActions from "./TransferActions";
import DeclareMissing from "@/components/DeclareMissing";
import ReceiveBoard from "./ReceiveBoard";
import TeardownBoard from "./TeardownBoard";
import RequestEquipment from "./RequestEquipment";
import IncomingArrivals from "./IncomingArrivals";

const GEAR_OUT = ["received_on_site", "in_progress", "returning", "reconciliation"];

const EDITABLE = ["draft", "sent_to_warehouse", "prepared"];
const CLOSED = ["archived", "cancelled"];

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  const [{ data: lines }, { data: techs }, { data: transfers }, { data: allEvents }, { data: catalog }, { data: allTechs }, { data: taskRows }] =
    await Promise.all([
      supabase.from("event_equipment")
        .select("id,quantity,tech_confirmed,packed, equipment(id,name,importance), equipment_allocations(id,source,quantity, rentals(lender_name), transfers(from_event_id))")
        .eq("event_id", id),
      supabase.from("event_technicians").select("user_id,is_lead, app_users(id,full_name,username)").eq("event_id", id),
      supabase.from("transfers").select("id,quantity,status,scheduled_time,from_event_id,to_event_id,created_by, equipment(name)").or(`from_event_id.eq.${id},to_event_id.eq.${id}`),
      supabase.from("events").select("id,name,status,live_start,live_end"),
      supabase.from("equipment_availability").select("equipment_id,name,category,available"),
      supabase.from("app_users").select("id,full_name,username").eq("role", "technician").eq("is_active", true).order("full_name"),
      supabase.from("tasks").select("id,title,description,status,due_time,assigned_to").eq("event_id", id).order("due_time", { ascending: true }),
    ]);

  const b = eventBadge(event);
  const teardownStarted = !!event.teardown_started_at;
  const overdue = isOverdue(event);
  const overdueEnd = overdue ? scheduledEnd(event) : null;
  const overdueLabel = overdueEnd ? fmtDMY(new Date(overdueEnd).toISOString()) : null;
  const eventNames: Record<string, string> = Object.fromEntries((allEvents ?? []).map((e: any) => [e.id, e.name]));
  const nameOf = (eid: string) => eventNames[eid] ?? "—";

  const shapedLines = (lines ?? []).map((l: any) => ({
    id: l.id,
    equipmentId: l.equipment?.id,
    name: l.equipment?.name ?? "—",
    importance: l.equipment?.importance ?? "normal",
    quantity: l.quantity,
    confirmed: !!l.tech_confirmed,
    packed: !!l.packed,
    allocations: (l.equipment_allocations ?? []).map((a: any) => ({
      id: a.id,
      // units tagged with a transfer from another event show as "transfer ← A";
      // a warehouse top-up (transfer with no source event) is just a warehouse chip.
      source: a.transfers ? (a.transfers.from_event_id ? "transfer" : "warehouse") : a.source,
      quantity: a.quantity,
      lender: a.rentals?.lender_name ?? null,
      fromEventId: a.transfers?.from_event_id ?? null,
    })),
  }));

  const cat = (catalog ?? []).map((c: any) => ({ id: c.equipment_id, name: c.name, category: c.category, available: c.available }));

  // Transfer flow: which active events hold each item (to request from), plus this
  // event's pending outgoing requests and incoming requests to approve.
  const [{ data: whHolders }, { data: outgoingRows }, { data: lentRows }, { data: arrivalRows }, { data: crewRows }] = await Promise.all([
    supabase.from("equipment_allocations")
      .select("quantity,returned_quantity, event_equipment!inner(equipment_id, events!inner(id,name,status))")
      .eq("source", "warehouse"),
    supabase.from("transfers").select("equipment_id,quantity,from_event_name")
      .eq("to_event_id", id).eq("status", "requested"),
    supabase.from("transfers").select("equipment_id,quantity,to_event_name")
      .eq("from_event_id", id).in("status", ["sent", "received", "completed"]),
    supabase.from("transfers").select("id,quantity,equipment_name,from_event_name,note")
      .eq("to_event_id", id).eq("status", "sent").order("created_at", { ascending: false }),
    supabase.from("event_technicians").select("event_id, app_users(id,full_name,username)"),
  ]);

  // Crew per event — so a transfer can only be assigned to the source event's own crew.
  const crewByEvent: Record<string, { id: string; full_name: string }[]> = {};
  for (const r of crewRows ?? []) {
    const u: any = (r as any).app_users; const evId = (r as any).event_id;
    if (!u || !evId) continue;
    (crewByEvent[evId] ??= []).push({ id: u.id, full_name: u.full_name ?? u.username ?? "—" });
  }

  const holdersByEquip: Record<string, { id: string; name: string; qty: number }[]> = {};
  for (const r of whHolders ?? []) {
    const ee: any = (r as any).event_equipment; const ev: any = ee?.events;
    if (!ee || !ev || ev.id === id || ["archived", "cancelled"].includes(ev.status)) continue;
    const q = Math.max(0, ((r as any).quantity ?? 0) - ((r as any).returned_quantity ?? 0));
    if (q <= 0) continue;
    const arr = (holdersByEquip[ee.equipment_id] ??= []);
    const hit = arr.find((x) => x.id === ev.id);
    if (hit) hit.qty += q; else arr.push({ id: ev.id, name: ev.name, qty: q });
  }
  const pendingByEquip: Record<string, { fromEventName: string; quantity: number }[]> = {};
  for (const t of outgoingRows ?? []) {
    (pendingByEquip[(t as any).equipment_id] ??= []).push({ fromEventName: (t as any).from_event_name ?? "event", quantity: (t as any).quantity });
  }
  // What this event has lent out to others (source side) — shown as "N lent → B".
  const lentByEquip: Record<string, { toEventName: string; quantity: number }[]> = {};
  for (const t of lentRows ?? []) {
    (lentByEquip[(t as any).equipment_id] ??= []).push({ toEventName: (t as any).to_event_name ?? "event", quantity: (t as any).quantity });
  }
  // Gear in transit TO this event, awaiting an arrival confirmation.
  const arrivals = (arrivalRows ?? []).map((t: any) => ({
    id: t.id, equipmentName: t.equipment_name ?? "gear", quantity: t.quantity,
    fromName: t.from_event_name ?? "Warehouse", note: t.note ?? null,
  }));

  const assignedTechs = (techs ?? []).map((t: any) => ({
    id: t.user_id,
    full_name: t.app_users?.full_name ?? t.app_users?.username ?? "—",
    username: t.app_users?.username ?? "",
    isLead: !!t.is_lead,
  }));
  const allTechnicians = (allTechs ?? []).map((t: any) => ({ id: t.id, full_name: t.full_name, username: t.username }));
  const eventTasks = (taskRows ?? []).map((t: any) => ({
    id: t.id, title: t.title, description: t.description, status: t.status,
    dueTime: t.due_time, assigneeId: t.assigned_to,
  }));

  // Delegated authority: an engineer/admin OR a crew member marked as this event's lead
  // may act as the engineer for this event.
  const isEngineerOrAdmin = profile.role === "engineer" || profile.role === "admin";
  const viewerIsLead = assignedTechs.some((t) => t.id === profile.id && t.isLead);
  const canManage = isEngineerOrAdmin || viewerIsLead;
  const editable = canManage && EDITABLE.includes(event.status);
  const canManageCrew = canManage && !CLOSED.includes(event.status);

  return (
    <div className="max-w-4xl space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <Link href="/events" className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 w-fit">
          <span className="ms" style={{ fontSize: 16 }}>arrow_back</span> Events
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{event.name}</h1>
            <p className="text-slate-400 text-sm mt-1">{event.client ? `${event.client} · ` : ""}{event.location ?? ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {viewerIsLead && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold ring-1 bg-indigo-500/15 text-indigo-200 ring-indigo-400/30 flex items-center gap-1">
                <span className="ms" style={{ fontSize: 14 }}>workspace_premium</span> You lead this
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 flex items-center gap-1.5 ${b.cls}`}>
              {b.live && <span className="h-1.5 w-1.5 rounded-full bg-violet-300 dot-live" />}{b.label}
            </span>
            {canManage && !CLOSED.includes(event.status) && (
              <EventActions eventId={id} />
            )}
          </div>
        </div>
      </div>

      {/* lifecycle: request → prepare → ship → received → live */}
      <LifecycleBar eventId={id} role={profile.role} status={event.status} shipper={event.shipper} isLead={viewerIsLead} overdue={overdue} overdueLabel={overdueLabel} teardownStarted={teardownStarted} />

      {/* gear in transit to this event — confirm on arrival (two-sided) */}
      {canManage && <IncomingArrivals arrivals={arrivals} />}

      {/* receiving checklist — the engineer/lead checks gear in on arrival */}
      {canManage && event.status === "shipped" && (
        <ReceiveBoard
          eventId={id}
          shipper={event.shipper}
          lines={shapedLines.map((l: any) => ({
            id: l.id, equipmentId: l.equipmentId, name: l.name, importance: l.importance, quantity: l.quantity, confirmed: l.confirmed,
          }))}
        />
      )}

      {/* teardown / démontage pack-down — engineer/lead packs the gear to ship back */}
      {canManage && event.status === "in_progress" && teardownStarted && (
        <TeardownBoard
          eventId={id}
          lines={shapedLines.map((l: any) => ({
            id: l.id, equipmentId: l.equipmentId, name: l.name, importance: l.importance, quantity: l.quantity, packed: l.packed,
          }))}
        />
      )}

      {/* timeline */}
      <div className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".12s" }}>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2"><span>MONTAGE</span><span>LIVE</span><span>DÉMONTAGE</span></div>
        <div className="flex items-center gap-1">
          <div className="h-2 rounded-full bg-indigo-500/40 flex-1" /><div className="h-2 rounded-full grad flex-[2]" /><div className="h-2 rounded-full bg-slate-500/40 flex-1" />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
          <span>{fmtDMY(event.montage_start)}</span><span>{fmtDMY(event.live_start)} → {fmtDMY(event.live_end)}</span><span>{fmtDMY(event.demontage_end)}</span>
        </div>
      </div>

      {/* interactive equipment + sourcing */}
      <EquipmentBoard
        eventId={id}
        editable={editable}
        lines={shapedLines}
        catalog={cat}
        eventNames={eventNames}
        pendingByEquip={pendingByEquip}
        lentByEquip={lentByEquip}
      />
      {!editable && (
        <p className="text-xs text-slate-500 -mt-2 px-1">Direct sourcing is locked — use <span className="text-indigo-300">Request equipment</span> below to pull more mid-event{profile.role === "boss" ? " (read-only role)" : ""}.</p>
      )}

      {/* request more gear — from another event or the warehouse — in any live stage */}
      {canManage && !CLOSED.includes(event.status) && (
        <RequestEquipment
          eventId={id}
          catalog={cat}
          holdersByEquip={holdersByEquip}
          crewByEvent={crewByEvent}
        />
      )}

      {/* Declare missing / lost gear — once the kit has left the warehouse, the
          engineer or the event lead can flag anything lost in transit or on site. */}
      {canManage && GEAR_OUT.includes(event.status) && shapedLines.length > 0 && (
        <section className="card glass rounded-2xl p-5 reveal" style={{ animationDelay: ".27s" }}>
          <div className="flex items-center gap-2">
            <span className="ms text-rose-300" style={{ fontSize: 18 }}>report</span>
            <h2 className="font-bold">Missing or lost gear</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">Lost by the driver, on site, or damaged? Declare it — it's tracked on the Missing page and must be reconciled before closing.</p>
          <DeclareMissing
            equipment={shapedLines.map((l: any) => ({ id: l.equipmentId, name: l.name, importance: l.importance }))}
            fixedEvent={{ id, name: event.name }}
            defaultPhase={event.status === "shipped" ? "transit" : "event"}
            buttonLabel="Declare missing / lost"
          />
        </section>
      )}

      <CrewBoard
        eventId={id}
        canManage={canManageCrew}
        canDelegate={isEngineerOrAdmin && !CLOSED.includes(event.status)}
        assigned={assignedTechs}
        allTechs={allTechnicians}
        tasks={eventTasks}
      />

      <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".3s" }}>
          <div className="px-5 py-4 border-b border-white/10 font-bold">Transfer record</div>
          <div className="p-5 space-y-2">
            {(transfers ?? []).length ? (transfers ?? []).map((t: any) => {
              const outgoing = t.from_event_id === id;
              const canEdit = (canManage || t.created_by === profile.id) && !["completed", "cancelled"].includes(t.status);
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl glass p-3">
                  <div className="h-9 w-9 rounded-lg bg-fuchsia-500/15 text-fuchsia-300 grid place-items-center font-bold">⇄</div>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">{t.quantity}× {t.equipment?.name} — {outgoing ? "to" : "from"} {nameOf(outgoing ? t.to_event_id : t.from_event_id)}</p>
                    <p className="text-xs text-slate-500">{outgoing ? "outgoing" : "incoming"} · {fmtDMY(t.scheduled_time)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${t.status === "cancelled" ? "bg-rose-500/15 text-rose-300 ring-rose-400/30" : "bg-amber-500/15 text-amber-300 ring-amber-400/30"}`}>{t.status}</span>
                  {canEdit && (
                    <TransferActions
                      transferId={t.id}
                      quantity={t.quantity}
                      scheduledTime={t.scheduled_time ? String(t.scheduled_time).slice(0, 10) : null}
                    />
                  )}
                </div>
              );
            }) : <p className="text-sm text-slate-500">No transfers.</p>}
          </div>
        </section>
    </div>
  );
}
