import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "./app-nav";

export function AppShell({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      else setAuthed(true);
    });
  }, [navigate]);

  if (!authed) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppNav />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/70 backdrop-blur border-b border-border px-6 py-4 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
        <div className="px-6 py-6 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
