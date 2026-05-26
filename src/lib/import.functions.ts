import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateObject } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const ParsedTx = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(200),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggested_category: z.string().max(40).optional().nullable(),
});

const ParsedResult = z.object({
  transactions: z.array(ParsedTx).max(500),
});

export const parseStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        text: z.string().min(1).max(200_000),
        format: z.enum(["ofx", "csv", "pdf"]),
        is_credit_card: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const { data: cats } = await supabase
      .from("categories")
      .select("name")
      .or(`is_default.eq.true,user_id.eq.${userId}`);
    const catNames = (cats ?? []).map((c) => c.name);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const today = new Date().toISOString().slice(0, 10);
    const system = `Você extrai movimentações financeiras de extratos bancários e faturas de cartão brasileiros.
Regras:
- Retorne TODAS as transações no texto.
- amount sempre POSITIVO em reais.
- type: "expense" para gastos/débitos/compras; "income" para créditos/receitas/estornos/pagamentos recebidos.
${data.is_credit_card ? "- Este é uma FATURA DE CARTÃO: todas as compras são 'expense'; pagamentos da fatura e estornos são 'income'." : ""}
- occurred_at no formato YYYY-MM-DD. Se ano ausente, use o ano atual (${today.slice(0, 4)}).
- description: limpa, curta, sem códigos de transação.
- suggested_category: escolha entre [${catNames.join(", ")}] ou null.
- Ignore linhas de saldo, totais, cabeçalhos.`;

    const { object } = await generateObject({
      model,
      schema: ParsedResult,
      system,
      prompt: `Formato: ${data.format.toUpperCase()}\n\nConteúdo:\n${data.text.slice(0, 180_000)}`,
    });

    return object;
  });

export const bulkImportTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        account_id: z.string().uuid().optional().nullable(),
        transactions: z
          .array(
            z.object({
              type: z.enum(["expense", "income"]),
              amount: z.number().positive(),
              description: z.string().min(1).max(200),
              occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              category_name: z.string().max(40).optional().nullable(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: cats } = await supabase
      .from("categories")
      .select("id,name")
      .or(`is_default.eq.true,user_id.eq.${userId}`);
    const catMap = new Map<string, string>();
    for (const c of cats ?? []) catMap.set(c.name.toLowerCase(), c.id);

    const rows = data.transactions.map((t) => ({
      user_id: userId,
      type: t.type,
      amount: t.amount,
      description: t.description,
      occurred_at: t.occurred_at,
      account_id: data.account_id ?? null,
      category_id: t.category_name ? catMap.get(t.category_name.toLowerCase()) ?? null : null,
      source: "import",
    }));

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
