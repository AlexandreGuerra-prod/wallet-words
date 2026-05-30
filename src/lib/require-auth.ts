import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Use inside a route's `beforeLoad` to gate it behind an authenticated session.
// Prevents protected serverFns from firing (and 401'ing) when the user is logged out.
export async function requireAuth() {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/login" });
}
