import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getReport, exportReportCsv } from "@/lib/reports.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import { Download, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  beforeLoad: requireAuth,
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Relatórios — Finn" }] }),
});

function defaultFrom() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 2, 1).toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function ReportsPage() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [exporting, setExporting] = useState(false);

  const q = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => getReport({ data: { from, to } }),
  });

  async function downloadCsv() {
    setExporting(true);
    try {
      const res = await exportReportCsv({ data: { from, to } });
      const blob = new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const d = q.data;

  return (
    <AppShell title="Relatórios" subtitle="Filtre por período, compare receitas e despesas e exporte os dados.">
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button onClick={downloadCsv} variant="outline" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {q.isLoading && <p className="text-muted-foreground">Calculando...</p>}
      {d && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            <Stat icon={TrendingUp} label="Receitas" value={formatBRL(d.totals.income)} color="text-emerald-500" />
            <Stat icon={TrendingDown} label="Despesas" value={formatBRL(d.totals.expense)} color="text-destructive" />
            <Stat icon={Wallet} label="Saldo" value={formatBRL(d.totals.balance)} color={d.totals.balance >= 0 ? "text-emerald-500" : "text-destructive"} />
            <Stat label="Lançamentos" value={String(d.totals.count)} />
          </div>

          <div className="border border-border rounded-lg p-4 bg-card">
            <h3 className="font-medium mb-3">Receita vs despesa por mês</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis tickFormatter={(v) => formatBRL(Number(v))} fontSize={11} width={90} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="income" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-card">
            <h3 className="font-medium mb-3">Despesas por categoria</h3>
            <div className="space-y-2">
              {d.byCategory.filter((c) => c.expense > 0).map((c) => {
                const max = Math.max(...d.byCategory.map((x) => x.expense), 1);
                const pct = (c.expense / max) * 100;
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{c.name}</span>
                      <span className="text-muted-foreground">{formatBRL(c.expense)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {d.byCategory.filter((c) => c.expense > 0).length === 0 && (
                <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string; color?: string }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className={`text-xl font-semibold ${color ?? ""}`}>{value}</div>
    </div>
  );
}
