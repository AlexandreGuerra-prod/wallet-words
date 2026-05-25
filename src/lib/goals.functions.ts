import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("goals")
      .select("id,name,target_amount,current_amount,deadline,status,category_id,categories(name,icon)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        name: z.string().min(1).max(100),
        target_amount: z.number().positive(),
        current_amount: z.number().nonnegative().default(0),
        deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        category_id: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("goals")
      .insert({ ...data, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const addGoalProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), amount: z.number() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("goals")
      .select("current_amount,target_amount")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!g) throw new Error("Meta não encontrada");
    const next = Math.max(0, Number(g.current_amount) + data.amount);
    const status = next >= Number(g.target_amount) ? "completed" : "active";
    const { error } = await supabase
      .from("goals")
      .update({ current_amount: next, status })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, current_amount: next, status };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("goals").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
