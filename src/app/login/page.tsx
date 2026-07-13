import { login } from "./actions";
import PasswordInput from "./PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative min-h-screen grid place-items-center px-4 overflow-hidden">
      <div className="aurora"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /></div>
      <div className="grid-fx" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-7 reveal" style={{ animationDelay: ".05s" }}>
          <div className="h-16 w-16 rounded-3xl grad grid place-items-center text-white font-black text-xl tracking-tight shadow-2xl shadow-violet-700/40">
            M212
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-4">
            M212 <span className="grad-text">Logistics</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Every cable. Every speaker. Every event.</p>
        </div>

        {/* Card */}
        <div className="card glass rounded-3xl p-7 reveal" style={{ animationDelay: ".18s" }}>
          <h2 className="text-lg font-bold">Welcome back</h2>
          <p className="text-slate-400 text-sm mt-1">Sign in with the name &amp; password you were given.</p>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30 px-3.5 py-2.5 text-sm font-medium">
              {error}
            </div>
          )}

          <form action={login} autoComplete="off" className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Name</label>
              <div className="flex items-center gap-2 glass rounded-xl px-3.5 py-2.5">
                <span className="ms text-slate-400" style={{ fontSize: 20 }}>person</span>
                <input name="username" type="text" autoComplete="off" autoCorrect="off" spellCheck={false}
                  data-lpignore="true" data-1p-ignore="true" placeholder="e.g. sami"
                  className="bg-transparent outline-none text-sm w-full placeholder:text-slate-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Password</label>
              <PasswordInput />
            </div>
            <button type="submit"
              className="btn-primary grad w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2">
              Sign in <span className="ms" style={{ fontSize: 18 }}>arrow_forward</span>
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-500 mt-6 text-center reveal" style={{ animationDelay: ".28s" }}>
          No account? Ask your engineer or admin to create one.
        </p>
      </div>
    </div>
  );
}
