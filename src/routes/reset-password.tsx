import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir senha — Finn" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash on load and emits PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also accept if user already has a session via the recovery link
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Senha deve ter ao menos 6 caracteres."); return; }
    if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso.");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary glow flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">Finn</span>
        </Link>
        <div className="rounded-2xl border bg-card/60 backdrop-blur p-8 shadow-2xl">
          <h1 className="text-2xl font-display font-semibold mb-1">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {ready ? "Escolha uma nova senha para sua conta." : "Validando link de recuperação…"}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pwd">Nova senha</Label>
              <div className="relative">
                <Input id="pwd" type={show ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pr-10" />
                <button type="button" onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirme a nova senha</Label>
              <Input id="confirm" type={show ? "text" : "password"} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full glow" disabled={loading || !ready}>
              {loading ? "..." : "Salvar nova senha"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
