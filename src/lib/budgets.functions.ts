import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function currentMonthDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ month: z.string().optional() }).parse(i ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const month = data.month ?? currentMonthDate();
    const monthStart = month;
    const d = new Date(month);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);

    const [{ data: budgets }, { data: txs }, { data: categories }] = await Promise.all([
      supabase
        .from("budgets")
        .select("id,category_id,amount,month")
        .eq("user_id", userId)
        .eq("month", monthStart),
      supabase
        .from("transactions")
        .select("category_id,amount")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("occurred_at", monthStart)
        .lt("occurred_at", nextMonth),
      supabase
        .from("categories")
        .select("id,name,icon")
        .or(`is_default.eq.true,user_id.eq.${userId}`),
    ]);

    const spent: Record<string, number> = {};
    for (const t of txs ?? []) {
      if (!t.category_id) continue;
      spent[t.category_id] = (spent[t.category_id] ?? 0) + Number(t.amount);
    }

    const items = (budgets ?? []).map((b) => {
      const cat = categories?.find((c) => c.id === b.category_id);
      const spentVal = spent[b.category_id] ?? 0;
      const limit = Number(b.amount);
      const pct = limit > 0 ? Math.min(999, (spentVal / limit) * 100) : 0;
      return {
        id: b.id,
        category_id: b.category_id,
        category_name: cat?.name ?? "—",
        category_icon: cat?.icon ?? null,
        amount: limit,
        spent: spentVal,
        pct,
        month: b.month,
      };
    });

    return { month: monthStart, items, categories: categories ?? [] };
  });

export const upsertBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        category_id: z.string().uuid(),
        amount: z.number().positive(),
        month: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const month = data.month ?? currentMonthDate();
    const { error } = await supabase
      .from("budgets")
      .upsert(
        { user_id: userId, category_id: data.category_id, month, amount: data.amount, alert_80_sent_at: null, alert_100_sent_at: null },
        { onConflict: "user_id,category_id,month" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("budgets").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
