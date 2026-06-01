import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getDashboard } from "@/lib/dashboard.functions";
import { listAccounts } from "@/lib/accounts.functions";
import { listCategories } from "@/lib/categories.functions";
import { AppShell } from "@/components/app-shell";
import { formatBRL } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Target, Layers, Repeat, Shuffle } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireAuth,
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Finn" }] }),
});

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#84cc16"];
type Period = "month" | "3m" | "year" | "all" | "custom_month" | "custom_year";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function DashboardPage() {
  const now = new Date();
  const [period, setPeriod] = useState<Period>("month");
  const [customMonth, setCustomMonth] = useState<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [customYear, setCustomYear] = useState<string>(String(now.getFullYear()));
  const [accountKind, setAccountKind] = useState<"all" | "credit_card" | "cash_like">("all");
  const [accountId, setAccountId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: () => listAccounts() });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });

  const filteredAccounts = useMemo(() => {
    const accs = accountsQ.data ?? [];
    if (accountKind === "credit_card") return accs.filter((a) => a.type === "credit_card");
    if (accountKind === "cash_like") return accs.filter((a) => a.type !== "credit_card");
    return accs;
  }, [accountsQ.data, accountKind]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1].map(String);
  }, [now]);
  const monthOptions = useMemo(() => {
    const y = Number(customMonth.slice(0, 4));
    return MONTHS_PT.map((label, i) => ({
      value: `${y}-${String(i + 1).padStart(2, "0")}`,
      label: `${label} ${y}`,
    }));
  }, [customMonth]);

  const q = useQuery({
    queryKey: ["dashboard", period, customMonth, customYear, accountKind, accountId, categoryId],
    queryFn: () =>
      getDashboard({
        data: {
          period,
          month: period === "custom_month" ? customMonth : null,
          year: period === "custom_year" ? customYear : null,
          accountId: accountId === "all" ? null : accountId,
          categoryId: categoryId === "all" ? null : categoryId,
          accountKind,
        },
      }),
  });
  const d = q.data;

  const periodLabel = period === "custom_month"
    ? monthOptions.find((m) => m.value === customMonth)?.label ?? customMonth
    : period === "custom_year"
      ? customYear
      : period === "month" ? "Mês atual" : period === "3m" ? "Últimos 3 meses" : period === "year" ? "Este ano" : "Tudo";

  const seriesTitle = period === "month" || period === "custom_month" ? `${periodLabel} (diário)` : period === "3m" ? "Últimos 3 meses (diário)" : "Mensal";

  return (
    <AppShell title="Dashboard" subtitle={periodLabel}>
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <FilterSelect label="Período" value={period} onChange={(v) => setPeriod(v as Period)}
            options={[
              { value: "month", label: "Mês atual" },
              { value: "custom_month", label: "Mês específico" },
              { value: "custom_year", label: "Ano específico" },
              { value: "3m", label: "Últimos 3 meses" },
              { value: "year", label: "Este ano" },
              { value: "all", label: "Tudo" },
            ]} />
          {period === "custom_month" && (
            <>
              <FilterSelect label="Ano" value={customMonth.slice(0, 4)}
                onChange={(y) => setCustomMonth(`${y}-${customMonth.slice(5)}`)}
                options={yearOptions.map((y) => ({ value: y, label: y }))} />
              <FilterSelect label="Mês" value={customMonth} onChange={setCustomMonth} options={monthOptions} />
            </>
          )}
          {period === "custom_year" && (
            <FilterSelect label="Ano" value={customYear} onChange={setCustomYear}
              options={yearOptions.map((y) => ({ value: y, label: y }))} />
          )}
          <FilterSelect label="Tipo" value={accountKind} onChange={(v) => { setAccountKind(v as typeof accountKind); setAccountId("all"); }}
            options={[
              { value: "all", label: "Todos" },
              { value: "cash_like", label: "Conta corrente" },
              { value: "credit_card", label: "Cartão de crédito" },
            ]} />
          <FilterSelect label="Conta" value={accountId} onChange={setAccountId}
            options={[
              { value: "all", label: "Todas" },
              ...filteredAccounts.map((a) => ({ value: a.id, label: a.name })),
            ]} />
          <FilterSelect label="Categoria" value={categoryId} onChange={setCategoryId}
            options={[
              { value: "all", label: "Todas as categorias" },
              ...(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: `${c.icon ?? ""} ${c.name}`.trim() })),
            ]} />
        </div>

        {!d ? (
          <div className="text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Receitas" value={d.month.income} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
              <Kpi label="Despesas" value={d.month.expense} icon={<TrendingDown className="h-4 w-4" />} tone="destructive" />
              <Kpi label="Saldo" value={d.month.balance} icon={<Wallet className="h-4 w-4" />} tone={d.month.balance < 0 ? "destructive" : "primary"} />
              <Kpi label="Parcelas (a pagar)" value={d.installmentsCommitted} icon={<Layers className="h-4 w-4" />} tone="primary" />
            </div>

            {/* Fixed vs Variable */}
            <Card title="Despesas fixas vs variáveis">
              <FixedVsVariable fixed={d.expenseBreakdown.fixed} variable={d.expenseBreakdown.variable} />
            </Card>

            {/* Series */}
            <Card title={seriesTitle}>
              {d.series.length === 0 ? (
                <Empty text="Sem movimentações no período" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                        tickFormatter={(v: string) => (v.length === 7 ? `${v.slice(5)}/${v.slice(2, 4)}` : v.slice(5))}
                      />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip content={<TooltipBox />} />
                      <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gIn)" name="Receitas" />
                      <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#gOut)" name="Despesas" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Despesas por categoria">
                {d.byCategory.length === 0 ? (
                  <Empty text="Sem despesas no período" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <BarChart data={d.byCategory} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                        <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} width={100} />
                        <Tooltip content={<TooltipBox />} />
                        <Bar dataKey="amount" fill="#6366f1" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              <Card title="Distribuição">
                {d.byCategory.length === 0 ? (
                  <Empty text="Sem dados" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={d.byCategory.slice(0, 5)} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {d.byCategory.slice(0, 5).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<TooltipBox />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            {/* Goals & recent */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Metas ativas">
                {d.goals.length === 0 ? (
                  <Empty text="Nenhuma meta ativa" />
                ) : (
                  <div className="space-y-3">
                    {d.goals.map((g) => {
                      const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
                      return (
                        <div key={g.id}>
                          <div className="flex items-center gap-2 text-sm mb-1.5">
                            <Target className="h-3.5 w-3.5 text-primary" />
                            <span className="font-medium">{g.name}</span>
                            <span className="ml-auto tabular-nums text-muted-foreground">
                              {formatBRL(Number(g.current_amount))} / {formatBRL(Number(g.target_amount))}
                            </span>
                          </div>
                          <Progress value={pct} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card title="Últimas movimentações">
                {d.recent.length === 0 ? (
                  <Empty text="Nenhuma transação" />
                ) : (
                  <ul className="space-y-2.5">
                    {d.recent.map((t) => {
                      const exp = t.type === "expense";
                      const cat = t.categories as { name?: string | null; icon?: string | null } | null;
                      return (
                        <li key={t.id} className="flex items-center gap-3 text-sm">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs ${exp ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
                            {cat?.icon ?? (exp ? "↓" : "↑")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{t.description}</div>
                            <div className="text-xs text-muted-foreground">{cat?.name ?? "Outros"} · {t.occurred_at}</div>
                          </div>
                          <div className={`tabular-nums font-medium ${exp ? "text-destructive" : "text-success"}`}>
                            {exp ? "-" : "+"}{formatBRL(Number(t.amount))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function FixedVsVariable({ fixed, variable }: { fixed: number; variable: number }) {
  const total = fixed + variable;
  if (total === 0) return <Empty text="Sem despesas no período" />;
  const fixedPct = (fixed / total) * 100;
  const variablePct = 100 - fixedPct;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-card/40 border border-border p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Repeat className="h-3.5 w-3.5 text-primary" /> Fixas
          </div>
          <div className="mt-1 text-xl font-display font-semibold tabular-nums">{formatBRL(fixed)}</div>
          <div className="text-xs text-muted-foreground">{fixedPct.toFixed(1)}% · contas recorrentes</div>
        </div>
        <div className="rounded-lg bg-card/40 border border-border p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Shuffle className="h-3.5 w-3.5 text-warning" /> Variáveis
          </div>
          <div className="mt-1 text-xl font-display font-semibold tabular-nums">{formatBRL(variable)}</div>
          <div className="text-xs text-muted-foreground">{variablePct.toFixed(1)}% · gastos pontuais</div>
        </div>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden bg-card/40 border border-border flex">
        <div className="h-full bg-primary" style={{ width: `${fixedPct}%` }} />
        <div className="h-full bg-warning" style={{ width: `${variablePct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        Despesas <span className="text-foreground font-medium">fixas</span> são lançamentos vinculados a uma recorrência (luz, condomínio, IPTU, financiamento, etc).
        Cadastre em <span className="text-foreground">Recorrências</span> para classificar corretamente.
      </p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[170px] bg-card/40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "success" | "destructive" | "primary" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className={`mt-2 text-2xl font-display font-semibold tabular-nums ${color}`}>{formatBRL(value)}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow">
      {label != null && <div className="text-muted-foreground mb-1">{String(label)}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="tabular-nums font-medium ml-auto">{formatBRL(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}
