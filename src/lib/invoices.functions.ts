import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("credit_card_invoices")
      .select("id,account_id,reference_month,closing_date,due_date,total_amount,status,paid_at,accounts(name,color,institution)")
      .eq("user_id", userId)
      .order("due_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getInvoiceDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const [{ data: invoice, error: e1 }, { data: txs, error: e2 }] = await Promise.all([
      supabase
        .from("credit_card_invoices")
        .select("id,account_id,reference_month,closing_date,due_date,total_amount,status,paid_at,accounts(name,color,institution)")
        .eq("id", data.id)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("transactions")
        .select("id,amount,description,occurred_at,categories(name,icon)")
        .eq("invoice_id", data.id)
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { invoice, transactions: txs ?? [] };
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), paid: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("credit_card_invoices")
      .update({ status: data.paid ? "paid" : "open", paid_at: data.paid ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
