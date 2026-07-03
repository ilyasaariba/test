import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import EditEventForm from "./EditEventForm";

const CLOSED = ["archived", "cancelled"];
const ymd = (d: string | null) => (d ? d.slice(0, 10) : "");

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (profile.role !== "engineer" && profile.role !== "admin") redirect(`/events/${id}`);
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();
  if (CLOSED.includes(event.status)) redirect(`/events/${id}`);

  return (
    <EditEventForm
      eventId={id}
      initial={{
        name: event.name ?? "",
        client: event.client ?? "",
        location: event.location ?? "",
        notes: event.notes ?? "",
        montage_start: ymd(event.montage_start),
        live_start: ymd(event.live_start),
        live_end: ymd(event.live_end),
        demontage_end: ymd(event.demontage_end),
      }}
    />
  );
}
