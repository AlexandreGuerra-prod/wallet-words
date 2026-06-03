# Otimização Mobile/Tablet — Gerente Finn

Hoje o app foi desenhado para desktop: a navegação lateral fixa de 64px ocupa espaço precioso no celular, várias telas (Dashboard, Lançamentos, Faturas, Parcelas, Relatórios) usam grids/filtros lado a lado que estouram em telas pequenas, e tabelas/diálogos não rolam bem em mobile. A proposta é tornar **toda a aplicação totalmente responsiva**, sem mudar funcionalidades.

## Escopo

Apenas mudanças de UI/layout (frontend). Nenhuma alteração em regras de negócio, banco ou server functions.

## O que vai mudar

### 1. Shell e navegação (base de tudo)
- **`AppNav`**: vira navegação adaptativa.
  - **Mobile (<768px)**: sidebar escondida, abre como **drawer** (Sheet do shadcn) via botão "hambúrguer" no header. Itens em lista vertical com ícone + rótulo (sem depender de hover/tooltip, que não funciona em touch).
  - **Tablet (768–1024px)**: sidebar compacta atual (64px com tooltip), igual desktop.
  - **Desktop (≥1024px)**: igual hoje.
- **`AppShell`**:
  - Header sticky ganha botão de menu em mobile e o `action` (botão "Novo lançamento" etc.) fica acessível abaixo do título quando faltar espaço.
  - Padding adaptativo: `px-4 py-4` no mobile, `px-6 py-6` no desktop.
  - Remove `max-w-6xl` em mobile para usar toda a largura.

### 2. Padrões responsivos aplicados em todas as telas
- **Barras de filtro**: hoje usam `flex flex-wrap` com `Select` de largura fixa `w-[170px]`. Vai virar `w-full sm:w-[170px]` em mobile e, quando houver muitos filtros, agrupar em um botão "Filtros" que abre um Sheet — mantendo a tela limpa.
- **Grids de KPI**: `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4` (2 cards por linha no celular em vez de 1, melhor uso do espaço).
- **Gráficos `recharts`**: `ResponsiveContainer` já cuida da largura; altura reduzida em mobile (`h-48 md:h-64`), fontes de eixos menores, `YAxis width` reduzido e formatadores compactos (`R$ 1,2k`).
- **Tabelas (Lançamentos, Faturas, Parcelas, Recorrências, Contas)**: em telas <md viram **lista de cards** (uma linha = um card empilhado com label/valor). Em ≥md mantêm a tabela atual. Padrão único aplicado via um wrapper utilitário.
- **Diálogos (`Dialog`)**: em mobile usam altura quase-cheia, scroll interno, e os formulários passam de 2 colunas → 1 coluna (`grid-cols-1 md:grid-cols-2`).
- **Chat**: bolhas com `max-w-[85%] md:max-w-[70%]`, input fixo no rodapé com safe-area iOS.

### 3. Telas individuais a revisar
Aplicando os padrões acima, cada rota recebe uma passada:
`/dashboard`, `/transactions`, `/accounts`, `/budgets`, `/invoices`, `/installments`, `/forecast`, `/reports`, `/goals`, `/recurrences`, `/import`, `/settings`, `/chat`, `/login`.

### 4. Tipografia, alvos de toque e meta viewport
- Botões/links interativos com altura mínima de 40px (alvo de toque recomendado).
- Texto base ≥14px em mobile; títulos `text-xl md:text-2xl`.
- Verificar `<meta name="viewport" content="width=device-width, initial-scale=1">` no `__root.tsx` (TanStack Start já inclui, confirmar).
- Tabelas/listas com `tabular-nums` para alinhar valores monetários.

## Detalhes técnicos

- **Breakpoints Tailwind padrão**: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- **Drawer mobile**: usar `Sheet` do shadcn (já instalado) controlado pelo `AppNav`. Hook `useIsMobile` já existe em `src/hooks/use-mobile.tsx`.
- **Sem regressão desktop**: todas as classes adicionadas serão *mobile-first* com overrides `md:`/`lg:` para preservar a aparência atual em telas grandes.
- **Sem mudança no design system**: cores, fontes e tokens em `src/styles.css` permanecem.

## Entrega

Após aprovar, eu implemento numa única passada e testo os breakpoints chave (375, 768, 1024) no preview.
