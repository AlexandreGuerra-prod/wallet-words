import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listBudgets, upsertBudget, deleteBudget } from "@/lib/budgets.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Target } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/budgets")({
  beforeLoad: requireAuth,
  component: BudgetsPage,
  head: () => ({ meta: [{ title: "Orçamentos — Finn" }] }),
});

function BudgetsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const q = useQuery({ queryKey: ["budgets"], queryFn: () => listBudgets({ data: {} }) });
  const data = q.data;

  const upsertM = useMutation({
    mutationFn: () => upsertBudget({ data: { category_id: categoryId, amount: Number(amount) } }),
    onSuccess: () => {
      toast.success("Orçamento salvo");
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setOpen(false);
      setCategoryId("");
      setAmount("");
    },
    onError: (e) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => deleteBudget({ data: { id } }),
    onSuccess: () => {
      toast.success("Orçamento removido");
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });

  const usedCategoryIds = new Set(data?.items.map((i) => i.category_id) ?? []);
  const availableCats = (data?.categories ?? []).filter((c) => !usedCategoryIds.has(c.id));

  return (
    <AppShell
      title="Orçamentos"
      subtitle="Defina um teto mensal por categoria e acompanhe o quanto já foi gasto."
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo orçamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir limite</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Limite mensal (R$)</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => upsertM.mutate()} disabled={!categoryId || !amount || upsertM.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {q.isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {data && data.items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum orçamento definido para este mês.</p>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.items.map((b) => {
          const color =
            b.pct >= 100 ? "bg-destructive" : b.pct >= 80 ? "bg-yellow-500" : "bg-primary";
          const remaining = b.amount - b.spent;
          return (
            <div key={b.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{b.category_name}</div>
                <Button size="icon" variant="ghost" onClick={() => delM.mutate(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Progress value={Math.min(100, b.pct)} className="h-2" indicatorClassName={color} />
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">
                  {formatBRL(b.spent)} / {formatBRL(b.amount)}
                </span>
                <span className={remaining < 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                  {remaining < 0 ? `Excedeu ${formatBRL(-remaining)}` : `Resta ${formatBRL(remaining)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
