import { login } from "./actions";
import PasswordInput from "./PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="glass p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="h-10 w-10 rounded-lg grad grid place-items-center font-bold text-[13px] tracking-tight shrink-0">
              M212
            </div>
            <div>
              <div className="font-bold text-[17px] leading-tight">M212 Logistics</div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-[var(--faint)]">
                Operations Platform
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-[var(--crit-soft)] text-[var(--crit)] border border-[var(--crit)]/30 px-3.5 py-2.5 text-sm font-medium">
              {error}
            </div>
          )}

          <form action={login} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--sub)] mb-1.5">Name</label>
              <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 focus-within:border-[var(--accent-hex)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
                <span className="ms text-[var(--faint)]" style={{ fontSize: 19 }}>person</span>
                <input name="username" type="text" autoComplete="off" autoCorrect="off" spellCheck={false}
                  data-lpignore="true" data-1p-ignore="true" placeholder="e.g. sami"
                  className="bg-transparent outline-none text-sm w-full placeholder:text-[var(--faint)]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--sub)] mb-1.5">Password</label>
              <PasswordInput />
            </div>
            <button type="submit"
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              Sign in
            </button>
          </form>

          <p className="text-xs text-[var(--faint)] mt-6 text-center">
            Access is provisioned by your administrator.
          </p>
        </div>

        <p className="text-xs text-[var(--faint)] mt-5 text-center">
          © 2026 M212 Logistics
        </p>
      </div>
    </div>
  );
}
