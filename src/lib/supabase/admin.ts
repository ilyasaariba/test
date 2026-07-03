import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client. SERVER-ONLY — bypasses RLS and unlocks the auth
// admin API (e.g. creating technician accounts). Never import this into a client
// component, and never expose the key with a NEXT_PUBLIC_ prefix.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
