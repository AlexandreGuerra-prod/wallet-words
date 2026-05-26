import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatBody = { messages?: UIMessage[]; threadId?: string };

const SYSTEM_PROMPT = `Você é Finn, um agente financeiro pessoal brasileiro, amigável e direto. Você ajuda o usuário a organizar a vida financeira conversando em português, sem jargão.

Como agir:
- Quando o usuário mencionar um gasto, receita, salário, compra, pagamento ou transferência, registre IMEDIATAMENTE usando record_transaction. Se ele citar uma conta ("no Nubank", "no cartão Itaú"), passe account_name.
- Identifique: valor (em reais), tipo (income/expense/transfer), descrição curta, categoria mais provável e data (se não falar, use hoje).
- Categorias podem ser criadas com create_category quando o usuário pedir.
- Contas e cartões: use create_account / list_accounts.
- Metas: create_goal, update_goal_progress, list_goals.
- Recorrências (mensalidades, assinaturas, salário fixo): create_recurrence, list_recurrences.
- Resumo / saldo / "quanto gastei": get_summary ou list_recent.
- Após qualquer ação, confirme em UMA frase curta. Pode adicionar um insight relevante.
- Nunca julgue. Máximo 1 emoji por mensagem. Nunca peça desculpas.
- Datas no formato YYYY-MM-DD. Hoje é ${new Date().toISOString().slice(0, 10)}.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages)) return new Response("messages required", { status: 400 });
        if (!body.threadId) return new Response("threadId required", { status: 400 });
        const threadId = body.threadId;

        // verify thread ownership
        const { data: thread } = await sb
          .from("threads")
          .select("id")
          .eq("id", threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        // Persist the latest user message (last one in array)
        const last = body.messages[body.messages.length - 1];
        if (last?.role === "user") {
          await sb.from("messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: last.parts as unknown as object,
          });
          // Bump thread updated_at
          await sb.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
        }

        // Fetch categories for the tool
        const { data: cats } = await sb
          .from("categories")
          .select("id,name")
          .or(`is_default.eq.true,user_id.eq.${userId}`);
        const catList = cats ?? [];
        const catNames = catList.map((c) => c.name);

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          record_transaction: tool({
            description: "Registra uma movimentação financeira (despesa, receita ou transferência) na conta do usuário.",
            inputSchema: z.object({
              type: z.enum(["expense", "income", "transfer"]).describe("Tipo: expense=despesa/gasto, income=receita/salário, transfer=transferência entre contas"),
              amount: z.number().positive().describe("Valor em reais (positivo)"),
              description: z.string().min(1).max(200).describe("Descrição curta (ex: 'Mercado', 'Uber', 'Salário')"),
              category: z.enum(catNames as [string, ...string[]]).optional().describe("Categoria mais adequada"),
              occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data da movimentação YYYY-MM-DD"),
            }),
            execute: async ({ type, amount, description, category, occurred_at }) => {
              const cat = category ? catList.find((c) => c.name === category) : null;
              const { data, error } = await sb
                .from("transactions")
                .insert({
                  user_id: userId,
                  type,
                  amount,
                  description,
                  category_id: cat?.id ?? null,
                  occurred_at,
                  source: "chat",
                })
                .select("id,type,amount,description,occurred_at")
                .single();
              if (error) return { ok: false, error: error.message };
              return {
                ok: true,
                transaction: data,
                category: cat?.name ?? "Outros",
              };
            },
          }),
          list_recent: tool({
            description: "Lista as últimas movimentações financeiras do usuário.",
            inputSchema: z.object({
              limit: z.number().int().min(1).max(50).default(10),
            }),
            execute: async ({ limit }) => {
              const { data, error } = await sb
                .from("transactions")
                .select("type,amount,description,occurred_at,categories(name)")
                .eq("user_id", userId)
                .order("occurred_at", { ascending: false })
                .limit(limit);
              if (error) return { ok: false, error: error.message };
              return { ok: true, items: data };
            },
          }),
          get_summary: tool({
            description: "Resumo financeiro do mês atual: receitas, despesas e saldo. Use para perguntas como 'quanto gastei?', 'qual meu saldo?'.",
            inputSchema: z.object({}),
            execute: async () => {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
              const { data, error } = await sb
                .from("transactions")
                .select("type,amount,categories(name)")
                .eq("user_id", userId)
                .gte("occurred_at", start);
              if (error) return { ok: false, error: error.message };
              let income = 0, expense = 0;
              const byCat: Record<string, number> = {};
              for (const t of data ?? []) {
                const v = Number(t.amount);
                if (t.type === "income") income += v;
                else if (t.type === "expense") {
                  expense += v;
                  const cn = (t.categories as { name?: string } | null)?.name ?? "Outros";
                  byCat[cn] = (byCat[cn] ?? 0) + v;
                }
              }
              return { ok: true, month_to_date: { income, expense, balance: income - expense, by_category: byCat } };
            },
          }),
        };

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          tools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(body.messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            // Save new assistant messages (everything after originalMessages length)
            const newOnes = messages.slice(body.messages!.length);
            if (newOnes.length === 0) return;
            const rows = newOnes.map((m) => ({
              thread_id: threadId,
              user_id: userId,
              role: m.role,
              parts: m.parts as unknown as object,
            }));
            const { error } = await sb.from("messages").insert(rows);
            if (error) console.error("[chat] failed to save assistant messages:", error.message);
            await sb.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

            // Auto-title on first turn if still default
            const { data: t } = await sb.from("threads").select("title").eq("id", threadId).single();
            if (t?.title === "Nova conversa") {
              const firstUserText = body.messages![0]?.parts
                ?.map((p) => (p.type === "text" ? p.text : ""))
                .join(" ")
                .trim()
                .slice(0, 60);
              if (firstUserText) {
                await sb.from("threads").update({ title: firstUserText }).eq("id", threadId);
              }
            }
          },
        });
      },
    },
  },
});
