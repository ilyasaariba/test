// Recreate the test login accounts. Fetches the service_role key via the
// Supabase Management API (PAT from ../.mcp.json), then creates auth users;
// the handle_new_user trigger turns each into an app_users row with its role.
// Run: node scripts/seed-accounts.mjs   (from the av-logistics folder)
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const REF = "flqvpudrdrflezgfaeio";
const SUPA_URL = `https://${REF}.supabase.co`;

const mcp = JSON.parse(await readFile(new URL("../../.mcp.json", import.meta.url), "utf8"));
const pat = mcp?.mcpServers?.supabase?.env?.SUPABASE_ACCESS_TOKEN;
if (!pat) { console.error("No SUPABASE_ACCESS_TOKEN in .mcp.json"); process.exit(1); }

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${pat}` },
});
const keys = await r.json();
const service = Array.isArray(keys) ? keys.find((k) => k.name === "service_role")?.api_key : null;
if (!service) { console.error("No service_role key. Got:", JSON.stringify(keys).slice(0, 200)); process.exit(1); }

const db = createClient(SUPA_URL, service, { auth: { persistSession: false } });
const DOMAIN = "avlogistics.local";
const accounts = [
  { u: "admin",   f: "System Admin", r: "admin",             p: "Admin@123" },
  { u: "sami",    f: "Sami A.",      r: "engineer",          p: "Engineer@123" },
  { u: "hassan",  f: "Hassan M.",    r: "warehouse_manager", p: "Warehouse@123" },
  { u: "karim",   f: "Karim B.",     r: "technician",        p: "Tech@123" },
  { u: "youssef", f: "Youssef R.",   r: "technician",        p: "Tech2@123" },
  { u: "driss",   f: "Driss (Boss)", r: "boss",              p: "Boss@123" },
];

for (const a of accounts) {
  const { error } = await db.auth.admin.createUser({
    email: `${a.u}@${DOMAIN}`,
    password: a.p,
    email_confirm: true,
    user_metadata: { username: a.u, full_name: a.f, role: a.r },
  });
  console.log(error ? `⚠️  ${a.u}: ${error.message}` : `✅ ${a.u.padEnd(8)} ${a.r}`);
}
console.log("\nDone.");
