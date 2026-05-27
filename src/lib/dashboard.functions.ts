import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PERIODS = ["month", "3m", "year", "all"] as const;
export type DashboardPeriod = (typeof PERIODS)[number];

const inputSchema = z.object({
  period: z.enum(PERIODS).default("month"),
  accountId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
});

function startDateFor(period: DashboardPeriod): string | null {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  if (period === "3m") {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return d.toISOString().slice(0, 10);
  }
  if (period === "year") return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  return null;
}

function bucketFor(period: DashboardPeriod, date: string): string {
  // For month/3m use daily buckets; for year/all use monthly buckets (YYYY-MM)
  if (period === "month" || period === "3m") return date;
  return date.slice(0, 7);
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => inputSchema.parse(i ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { period, accountId, categoryId } = data;

    await supabase.rpc("materialize_due_recurrences", { _user_id: userId });

    const periodStart = startDateFor(period);

    const baseTx = () => {
      let q = supabase.from("transactions").select("type,amount,categories(name,icon)").eq("user_id", userId);
      if (periodStart) q = q.gte("occurred_at", periodStart);
      if (accountId) q = q.eq("account_id", accountId);
      if (categoryId) q = q.eq("category_id", categoryId);
      return q;
    };
    const baseSeries = () => {
      let q = supabase.from("transactions").select("type,amount,occurred_at").eq("user_id", userId);
      if (periodStart) q = q.gte("occurred_at", periodStart);
      if (accountId) q = q.eq("account_id", accountId);
      if (categoryId) q = q.eq("category_id", categoryId);
      return q.order("occurred_at", { ascending: true });
    };
    const baseRecent = () => {
      let q = supabase
        .from("transactions")
        .select("id,type,amount,description,occurred_at,categories(name,icon)")
        .eq("user_id", userId);
      if (periodStart) q = q.gte("occurred_at", periodStart);
      if (accountId) q = q.eq("account_id", accountId);
      if (categoryId) q = q.eq("category_id", categoryId);
      return q.order("occurred_at", { ascending: false }).order("created_at", { ascending: false }).limit(10);
    };

    const [{ data: periodTxs }, { data: dayTxs }, { data: recentTxs }, { data: goalsData }] = await Promise.all([
      baseTx(),
      baseSeries(),
      baseRecent(),
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
    for (const t of periodTxs ?? []) {
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

    // Build series with buckets adapted to the selected period
    const seriesMap: Record<string, { date: string; income: number; expense: number }> = {};
    for (const t of dayTxs ?? []) {
      const key = bucketFor(period, t.occurred_at as string);
      if (!seriesMap[key]) seriesMap[key] = { date: key, income: 0, expense: 0 };
      const v = Number(t.amount);
      if (t.type === "income") seriesMap[key].income += v;
      else if (t.type === "expense") seriesMap[key].expense += v;
    }
    const series = Object.values(seriesMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      month: { income, expense, balance: income - expense },
      byCategory: byCategoryArr,
      series,
      recent: recentTxs ?? [],
      goals: goalsData ?? [],
    };
  });
