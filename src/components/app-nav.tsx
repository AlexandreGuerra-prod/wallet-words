import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { MessageCircle, LayoutDashboard, Wallet, Target, Repeat, Upload, LogOut, Sparkles, ListChecks, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ListChecks, label: "Lançamentos" },
  { to: "/accounts", icon: Wallet, label: "Contas" },
  { to: "/goals", icon: Target, label: "Metas" },
  { to: "/recurrences", icon: Repeat, label: "Recorrências" },
  { to: "/import", icon: Upload, label: "Importar" },
  { to: "/settings", icon: Settings, label: "Configurações" },
] as const;

export function AppNav() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="w-16 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-1">
      <Link
        to="/chat"
        className="h-10 w-10 rounded-lg bg-primary glow flex items-center justify-center mb-2"
        aria-label="Finn"
      >
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </Link>
      {items.map((it) => {
        const active = path === it.to || path.startsWith(it.to + "/");
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`group relative h-10 w-10 rounded-lg flex items-center justify-center transition ${
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
            aria-label={it.label}
          >
            <Icon className="h-4.5 w-4.5" />
            <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs opacity-0 shadow group-hover:opacity-100 transition">
              {it.label}
            </span>
          </Link>
        );
      })}
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/login" });
        }}
        className="mt-auto h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        aria-label="Sair"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </nav>
  );
}
