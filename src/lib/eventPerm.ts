import "server-only";
import { createClient } from "@/lib/supabase/server";

type SB = Awaited<ReturnType<typeof createClient>>;

// An "event lead" is a crew member the engineer delegated full authority to for
// ONE event — they may act as the engineer for that event (source gear, run the
// lifecycle, edit/cancel, manage transfers & tasks). Engineers/admins are always
// privileged regardless of this flag.
export async function isEventLead(sb: SB, eventId: string, userId: string): Promise<boolean> {
  const { data } = await sb
    .from("event_technicians")
    .select("is_lead")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data?.is_lead;
}

// Can this profile act as the engineer for this event (by role, or by delegation)?
export async function canManageEvent(
  sb: SB,
  eventId: string,
  profile: { id: string; role: string },
): Promise<boolean> {
  if (profile.role === "engineer" || profile.role === "admin") return true;
  return isEventLead(sb, eventId, profile.id);
}
