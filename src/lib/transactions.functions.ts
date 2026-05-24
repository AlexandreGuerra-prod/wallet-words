import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("transactions")
      .select("id,type,amount,description,occurred_at,category_id,categories(name,icon)")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const summaryServerFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("transactions")
      .select("type,amount")
      .eq("user_id", userId)
      .gte("occurred_at", start);
    if (error) throw new Error(error.message);
    let income = 0, expense = 0;
    for (const t of data ?? []) {
      const v = Number(t.amount);
      if (t.type === "income") income += v;
      else if (t.type === "expense") expense += v;
    }
    return { income, expense, balance: income - expense };
  });
