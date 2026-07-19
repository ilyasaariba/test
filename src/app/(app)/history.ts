"use server";

import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export type HistoryItem = {
  id: string;
  icon: string;
  tone: string;   // classes for the icon tile
  title: string;
  detail: string | null;
  at: string;     // ISO timestamp of when it was completed
};

// Everything that got finished in the last 24 hours, across the app — done
// tasks, delivered/refused transfers, resolved missing gear, archived events.
// Fetched on demand (when the user opens the History panel), so it costs
// nothing on a normal page load.
export async function getPageHistory(): Promise<HistoryItem[]> {
  const profile = await getProfile();
  const sb = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // technicians only see their own completed tasks; everyone sees the rest
  let doneTasks = sb.from("tasks")
    .select("id,title,type,done_at, events(name)")
    .eq("status", "done").gte("done_at", since).order("done_at", { ascending: false }).limit(40);
  if (profile.role === "technician") doneTasks = doneTasks.eq("assigned_to", profile.id);

  const [tasksRes, trDone, trRej, missRes, archRes] = await Promise.all([
    doneTasks,
    sb.from("transfers")
      .select("id,equipment_name,quantity,requested_quantity,from_event_id,from_event_name,to_event_name,received_at")
      .eq("status", "completed").gte("received_at", since).order("received_at", { ascending: false }).limit(40),
    sb.from("transfers")
      .select("id,equipment_name,quantity,requested_quantity,from_event_name,to_event_name,status,decided_at")
      .in("status", ["refused", "cancelled"]).gte("decided_at", since).order("decided_at", { ascending: false }).limit(40),
    sb.from("missing_items")
      .select("id,quantity,status,resolved_at, equipment(name), events(name)")
      .in("status", ["found", "written_off"]).gte("resolved_at", since).order("resolved_at", { ascending: false }).limit(40),
    sb.from("event_archives")
      .select("event_name,total_units,archived_at").gte("archived_at", since).order("archived_at", { ascending: false }).limit(40),
  ]);

  const items: HistoryItem[] = [];

  for (const t of (tasksRes.data ?? []) as any[]) {
    const isTransfer = t.type === "transfer";
    items.push({
      id: `task-${t.id}`,
      icon: isTransfer ? "swap_horiz" : "task_alt",
      tone: "bg-emerald-500/15 text-emerald-300",
      title: t.title ?? "Task completed",
      detail: t.events?.name ? `${t.events.name} · task done` : "task done",
      at: t.done_at,
    });
  }

  for (const t of (trDone.data ?? []) as any[]) {
    const from = t.from_event_id ? (t.from_event_name ?? "an event") : "Warehouse";
    items.push({
      id: `tr-${t.id}`,
      icon: "local_shipping",
      tone: "bg-emerald-500/15 text-emerald-300",
      title: `${t.quantity}× ${t.equipment_name ?? "gear"} delivered`,
      detail: `${from} → ${t.to_event_name ?? "an event"}`,
      at: t.received_at,
    });
  }

  for (const t of (trRej.data ?? []) as any[]) {
    const cancelled = t.status === "cancelled";
    items.push({
      id: `tr-${t.id}`,
      icon: cancelled ? "cancel" : "block",
      tone: cancelled ? "bg-slate-500/15 text-slate-300" : "bg-rose-500/15 text-rose-300",
      title: `${t.requested_quantity ?? t.quantity}× ${t.equipment_name ?? "gear"} transfer ${cancelled ? "cancelled" : "refused"}`,
      detail: `${t.from_event_name ?? "an event"} → ${t.to_event_name ?? "an event"}`,
      at: t.decided_at,
    });
  }

  for (const m of (missRes.data ?? []) as any[]) {
    const written = m.status === "written_off";
    items.push({
      id: `miss-${m.id}`,
      icon: written ? "remove_circle" : "check_circle",
      tone: written ? "bg-slate-500/15 text-slate-300" : "bg-emerald-500/15 text-emerald-300",
      title: `${m.quantity}× ${m.equipment?.name ?? "gear"} ${written ? "written off" : "found"}`,
      detail: m.events?.name ? `${m.events.name} · missing gear resolved` : "missing gear resolved",
      at: m.resolved_at,
    });
  }

  for (const a of (archRes.data ?? []) as any[]) {
    items.push({
      id: `arch-${a.event_name}-${a.archived_at}`,
      icon: "archive",
      tone: "bg-[var(--accent-soft)] text-[var(--accent-hex)]",
      title: `${a.event_name ?? "Event"} archived`,
      detail: a.total_units != null ? `${a.total_units} units returned & closed` : "event closed",
      at: a.archived_at,
    });
  }

  return items
    .filter((it) => it.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);
}
