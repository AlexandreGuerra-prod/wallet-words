import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listTransactions, updateTransaction, deleteTransaction } from "@/lib/transactions.functions";
import { listCategories, createCategory, deleteCategory } from "@/lib/categories.functions";
import { listAccounts } from "@/lib/accounts.functions";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
  head: () => ({ meta: [{ title: "Lançamentos — Finn" }] }),
});

type Draft = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  occurred_at: string;
  category_id: string | null;
  account_id: string | null;
};

function TransactionsPage() {
  const qc = useQueryClient();
  const txs = useQuery({ queryKey: ["transactions", "all"], queryFn: () => listTransactions() });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const accs = useQuery({ queryKey: ["accounts"], queryFn: () => listAccounts() });

  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [newIcon, setNewIcon] = useState("");

  const filtered = useMemo(() => {
    if (!txs.data) return [];
    const s = search.toLowerCase().trim();
    if (!s) return txs.data;
    return txs.data.filter((t) => t.description.toLowerCase().includes(s));
  }, [txs.data, search]);

  const upd = useMutation({
    mutationFn: (d: Draft) =>
      updateTransaction({
        data: {
          id: d.id,
          type: d.type,
          amount: d.amount,
          description: d.description,
          occurred_at: d.occurred_at,
          category_id: d.category_id,
          account_id: d.account_id,
        },
      }),
    onSuccess: () => {
      toast.success("Lançamento atualizado");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteTransaction({ data: { id } }),
    onSuccess: () => {
      toast.success("Lançamento removido");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCat = useMutation({
    mutationFn: () => createCategory({ data: { name: newCat.trim(), icon: newIcon.trim() || null } }),
    onSuccess: () => {
      toast.success("Categoria criada");
      setNewCat(""); setNewIcon("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id } }),
    onSuccess: () => { toast.success("Categoria removida"); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Lançamentos" subtitle="Veja, edite ou remova suas movimentações">
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar descrição…" className="pl-9" />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} lançamento(s)</div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            {!txs.data ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lançamento.</div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((t) => {
                  const cat = (t as { categories?: { name: string; icon: string | null } | null }).categories;
                  const acc = (t as { accounts?: { name: string; color: string } | null }).accounts;
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-base">
                        {cat?.icon ?? (t.type === "income" ? "💰" : t.type === "expense" ? "💳" : "🔁")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{t.description}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.occurred_at} · {cat?.name ?? "Sem categoria"}{acc ? ` · ${acc.name}` : ""}
                        </div>
                      </div>
                      <div className={`tabular-nums font-medium ${t.type === "income" ? "text-emerald-500" : t.type === "expense" ? "text-rose-500" : ""}`}>
                        {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}{formatBRL(Number(t.amount))}
                      </div>
                      <button
                        onClick={() => setEdit({
                          id: t.id,
                          type: t.type as Draft["type"],
                          amount: Number(t.amount),
                          description: t.description,
                          occurred_at: t.occurred_at,
                          category_id: t.category_id,
                          account_id: (t as { account_id: string | null }).account_id,
                        })}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Remover este lançamento?")) del.mutate(t.id); }}
                        className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Categorias</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {cats.data?.map((c) => (
              <div key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 pl-3 pr-1 py-1 text-sm">
                <span>{c.icon ?? "🏷️"}</span>
                <span>{c.name}</span>
                {c.is_default ? (
                  <span className="text-[10px] text-muted-foreground px-1.5">padrão</span>
                ) : (
                  <button
                    onClick={() => { if (confirm(`Remover "${c.name}"?`)) delCat.mutate(c.id); }}
                    className="h-6 w-6 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex items-center justify-center"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) addCat.mutate(); }}
            className="flex flex-wrap items-end gap-2 max-w-xl"
          >
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label>Nova categoria</Label>
              <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ex: Pet shop" />
            </div>
            <div className="space-y-1.5 w-24">
              <Label>Ícone</Label>
              <Input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="🐶" />
            </div>
            <Button type="submit" disabled={!newCat.trim() || addCat.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </form>
        </section>
      </div>

      <Dialog open={edit !== null} onOpenChange={(v) => { if (!v) setEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar lançamento</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={edit.type} onValueChange={(v) => setEdit({ ...edit, type: v as Draft["type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={edit.amount}
                    onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={edit.occurred_at}
                    onChange={(e) => setEdit({ ...edit, occurred_at: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={edit.category_id ?? "none"} onValueChange={(v) => setEdit({ ...edit, category_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {cats.data?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Select value={edit.account_id ?? "none"} onValueChange={(v) => setEdit({ ...edit, account_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conta</SelectItem>
                    {accs.data?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button
              disabled={!edit || !edit.description.trim() || !(edit.amount > 0) || upd.isPending}
              onClick={() => edit && upd.mutate(edit)}
            >
              {upd.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
