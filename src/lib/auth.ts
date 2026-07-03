// Login uses name + password only — no email shown to the user.
// Under the hood we map the username to a hidden email so Supabase Auth
// (secure sessions + RLS) works normally.
export const EMAIL_DOMAIN = "avlogistics.local";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export type AppRole =
  | "engineer"
  | "warehouse_manager"
  | "technician"
  | "boss"
  | "admin";
