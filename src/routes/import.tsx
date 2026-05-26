import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { listAccounts } from "@/lib/accounts.functions";
import { parseStatement, bulkImportTransactions } from "@/lib/import.functions";
import { Upload, FileText, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/import")({
  component: ImportPage,
  head: () => ({ meta: [{ title: "Importar extrato — Finn" }] }),
});

type ParsedTx = {
  type: "expense" | "income";
  amount: number;
  description: string;
  occurred_at: string;
  suggested_category?: string | null;
  _enabled: boolean;
};

function ImportPage() {
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: () => listAccounts() });
  const [accountId, setAccountId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedTx[] | null>(null);

  async function extractText(f: File): Promise<{ text: string; format: "ofx" | "csv" | "pdf" }> {
    const name = f.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      let out = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        out += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
      }
      return { text: out, format: "pdf" };
    }
    const text = await f.text();
    if (name.endsWith(".ofx") || /<OFX|<STMTTRN/i.test(text)) return { text, format: "ofx" };
    return { text, format: "csv" };
  }

  async function handleParse() {
    if (!file) return;
    setParsing(true);
    setParsed(null);
    try {
      const { text, format } = await extractText(file);
      const res = await parseStatement({ data: { text, format, is_credit_card: isCreditCard } });
      setParsed(res.transactions.map((t) => ({ ...t, _enabled: true })));
      toast.success(`${res.transactions.length} transações detectadas`);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao ler arquivo");
    } finally {
      setParsing(false);
    }
  }

  const importM = useMutation({
    mutationFn: () => {
      const selected = (parsed ?? []).filter((t) => t._enabled);
      return bulkImportTransactions({
        data: {
          account_id: accountId || null,
          transactions: selected.map((t) => ({
            type: t.type,
            amount: t.amount,
            description: t.description,
            occurred_at: t.occurred_at,
            category_name: t.suggested_category ?? null,
          })),
        },
      });
    },
    onSuccess: (r) => {
      toast.success(`${r.inserted} transações importadas`);
      setParsed(null);
      setFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedCount = (parsed ?? []).filter((t) => t._enabled).length;
  const totalExpense = (parsed ?? []).filter((t) => t._enabled && t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = (parsed ?? []).filter((t) => t._enabled && t.type === "income").reduce((s, t) => s + t.amount, 0);

  return (
    <AppShell title="Importar extrato" subtitle="Carregue extratos OFX, CSV ou faturas em PDF">
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card/40 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Conta (opcional)</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  {(accountsQ.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo</Label>
              <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 cursor-pointer hover:bg-accent/40 transition">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate flex-1">
                  {file ? file.name : "Escolher .ofx, .csv ou .pdf"}
                </span>
                <input
                  type="file"
                  accept=".ofx,.csv,.pdf,application/pdf,text/csv"
                  className="hidden"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setParsed(null); }}
                />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isCreditCard} onCheckedChange={(v) => setIsCreditCard(v === true)} />
            Este arquivo é uma fatura de cartão de crédito
          </label>
          <Button onClick={handleParse} disabled={!file || parsing} className="w-full sm:w-auto">
            {parsing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analisando…</> : <><FileText className="h-4 w-4 mr-1" /> Ler arquivo</>}
          </Button>
          <p className="text-xs text-muted-foreground">
            O Finn lê o arquivo no seu navegador e usa IA para identificar valor, data, descrição e categoria sugerida. Você revisa antes de salvar.
          </p>
        </div>

        {parsed && parsed.length > 0 && (
          <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-4">
              <div>
                <div className="font-medium">{selectedCount} de {parsed.length} selecionadas</div>
                <div className="text-xs text-muted-foreground">
                  Receitas {formatBRL(totalIncome)} · Despesas {formatBRL(totalExpense)}
                </div>
              </div>
              <Button
                onClick={() => importM.mutate()}
                disabled={selectedCount === 0 || importM.isPending}
                className="ml-auto"
              >
                {importM.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…</> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Importar selecionadas</>}
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
              {parsed.map((t, i) => (
                <div key={i} className={`px-5 py-3 flex items-center gap-3 ${t._enabled ? "" : "opacity-40"}`}>
                  <Checkbox
                    checked={t._enabled}
                    onCheckedChange={(v) => {
                      setParsed((prev) => prev?.map((p, idx) => idx === i ? { ...p, _enabled: v === true } : p) ?? null);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.occurred_at}{t.suggested_category ? ` · ${t.suggested_category}` : ""}
                    </div>
                  </div>
                  <div className={`text-sm font-medium tabular-nums ${t.type === "income" ? "text-emerald-400" : "text-foreground"}`}>
                    {t.type === "income" ? "+" : "−"}{formatBRL(t.amount)}
                  </div>
                  <button
                    onClick={() => setParsed((prev) => prev?.filter((_, idx) => idx !== i) ?? null)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {parsed && parsed.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma transação detectada neste arquivo.
          </div>
        )}
      </div>
    </AppShell>
  );
}
