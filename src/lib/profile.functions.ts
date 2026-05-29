import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Delete all user-owned rows (no FK cascade configured)
    const tables = ["messages", "threads", "transactions", "recurrences", "goals", "accounts", "categories", "profiles"] as const;
    for (const t of tables) {
      const col = t === "profiles" ? "id" : "user_id";
      const { error } = await supabaseAdmin.from(t).delete().eq(col, userId);
      if (error) throw new Error(`Falha ao limpar ${t}: ${error.message}`);
    }
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(authErr.message);
    return { ok: true };
  });
