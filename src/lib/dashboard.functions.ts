import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Materialize due recurrences first
    await supabase.rpc("materialize_due_recurrences", { _user_id: userId });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const from30 = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);

    const [{ data: monthTxs }, { data: dayTxs }, { data: recentTxs }, { data: goalsData }] = await Promise.all([
      supabase
        .from("transactions")
        .select("type,amount,categories(name,icon)")
        .eq("user_id", userId)
        .gte("occurred_at", monthStart),
      supabase
        .from("transactions")
        .select("type,amount,occurred_at")
        .eq("user_id", userId)
        .gte("occurred_at", from30)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("transactions")
        .select("id,type,amount,description,occurred_at,categories(name,icon)")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("goals")
        .select("id,name,target_amount,current_amount,status,deadline")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

    let income = 0, expense = 0;
    const byCategory: Record<string, number> = {};
    for (const t of monthTxs ?? []) {
      const v = Number(t.amount);
      if (t.type === "income") income += v;
      else if (t.type === "expense") {
        expense += v;
        const cn = (t.categories as { name?: string } | null)?.name ?? "Outros";
        byCategory[cn] = (byCategory[cn] ?? 0) + v;
      }
    }
    const byCategoryArr = Object.entries(byCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // build 30-day series
    const seriesMap: Record<string, { date: string; income: number; expense: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10);
      seriesMap[d] = { date: d, income: 0, expense: 0 };
    }
    for (const t of dayTxs ?? []) {
      const key = t.occurred_at as string;
      if (!seriesMap[key]) continue;
      const v = Number(t.amount);
      if (t.type === "income") seriesMap[key].income += v;
      else if (t.type === "expense") seriesMap[key].expense += v;
    }
    const series = Object.values(seriesMap);

    return {
      month: { income, expense, balance: income - expense },
      byCategory: byCategoryArr,
      series,
      recent: recentTxs ?? [],
      goals: goalsData ?? [],
    };
  });
