"use client";

import { useState, useTransition } from "react";
import { fmtDMY } from "@/lib/ui";
import DateField from "@/components/DateField";
import { advanceTask, editTask, cancelTask } from "./actions";

type Task = {
  id: string; title: string; description: string | null; type: string;
  status: string; eventName: string | null; assigneeName: string | null;
  dueTime: string | null; canManage: boolean;
};

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "pending", cls: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
  in_progress: { label: "in progress", cls: "bg-blue-500/15 text-blue-300 ring-blue-400/30" },
  sent: { label: "in transit", cls: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  received: { label: "received", cls: "bg-teal-500/15 text-teal-300 ring-teal-400/30" },
  done: { label: "done", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  cancelled: { label: "cancelled", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
};

const inputCls = "w-full rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500";

// The next action available to the technician for a given task.
function nextStep(type: string, status: string): { label: string; icon: string } | null {
  if (type === "transfer") {
    if (status === "pending") return { label: "Mark picked up", icon: "local_shipping" };
    if (status === "sent") return { label: "Mark delivered", icon: "check_circle" };
    return null;
  }
  if (status === "pending") return { label: "Start", icon: "play_arrow" };
  if (status === "in_progress") return { label: "Mark done", icon: "check_circle" };
  return null;
}

export default function TaskList({
  tasks, canAct, showAssignee,
}: {
  tasks: Task[];
  canAct: boolean;
  showAssignee: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // edit / cancel state (task creators only)
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eDue, setEDue] = useState("");

  function run(id: string) {
    setErr(null); setBusyId(id);
    start(async () => {
      const r = await advanceTask(id);
      if (r && "error" in r) setErr(r.error);
      setBusyId(null);
    });
  }

  function openEdit(t: Task) {
    setErr(null); setConfirmId(null);
    setEditId(t.id); setETitle(t.title); setEDesc(t.description ?? "");
    setEDue(t.dueTime ? t.dueTime.slice(0, 10) : "");
  }
  function saveEdit(id: string) {
    setErr(null);
    start(async () => {
      const r = await editTask(id, eTitle, eDesc, eDue || null);
      if (r && "error" in r) setErr(r.error); else setEditId(null);
    });
  }
  function doCancel(id: string) {
    setErr(null);
    start(async () => {
      const r = await cancelTask(id);
      if (r && "error" in r) setErr(r.error); else { setConfirmId(null); setEditId(null); }
    });
  }

  if (!tasks.length) {
    return (
      <div className="card glass rounded-2xl px-5 py-10 text-center reveal" style={{ animationDelay: ".12s" }}>
        <p className="text-sm text-slate-300 font-medium">No tasks yet.</p>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          When the Engineer assigns a technician a job — e.g. split/distribute gear on-site, or carry out an equipment transfer between events — it shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {err && <div className="rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3 py-2 text-sm reveal">{err}</div>}
      <div className="card glass rounded-2xl divide-y divide-white/5 reveal" style={{ animationDelay: ".12s" }}>
        {tasks.map((t) => {
          const st = TASK_STATUS[t.status] ?? TASK_STATUS.pending;
          const step = canAct ? nextStep(t.type, t.status) : null;
          const done = t.status === "done";
          const closed = t.status === "done" || t.status === "cancelled";
          const manage = t.canManage && !closed;
          return (
            <div key={t.id}>
              <div className="row flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {t.type === "transfer" && (
                      <span className="px-2 py-0.5 rounded-md bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30 text-xs font-bold">⇄ TRANSFER</span>
                    )}
                    <span className={`font-semibold ${closed ? "line-through text-slate-400" : ""}`}>{t.title}</span>
                  </div>
                  {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    {t.eventName ? `${t.eventName} · ` : ""}
                    {showAssignee && t.assigneeName ? `${t.assigneeName} · ` : ""}
                    due {fmtDMY(t.dueTime)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                  {step && (
                    <button
                      disabled={pending}
                      onClick={() => run(t.id)}
                      className="btn-primary grad text-white text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-50">
                      <span className="ms" style={{ fontSize: 16 }}>{busyId === t.id && pending ? "hourglass_empty" : step.icon}</span>
                      {step.label}
                    </button>
                  )}
                  {canAct && done && <span className="ms text-emerald-400" style={{ fontSize: 20 }}>task_alt</span>}
                  {manage && (
                    <button onClick={() => (editId === t.id ? setEditId(null) : openEdit(t))} title="Edit / cancel"
                      className="h-8 w-8 grid place-items-center rounded-lg glass text-slate-300 hover:text-white hover:bg-white/10 transition">
                      <span className="ms" style={{ fontSize: 18 }}>more_horiz</span>
                    </button>
                  )}
                </div>
              </div>

              {manage && editId === t.id && (
                <div className="px-5 pb-4 -mt-1">
                  <div className="glass rounded-xl p-3 space-y-2">
                    <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Task title" className={inputCls} />
                    <input value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Description (optional)" className={inputCls} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <DateField value={eDue} onChange={setEDue} placeholder="Due date" />
                      <button disabled={pending} onClick={() => saveEdit(t.id)}
                        className="btn-primary grad text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-50">Save</button>
                      <button onClick={() => setEditId(null)} className="px-3 py-2 rounded-lg text-sm font-semibold glass hover:bg-white/10">Close</button>
                      <span className="flex-1" />
                      {confirmId === t.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Cancel this task?</span>
                          <button disabled={pending} onClick={() => doCancel(t.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/30 transition disabled:opacity-50">
                            {pending ? "Cancelling…" : "Yes, cancel"}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold glass hover:bg-white/10">Keep</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(t.id)}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-rose-300 hover:bg-rose-500/10 transition">
                          <span className="ms" style={{ fontSize: 16 }}>cancel</span> Cancel task
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
