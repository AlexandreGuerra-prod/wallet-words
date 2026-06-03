import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getCashflowForecast } from "@/lib/forecast.functions";
import { AppShell } from "@/components/app-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatBRL, formatDate } from "@/lib/format";
import { TrendingUp, Calendar, CreditCard, Repeat } from "lucide-react";

export const Route = createFileRoute("/forecast")({
  beforeLoad: requireAuth,
  component: ForecastPage,
  head: () => ({ meta: [{ title: "Previsão — Finn" }] }),
});

function ForecastPage() {
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ["forecast", days],
    queryFn: () => getCashflowForecast({ data: { days } }),
  });

  return (
    <AppShell
      title="Previsão de fluxo"
      subtitle="Saldo projetado considerando recorrências e faturas a vencer."
      action={
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Próximos 30 dias</SelectItem>
            <SelectItem value="60">Próximos 60 dias</SelectItem>
            <SelectItem value="90">Próximos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {q.isLoading && <p className="text-muted-foreground">Calculando...</p>}
      {q.data && (
        <div className="space-y-6">
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Saldo projetado</h2>
            </div>
            <div className="h-56 sm:h-72 -ml-2 sm:ml-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={q.data.series}>
                  <defs>
                    <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tickFormatter={(v) => formatDate(v).slice(0, 5)} fontSize={11} />
                  <YAxis tickFormatter={(v) => formatBRL(Number(v))} fontSize={11} width={90} />
                  <Tooltip
                    formatter={(v) => formatBRL(Number(v))}
                    labelFormatter={(l) => formatDate(l as string)}
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Area type="monotone" dataKey="projected_balance" stroke="#6366f1" fill="url(#bal)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Faturas a vencer</h3>
              </div>
              {q.data.upcomingInvoices.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem faturas neste período.</p>
              )}
              <div className="space-y-2">
                {q.data.upcomingInvoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between text-sm">
                    <div>
                      <div>{(inv.accounts as { name?: string } | null)?.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(inv.due_date)}</div>
                    </div>
                    <div className="font-medium text-destructive">-{formatBRL(Number(inv.total_amount))}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Recorrências previstas</h3>
              </div>
              {q.data.upcomingRecurrences.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem recorrências neste período.</p>
              )}
              <div className="space-y-2">
                {q.data.upcomingRecurrences.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm">
                    <div>
                      <div>{r.description}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(r.next_run_at)}
                      </div>
                    </div>
                    <div className={`font-medium ${r.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                      {r.type === "income" ? "+" : "-"}
                      {formatBRL(Number(r.amount))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
