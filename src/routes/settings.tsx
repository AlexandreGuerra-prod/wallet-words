import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { deleteMyAccount } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — Finn" }] }),
});

function SettingsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const del = useMutation({
    mutationFn: () => deleteMyAccount(),
    onSuccess: async () => {
      await supabase.auth.signOut();
      toast.success("Conta excluída.");
      navigate({ to: "/login" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Configurações" subtitle="Gerencie sua conta">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 max-w-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Excluir conta</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Esta ação é permanente. Todos os seus dados (transações, contas, metas, categorias, conversas) serão removidos e você não poderá recuperá-los.
            </p>
            <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
              Excluir minha conta
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Digite <strong>EXCLUIR</strong> para confirmar. Esta ação não pode ser desfeita.
          </p>
          <div className="space-y-1.5">
            <Label>Confirmação</Label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="EXCLUIR" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={confirm !== "EXCLUIR" || del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
