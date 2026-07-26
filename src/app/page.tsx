import { redirect } from "next/navigation";
import { defaultAuthenticatedRoute } from "@/config/navigation";
import { getSessionUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getSessionUser();

  if (user) {
    redirect(defaultAuthenticatedRoute);
  }

  redirect("/login");
}
