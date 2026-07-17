import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/ui";
import PageHeader from "@/components/PageHeader";

export default async function UsersPage() {
  const profile = await getProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("app_users")
    .select("username,full_name,role,is_active")
    .order("role", { ascending: true });
  const users = data ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="reveal" style={{ animationDelay: ".06s" }}>
        <PageHeader icon="group" title="Users" sub={`${users.length} accounts`} />
      </div>

      <div className="card glass rounded-2xl divide-y divide-white/5 reveal" style={{ animationDelay: ".12s" }}>
        {users.map((u) => (
          <div key={u.username} className="row flex items-center justify-between px-5 py-3.5">
            <div>
              <div className="font-semibold">{u.full_name}</div>
              <div className="text-xs text-slate-500">{u.username}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/30 text-xs font-semibold">
                {ROLE_LABEL[u.role] ?? u.role}
              </span>
              {u.is_active
                ? <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />active</span>
                : <span className="text-slate-500 text-xs font-semibold">inactive</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
