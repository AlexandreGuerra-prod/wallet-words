# Fase 3 — Plano

Escopo aprovado: **Orçamentos por categoria, Faturas de cartão, Previsão de fluxo, Relatórios/Exportação, Alertas por e-mail.**

## 1. Banco de dados (1 migração)

Novas tabelas (RLS `auth.uid() = user_id`, GRANTs para `authenticated`/`service_role`):

- **`budgets`** — `category_id`, `month` (date, dia=1), `amount`, `alert_80_sent_at`, `alert_100_sent_at`.
- **`credit_card_invoices`** — `account_id`, `reference_month`, `closing_date`, `due_date`, `total_amount`, `status` (`open|closed|paid`), `paid_at`.
- Em `transactions`: adicionar `invoice_id uuid` (nullable) ligando lançamento de cartão à fatura.

Funções SQL:
- `assign_transaction_to_invoice()` — trigger que, ao inserir/atualizar transação de cartão, calcula a fatura correta pelo `closing_day` e cria/atribui.
- `forecast_cashflow(_user_id, _days)` — soma saldo atual + recorrências previstas + faturas em aberto até a data.

## 2. Server functions (`src/lib/`)

- `budgets.functions.ts` — list (mês atual com gasto realizado vs limite), upsert, delete.
- `invoices.functions.ts` — listByAccount, getDetail (lançamentos da fatura), markAsPaid.
- `forecast.functions.ts` — `getCashflowForecast({ days })` → série diária de saldo projetado.
- `reports.functions.ts` — `getReport({ from, to, groupBy })` → agregados; `exportCsv` / `exportPdf` retornando string base64.

## 3. Telas

- **`/budgets`** — cards por categoria com Progress bar, cor verde/amarelo/vermelho conforme % gasto. Botão "Definir limite" abre dialog.
- **`/invoices`** — para cada cartão, lista de faturas (mês de referência, total, status). Clicar abre detalhe com transações + botão "Marcar como paga".
- **`/forecast`** — gráfico de linha (saldo projetado 30/60/90d) + lista de eventos futuros (recorrências, faturas a vencer).
- **`/reports`** — filtro de período, gráficos (despesas por categoria, evolução mensal, comparativo receita/despesa), botões **Exportar CSV** e **Exportar PDF**.

Sidebar (`app-nav.tsx`) ganha 4 ícones: Orçamentos, Faturas, Previsão, Relatórios.

Dashboard atual ganha um card resumo de orçamentos (top 3 mais estourados).

## 4. Alertas por e-mail

- Setup de email infrastructure (`setup_email_infra` + `scaffold_transactional_email`).
- Templates React Email: `budget-alert.tsx` (80% e 100%), `invoice-due-soon.tsx` (3 dias antes), `recurrence-due-soon.tsx`.
- Server route `/api/public/cron/email-alerts` (verificada por header secret) chamada por pg_cron diariamente. Para cada user: checa orçamentos estourados não-notificados, faturas/recorrências vencendo em ≤3 dias, enfileira e-mails via `sendTransactionalEmail`.
- Migration registra o job no `pg_cron` apontando para a URL estável `project--{id}.lovable.app`.

## 5. Exportação

- **CSV**: gerado server-side com `papaparse` (já vem), download via blob no cliente.
- **PDF**: `pdf-lib` (puro JS, compatível com Worker) gera relatório com KPIs + tabela.

## 6. Bibliotecas a adicionar

`pdf-lib`, `papaparse`, `date-fns` (provavelmente já presente). React Email já entra com o scaffold.

## 7. Ordem de entrega

1. Migração (budgets + invoices + invoice_id em transactions + trigger + forecast)
2. Server functions
3. Telas Orçamentos, Faturas, Previsão, Relatórios + sidebar
4. Setup de email + templates + cron de alertas
5. QA visual e funcional

Aprovo prosseguir?
