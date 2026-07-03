import { redirect } from "next/navigation";

// Entry point: the middleware decides login vs. dashboard based on the session.
export default function Home() {
  redirect("/dashboard");
}
