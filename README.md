# Finn — Gerente Financeiro Pessoal

> **Autoria:** Alexandre Guerra
> **Status:** Em desenvolvimento ativo (Fase 3)
> **Demo:** [gerentefinn.lovable.app](https://gerentefinn.lovable.app)

## 📖 Sobre o projeto

**Finn** é um aplicativo de **gestão financeira pessoal** criado por **Alexandre Guerra** com um propósito claro: **centralizar o controle financeiro** de quem está cansado de pular entre vários aplicativos de bancos e cartões para entender a própria situação.

A ideia central é simples — e poderosa: **ver tudo num só lugar**. Saldo das contas, lançamentos do mês, faturas dos cartões, recorrências, metas e projeção de fluxo de caixa. Sem precisar abrir cinco apps diferentes, sem perder a visão geral do que está acontecendo com o seu dinheiro.

Controle financeiro é uma das coisas mais importantes (e mais negligenciadas) da vida adulta. O Finn nasce para reduzir o atrito desse hábito.

## ✨ Funcionalidades

### Núcleo financeiro
- **Contas**: conta corrente, poupança, dinheiro e cartões de crédito (com limite, dia de fechamento e vencimento)
- **Lançamentos**: receitas e despesas com categorização, filtros por mês/ano, separação cartão vs. conta corrente, seleção múltipla estilo Gmail e impressão
- **Categorias**: personalizáveis, com ícones e cores
- **Recorrências**: lançamentos fixos (salário, aluguel, assinaturas) gerados automaticamente
- **Metas**: poupança guiada com barra de progresso e prazo
- **Importação**: extratos via CSV/OFX/PDF

### Fase 3 — Inteligência financeira
- **Orçamentos por categoria**: teto mensal com barras verde/amarelo/vermelho conforme consumo
- **Faturas de cartão de crédito**: agrupamento automático por ciclo de fechamento, marcação de pagamento
- **Previsão de fluxo de caixa**: gráfico do saldo projetado em 30/60/90 dias considerando recorrências e faturas
- **Relatórios**: filtros de período, gráficos de receita vs. despesa, ranking por categoria, exportação CSV e impressão
- **Assistente com IA**: chat para tirar dúvidas sobre seus dados financeiros

### Conta e segurança
- Login com e-mail/senha, **Google** e **Apple**
- Recuperação de senha por e-mail
- Confirmar senha + ver senha digitada no cadastro
- Sessão protegida em todas as rotas internas

## 🚀 Como usar (manual rápido)

1. **Crie sua conta** em `/login` — pode usar e-mail, Google ou Apple
2. **Cadastre suas contas** em **Contas**: bancos, carteira e cartões de crédito (informe limite, fechamento e vencimento dos cartões)
3. **Configure categorias** em **Configurações → Categorias** (já vem com um conjunto padrão)
4. **Lance suas movimentações** em **Lançamentos** — escolha conta, categoria, data, descrição e valor. Despesas em cartão são automaticamente vinculadas à fatura correta.
5. **Defina orçamentos** em **Orçamentos** — um teto mensal por categoria. O sistema avisa quando você passa de 80% e 100%.
6. **Cadastre recorrências** em **Recorrências** para o que se repete todo mês (salário, aluguel, Netflix…)
7. **Acompanhe faturas** em **Faturas** — veja cada fatura por cartão, os itens dentro dela e marque como paga
8. **Olhe o futuro** em **Previsão** — veja como seu saldo vai evoluir nos próximos 30/60/90 dias
9. **Analise** em **Relatórios** — filtre por período, compare receita vs. despesa, veja onde você mais gasta, exporte CSV ou imprima
10. **Estabeleça metas** em **Metas** — viagem, reserva de emergência, troca de carro
11. **Pergunte ao assistente** em **Chat** quando quiser uma análise rápida dos seus dados

Dicas:
- Use o ícone 🖨️ nas telas de Lançamentos e Relatórios para gerar uma versão limpa para impressão ou PDF
- Selecione múltiplos lançamentos com as caixas de seleção (igual ao Gmail) para apagar em lote
- Filtre lançamentos por mês/ano e por tipo (cartão / conta corrente)

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| **Framework** | TanStack Start v1 (React 19 + SSR) |
| **Build** | Vite 7 |
| **Linguagem** | TypeScript (strict) |
| **Roteamento** | TanStack Router (file-based) |
| **Estado/dados** | TanStack Query + Server Functions |
| **UI** | Tailwind CSS v4 + shadcn/ui + Radix |
| **Ícones** | lucide-react |
| **Animações** | Motion |
| **Gráficos** | Recharts |
| **Backend** | Lovable Cloud (Postgres + Auth + Storage) |
| **IA** | Lovable AI Gateway (Gemini / GPT) |
| **Runtime servidor** | Cloudflare Workers (edge) |
| **Validação** | Zod |
| **Datas** | date-fns |
| **PDF / OFX** | pdfjs-dist |

## 🗂️ Estrutura do projeto

```
src/
├── routes/                  # Rotas (file-based, TanStack Router)
│   ├── __root.tsx           # Layout raiz
│   ├── index.tsx            # Landing
│   ├── login.tsx            # Autenticação
│   ├── reset-password.tsx   # Recuperação de senha
│   ├── dashboard.tsx        # Visão geral
│   ├── transactions.tsx     # Lançamentos
│   ├── accounts.tsx         # Contas e cartões
│   ├── budgets.tsx          # Orçamentos
│   ├── invoices.tsx         # Faturas de cartão
│   ├── forecast.tsx         # Previsão de fluxo de caixa
│   ├── reports.tsx          # Relatórios e exportação
│   ├── recurrences.tsx      # Lançamentos recorrentes
│   ├── goals.tsx            # Metas
│   ├── import.tsx           # Importação de extratos
│   ├── settings.tsx         # Configurações e categorias
│   ├── chat.tsx             # Assistente com IA
│   └── api/                 # Rotas HTTP (webhooks, chat stream)
│
├── lib/                     # Lógica de servidor (createServerFn)
│   ├── transactions.functions.ts
│   ├── budgets.functions.ts
│   ├── invoices.functions.ts
│   ├── forecast.functions.ts
│   ├── reports.functions.ts
│   ├── accounts.functions.ts
│   ├── categories.functions.ts
│   ├── recurrences.functions.ts
│   ├── goals.functions.ts
│   ├── dashboard.functions.ts
│   ├── import.functions.ts
│   ├── profile.functions.ts
│   ├── threads.functions.ts
│   └── require-auth.ts      # Guard de rotas autenticadas
│
├── components/              # UI compartilhada
│   ├── app-shell.tsx        # Layout com sidebar
│   ├── app-nav.tsx          # Navegação lateral
│   ├── ai-elements/         # Componentes do chat
│   └── ui/                  # shadcn/ui (botões, dialogs, etc.)
│
├── integrations/
│   ├── supabase/            # Clientes (browser, server, admin) + auth
│   └── lovable/             # Lovable Cloud SDK
│
├── hooks/                   # Hooks reutilizáveis
├── styles.css               # Tokens de design + tema (oklch)
├── router.tsx
└── start.ts                 # Bootstrap servidor

supabase/
├── config.toml
└── migrations/              # Schema (tabelas, RLS, triggers, RPCs)
```

### Modelo de dados (principais tabelas)

- `profiles` — dados do usuário
- `accounts` — contas e cartões
- `categories` — categorias do usuário
- `transactions` — lançamentos (com `invoice_id` para cartão)
- `recurrences` — lançamentos recorrentes
- `goals` — metas de poupança
- `budgets` — orçamentos mensais por categoria
- `credit_card_invoices` — faturas agrupadas por cartão e mês
- `threads` / `messages` — conversas do assistente IA

Todas as tabelas têm **Row Level Security (RLS)** ativa, garantindo que cada usuário só enxerga os próprios dados.

## 🔒 Segurança

- Autenticação gerenciada (Lovable Cloud / Supabase Auth)
- RLS em todas as tabelas — isolamento por `auth.uid()`
- Server functions com middleware de autenticação obrigatório
- Service role isolado em `client.server.ts` (nunca exposto ao navegador)
- Secrets via variáveis de ambiente (`.env` não versionado)

## 💻 Rodando localmente

```bash
# 1. Instalar dependências
bun install

# 2. Variáveis de ambiente
# O .env já é provisionado pelo Lovable Cloud com:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_PUBLISHABLE_KEY
#   VITE_SUPABASE_PROJECT_ID

# 3. Subir o dev server
bun dev

# 4. Acessar
# http://localhost:8080
```

Scripts disponíveis:

```bash
bun dev          # desenvolvimento
bun run build    # build de produção
bun preview      # preview do build
bun lint         # ESLint
bun format       # Prettier
```

## 🗺️ Roadmap

- ✅ **Fase 1** — Núcleo: contas, lançamentos, categorias, dashboard
- ✅ **Fase 2** — Recorrências, metas, importação de extratos, assistente IA, autenticação social
- ✅ **Fase 3** — Orçamentos, faturas de cartão, previsão de fluxo, relatórios, exportação, impressão
- 🔜 **Fase 4** — Alertas por e-mail (orçamento estourado, faturas/contas a vencer)
- 🔜 **Futuro** — App mobile, integração Open Finance, multi-moeda, compartilhamento familiar

## 👤 Autor

**Alexandre Guerra** — idealizador e responsável pelo produto. O Finn nasceu da própria necessidade de ter uma visão consolidada das finanças sem depender de planilhas manuais ou de pular entre apps de bancos diferentes.

## 📄 Licença

Projeto pessoal de Alexandre Guerra. Todos os direitos reservados.
Para uso, colaboração ou licenciamento, entre em contato com o autor.

---

> Construído com 💜 usando [Lovable](https://lovable.dev).
