"use client";

import { useState, useTransition } from "react";
import { fmtDMY } from "@/lib/ui";
import DateField from "@/components/DateField";
import {
  assignTechnician, unassignTechnician, createTechnician, createTask, removeTask, setEventLead,
} from "./actions";

type Tech = { id: string; full_name: string; username: string; isLead?: boolean };
type Task = {
  id: string; title: string; description: string | null; status: string;
  dueTime: string | null; assigneeId: string | null;
};

const inputCls = "rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";

const TASK_PILL: Record<string, { label: string; cls: string }> = {
  pending: { label: "pending", cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
  in_progress: { label: "in progress", cls: "bg-blue-500/15 text-blue-300 ring-blue-400/30" },
  sent: { label: "sent", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  received: { label: "received", cls: "bg-teal-500/15 text-teal-300 ring-teal-400/30" },
  done: { label: "done", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  cancelled: { label: "cancelled", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
};

export default function CrewBoard({
  eventId, canManage, canDelegate, assigned, allTechs, tasks,
}: {
  eventId: string;
  canManage: boolean;
  canDelegate: boolean;
  assigned: Tech[];
  allTechs: Tech[];
  tasks: Task[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // assign / create panel
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [nFull, setNFull] = useState(""); const [nUser, setNUser] = useState(""); const [nPass, setNPass] = useState("");

  // per-tech task form
  const [taskFor, setTaskFor] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState(""); const [tNote, setTNote] = useState(""); const [tDue, setTDue] = useState("");

  const assignedIds = new Set(assigned.map((a) => a.id));
  const pickable = allTechs.filter((t) => !assignedIds.has(t.id));
  const tasksFor = (techId: string) => tasks.filter((t) => t.assigneeId === techId);

  function run(fn: () => Promise<{ error: string } | void>, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r) setErr(r.error);
      else after?.();
    });
  }
  function resetAdd() { setAddOpen(false); setNFull(""); setNUser(""); setNPass(""); setMode("pick"); }
  function openTask(techId: string) { setErr(null); setTTitle(""); setTNote(""); setTDue(""); setTaskFor(techId); }

  return (
    <section className="card glass rounded-2xl reveal" style={{ animationDelay: ".24s" }}>
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="font-bold">Crew &amp; tasks</h2>
          <p className="text-xs text-slate-500 mt-0.5">Assign technicians and give them jobs — each shows on their own page.</p>
        </div>
        {canManage && (
          <button onClick={() => (addOpen ? resetAdd() : setAddOpen(true))}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold glass hover:bg-white/10 transition flex items-center gap-1 shrink-0">
            <span className="ms" style={{ fontSize: 18 }}>{addOpen ? "close" : "person_add"}</span>
            {addOpen ? "Close" : "Add technician"}
          </button>
        )}
      </div>

      {err && <div className="mx-5 mt-4 rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm">{err}</div>}

      {/* assign / create panel */}
      {canManage && addOpen && (
        <div className="mx-5 mt-4 glass rounded-xl p-3">
          <div className="flex gap-1 mb-3">
            {(["pick", "create"] as const).map((m) => (
              <button key={m} onClick={() => { setErr(null); setMode(m); }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${mode === m ? "grad text-white" : "hover:bg-white/10 text-slate-300"}`}>
                {m === "pick" ? "Choose existing" : "Create new"}
              </button>
            ))}
          </div>

          {mode === "pick" ? (
            pickable.length ? (
              <>
                <p className="text-[11px] text-slate-400 mb-2">Tap a technician to add them to this event.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {pickable.map((t) => (
                    <button key={t.id} disabled={pending}
                      onClick={() => run(() => assignTechnician(eventId, t.id), resetAdd)}
                      className="group flex items-center gap-3 rounded-xl glass px-3 py-2.5 hover:bg-white/10 hover:ring-1 hover:ring-indigo-400/30 transition text-left disabled:opacity-50">
                      <div className="h-9 w-9 rounded-lg bg-indigo-500/15 text-indigo-300 grid place-items-center font-bold shrink-0">{t.full_name.charAt(0)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{t.full_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{t.username}</div>
                      </div>
                      <span className="ms text-slate-500 group-hover:text-indigo-300 transition shrink-0" style={{ fontSize: 20 }}>add_circle</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 px-1 py-2">All technicians are already assigned — switch to <span className="text-slate-300 font-medium">Create new</span> to add one.</p>
            )
          ) : (
            <div className="flex items-end gap-2 flex-wrap">
              <div><label className="block text-[11px] text-slate-400 mb-1">Full name</label><input value={nFull} onChange={(e) => setNFull(e.target.value)} placeholder="e.g. Omar L." className={`${inputCls} w-40`} /></div>
              <div><label className="block text-[11px] text-slate-400 mb-1">Username</label><input value={nUser} onChange={(e) => setNUser(e.target.value)} placeholder="e.g. omar" className={`${inputCls} w-32`} /></div>
              <div><label className="block text-[11px] text-slate-400 mb-1">Password</label><input value={nPass} onChange={(e) => setNPass(e.target.value)} placeholder="min 6 chars" className={`${inputCls} w-32`} /></div>
              <button disabled={pending} onClick={() => run(() => createTechnician(eventId, nFull, nUser, nPass), resetAdd)}
                className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2">Create &amp; assign</button>
              <span className="text-[11px] text-slate-500 w-full">They log in with this username + password. Role: technician.</span>
            </div>
          )}
        </div>
      )}

      {/* assigned technicians + their tasks */}
      <div className="p-5 space-y-3">
        {assigned.length === 0 && <p className="text-sm text-slate-500">No crew assigned yet.</p>}

        {assigned.map((t) => {
          const myTasks = tasksFor(t.id);
          const formOpen = taskFor === t.id;
          return (
            <div key={t.id} className="rounded-xl glass p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/15 text-indigo-300 grid place-items-center font-bold shrink-0">
                    {t.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2">
                      {t.full_name}
                      {t.isLead && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/30 text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                          <span className="ms" style={{ fontSize: 12 }}>workspace_premium</span>LEAD
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{t.username} · {myTasks.length} task{myTasks.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    {canDelegate && (
                      <button onClick={() => run(() => setEventLead(eventId, t.id, !t.isLead))} disabled={pending}
                        title={t.isLead ? "Remove event-lead access" : "Make event lead — they can run this event like the engineer"}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${t.isLead ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30 hover:bg-indigo-500/30" : "glass hover:bg-white/10"}`}>
                        <span className="ms" style={{ fontSize: 16 }}>{t.isLead ? "remove_moderator" : "shield_person"}</span>
                        {t.isLead ? "Remove lead" : "Make lead"}
                      </button>
                    )}
                    <button onClick={() => (formOpen ? setTaskFor(null) : openTask(t.id))}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold glass hover:bg-white/10 transition flex items-center gap-1">
                      <span className="ms" style={{ fontSize: 16 }}>add_task</span> Give task
                    </button>
                    <button onClick={() => run(() => unassignTechnician(eventId, t.id))} disabled={pending}
                      title="Remove from event" className="h-8 w-8 grid place-items-center rounded-lg glass text-slate-400 hover:text-rose-300">
                      <span className="ms" style={{ fontSize: 16 }}>person_remove</span>
                    </button>
                  </div>
                )}
              </div>

              {/* this tech's tasks */}
              {myTasks.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {myTasks.map((tk) => {
                    const p = TASK_PILL[tk.status] ?? TASK_PILL.pending;
                    return (
                      <div key={tk.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{tk.title}</div>
                          {(tk.description || tk.dueTime) && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {tk.description ? tk.description : ""}{tk.description && tk.dueTime ? " · " : ""}{tk.dueTime ? `due ${fmtDMY(tk.dueTime)}` : ""}
                            </div>
                          )}
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${p.cls}`}>{p.label}</span>
                        {canManage && (
                          <button onClick={() => run(() => removeTask(eventId, tk.id))} disabled={pending}
                            className="ms text-slate-500 hover:text-rose-300 shrink-0" style={{ fontSize: 16 }}>close</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* give-task form */}
              {canManage && formOpen && (
                <div className="mt-3 glass rounded-xl p-3 space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[12rem]"><label className="block text-[11px] text-slate-400 mb-1">Task</label>
                      <input value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Prep & label monitor rig" className={`${inputCls} w-full`} /></div>
                    <div><label className="block text-[11px] text-slate-400 mb-1">Due date</label>
                      <DateField value={tDue} onChange={setTDue} placeholder="Due date" className="w-40" /></div>
                  </div>
                  <input value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="Note (optional)" className={`${inputCls} w-full`} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setTaskFor(null)} className="px-3 py-2 rounded-lg text-sm font-semibold glass hover:bg-white/10">Cancel</button>
                    <button disabled={pending} onClick={() => run(() => createTask(eventId, t.id, tTitle, tNote, tDue || null), () => setTaskFor(null))}
                      className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2">Assign task</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
