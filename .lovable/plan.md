# Fase 2 — Plano de implementação

Escopo aprovado: **Dashboard, Contas & Cartões, Categorias customizadas, Metas, Recorrências.**

## 1. Banco de dados (1 migração)

Novas tabelas (todas com RLS `auth.uid() = user_id`):

- **`accounts`** — `name`, `type` (`checking|savings|cash|credit_card|investment`), `institution`, `color`, `closing_day` / `due_day` (cartão), `credit_limit`, `archived`.
- **`goals`** — `name`, `target_amount`, `current_amount`, `deadline`, `category_id?`, `status`.
- **`recurrences`** — `description`, `type` (`income|expense`), `amount`, `category_id`, `account_id`, `frequency` (`monthly|weekly|yearly`), `day_of_month`, `next_run_at`, `active`.

Alterações:

- `transactions`: adicionar `account_id uuid → accounts(id)`, `recurrence_id uuid → recurrences(id)` (ambas nullable).
- `categories`: já permite custom — só vamos garantir UI.

Função SQL `materialize_due_recurrences(user_id)` que insere transações vencidas até hoje e atualiza `next_run_at`. Chamada sob demanda quando o usuário abre o dashboard / pede resumo.

## 2. Server functions (novas em `src/lib/`)

- `accounts.functions.ts` — list / create / update / archive.
- `goals.functions.ts` — list / create / updateProgress / delete.
- `recurrences.functions.ts` — list / create / pause / delete / `materializeDue`.
- `categories.functions.ts` — list (default + user) / create / delete (custom).
- `dashboard.functions.ts` — agregados: totais mês atual, por categoria, série diária 30d, top 5 categorias, saldo por conta, progresso das metas.

## 3. Ferramentas adicionais do agente Finn (em `routes/api/chat.ts`)

Adicionar tools ao chat para que a IA continue conversacional:

- `create_account`, `list_accounts`
- `create_goal`, `update_goal_progress`, `list_goals`
- `create_recurrence`, `list_recurrences`
- `create_category`
- `record_transaction` ganha campo opcional `account_name` (resolvido server-side)

System prompt atualizado para conhecer contas, cartões, metas e recorrências.

## 4. Telas

Layout do app vira **sidebar global** com navegação (substitui o painel atual só de threads). Sidebar colapsável (`shadcn/ui sidebar`) com:
- 💬 Chat (mantém sub-lista de threads)
- 📊 Dashboard
- 🏦 Contas & Cartões
- 🎯 Metas
- 🔁 Recorrências

Rotas novas:

- `/dashboard` — KPIs (receitas, despesas, saldo), gráfico de evolução (line), barras por categoria, donut top 5, lista das últimas transações, mini-cards das metas.
- `/accounts` — lista + dialog de criação (form com tipo, cor, dados de cartão quando aplicável). Cada conta mostra saldo calculado.
- `/goals` — cards de metas com progresso (Progress bar), CTA "Adicionar valor".
- `/recurrences` — tabela com próximas execuções, botão pausar/excluir.

`chat.$threadId.tsx` mantido, sidebar lateral de threads passa a ser um sub-painel só na rota de chat.

Charts: **recharts** (já comum em shadcn). Adicionar via `bun add recharts`.

## 5. UX & detalhes

- Toda criação/edição com `toast` (sonner já no projeto).
- Form validation com `react-hook-form` + zod.
- Cores das contas/categorias reaproveitadas nos gráficos.
- Manter tema **Midnight Indigo**; gráficos usam tokens semânticos (`--primary`, `--accent`, `--chart-*`).

## 6. Entrega incremental

Vou executar em uma sequência única, mas em commits lógicos visíveis pelas tarefas:

1. Migração (tabelas + função SQL + colunas em transactions)
2. Server functions + tools do chat
3. Sidebar global + rotas placeholders
4. Tela Contas & Cartões
5. Tela Metas
6. Tela Recorrências
7. Dashboard com gráficos
8. Validação end-to-end

Aprovar para eu seguir?
