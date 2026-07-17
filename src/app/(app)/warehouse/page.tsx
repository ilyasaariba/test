import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import OutBadge from "./OutBadge";
import DeleteEquipmentButton from "./DeleteEquipmentButton";
import WarehouseToolbar from "./WarehouseToolbar";
import AddEquipmentForm from "./AddEquipmentForm";

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();
  const canEdit = profile.role === "admin" || profile.role === "engineer"; // catalog = Engineer/Admin

  const [{ data }, { data: allocRows }] = await Promise.all([
    supabase
      .from("equipment_availability")
      .select("equipment_id,name,category,importance,owned,committed,available")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("equipment_allocations")
      .select("quantity, event_equipment!inner(equipment_id, events!inner(name,status))")
      .eq("source", "warehouse"),
  ]);
  const equipment = data ?? [];

  // Per-item breakdown of which (active) events the gear is committed to.
  const outByEquip: Record<string, { name: string; qty: number; status: string }[]> = {};
  for (const r of allocRows ?? []) {
    const ee: any = r.event_equipment;
    const ev: any = ee?.events;
    if (!ee || !ev || ["archived", "cancelled"].includes(ev.status)) continue;
    const arr = (outByEquip[ee.equipment_id] ??= []);
    const hit = arr.find((x) => x.name === ev.name);
    if (hit) hit.qty += r.quantity ?? 0;
    else arr.push({ name: ev.name, qty: r.quantity ?? 0, status: ev.status });
  }

  const totalOwned = equipment.reduce((s: number, e: any) => s + (e.owned ?? 0), 0);
  const totalOut = equipment.reduce((s: number, e: any) => s + (e.committed ?? 0), 0);

  const ql = (q ?? "").toLowerCase();
  const shown = equipment.filter((e: any) => {
    if (ql && !`${e.name} ${e.category}`.toLowerCase().includes(ql)) return false;
    if (filter === "out") return (e.committed ?? 0) > 0;
    if (filter === "available") return (e.available ?? 0) > 0;
    if (filter === "zero") return (e.available ?? 0) <= 0;
    return true;
  });
  const filtered = !!(q || filter);

  const byCat: Record<string, any[]> = {};
  for (const e of shown) (byCat[e.category] ??= []).push(e);

  // Existing categories (with item counts) feed the add-form's picker.
  const catCounts: Record<string, number> = {};
  for (const e of equipment) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1;
  const categories = Object.entries(catCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <h1 className="text-xl font-semibold tracking-tight">Warehouse</h1>
        <p className="text-slate-400 text-sm mt-1">
          {equipment.length} items · {totalOwned.toLocaleString()} owned · <span className="text-amber-300">{totalOut.toLocaleString()} out at events</span>
        </p>
      </div>

      <WarehouseToolbar />

      {canEdit && <AddEquipmentForm categories={categories} />}

      {Object.entries(byCat).map(([cat, items], ci) => (
        <section key={cat} className="card glass rounded-2xl overflow-hidden reveal" style={{ animationDelay: `${0.14 + ci * 0.04}s` }}>
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold">{cat}</h2>
            <span className="text-xs text-slate-500">{items.length} items</span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {items.map((e: any) => {
                const out = e.committed > 0;
                return (
                  <tr key={e.equipment_id} className="row">
                    <td className="px-5 py-3">
                      <span className="font-semibold">{e.name}</span>
                      {e.importance === "critical" && (
                        <span className="ml-2 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30 text-[11px] font-semibold">critical</span>
                      )}
                    </td>
                    <td className="py-3 pr-5 text-right w-52">
                      <span className={`font-bold ${e.available <= 0 ? "text-rose-300" : ""}`}>{e.available}</span>
                      <span className="text-slate-500 text-xs"> / {e.owned} avail.</span>
                      {out && <OutBadge committed={e.committed} events={outByEquip[e.equipment_id] ?? []} />}
                    </td>
                    {canEdit && (
                      <td className="py-3 pr-4 text-right w-12 align-middle">
                        <DeleteEquipmentButton id={e.equipment_id} name={e.name} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      {!shown.length && (
        <p className="text-sm text-slate-400 text-center py-8">{filtered ? "No equipment matches your search." : "No equipment yet."}</p>
      )}
    </div>
  );
}
