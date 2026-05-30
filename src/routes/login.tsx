import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Finn" }] }),
});

type Mode = "signin" | "signup" | "forgot";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          toast.error("As senhas não coincidem.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme seu e-mail para entrar.");
        setMode("signin");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de redefinição para seu e-mail.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na operação");
    } finally {
      setLoading(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Falha ao entrar com ${provider}`);
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signin" ? "Bem-vindo de volta" :
    mode === "signup" ? "Crie sua conta" :
    "Recuperar senha";
  const subtitle =
    mode === "signin" ? "Continue conversando com seu agente financeiro." :
    mode === "signup" ? "Comece a organizar suas finanças conversando." :
    "Informe seu e-mail e enviaremos um link para redefinir sua senha.";

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
          <h1 className="text-2xl font-display font-semibold mb-1">{title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>

          {mode !== "forgot" && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button type="button" variant="outline" disabled={loading} onClick={() => oauth("google")}>
                  Google
                </Button>
                <Button type="button" variant="outline" disabled={loading} onClick={() => oauth("apple")}>
                  Apple
                </Button>
              </div>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou com e-mail</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handle} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirme a senha</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full glow" disabled={loading}>
              {loading ? "..." :
                mode === "signin" ? "Entrar" :
                mode === "signup" ? "Criar conta" :
                "Enviar link de redefinição"}
            </Button>
          </form>

          {mode === "signin" && (
            <button
              onClick={() => setMode("forgot")}
              className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Esqueci minha senha
            </button>
          )}

          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "signup" ? "Já tem conta? Entrar" :
              mode === "forgot" ? "Voltar para o login" :
              "Não tem conta? Criar agora"}
          </button>
          {mode === "forgot" && (
            <button
              onClick={() => setMode("signin")}
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
