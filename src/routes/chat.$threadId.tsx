import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, createThread, deleteThread, loadThreadMessages } from "@/lib/threads.functions";
import { summaryServerFn } from "@/lib/transactions.functions";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Plus, Trash2, Sparkles, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Chat — Finn" }] }),
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      else setAuthed(true);
    });
  }, [navigate]);

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreads(),
    enabled: authed === true,
  });

  const initialQ = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => loadThreadMessages({ data: { threadId } }),
    enabled: authed === true,
  });

  const summaryQ = useQuery({
    queryKey: ["summary"],
    queryFn: () => summaryServerFn(),
    enabled: authed === true,
  });

  const newThreadM = useMutation({
    mutationFn: () => createThread({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const delThreadM = useMutation({
    mutationFn: (id: string) => deleteThread({ data: { threadId: id } }),
    onSuccess: async () => {
      const list = await qc.fetchQuery({ queryKey: ["threads"], queryFn: () => listThreads() });
      if (list[0]) navigate({ to: "/chat/$threadId", params: { threadId: list[0].id } });
      else navigate({ to: "/" });
    },
  });

  if (authed !== true) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppNav />
      {/* Threads sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar/60 border-r border-sidebar-border flex flex-col">
        <div className="p-4">
          <div className="font-display font-semibold leading-none">Conversas</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Histórico</div>
        </div>

        <div className="px-3">
          <Button onClick={() => newThreadM.mutate()} className="w-full justify-start gap-2" variant="secondary">
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {threadsQ.data?.map((t) => {
            const active = t.id === threadId;
            return (
              <div
                key={t.id}
                className={`group flex items-center gap-1 rounded-lg px-2 ${active ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 truncate py-2 text-sm"
                >
                  {t.title}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm("Excluir esta conversa?")) delThreadM.mutate(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Mini summary */}
        {summaryQ.data && (
          <div className="m-3 rounded-xl border border-sidebar-border bg-card/40 p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mês atual</div>
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <span className="text-muted-foreground">Receitas</span>
              <span className="ml-auto tabular-nums">{formatBRL(summaryQ.data.income)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-muted-foreground">Despesas</span>
              <span className="ml-auto tabular-nums">{formatBRL(summaryQ.data.expense)}</span>
            </div>
            <div className="border-t border-sidebar-border pt-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span>Saldo</span>
              <span className={`ml-auto tabular-nums ${summaryQ.data.balance < 0 ? "text-destructive" : ""}`}>
                {formatBRL(summaryQ.data.balance)}
              </span>
            </div>
          </div>
        )}

      </aside>

      {/* Chat */}
      <main className="flex-1 min-w-0 flex flex-col">
        {initialQ.data && (
          <ChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={initialQ.data.messages as unknown as UIMessage[]}
            onTurnFinished={() => {
              qc.invalidateQueries({ queryKey: ["threads"] });
              qc.invalidateQueries({ queryKey: ["summary"] });
            }}
          />
        )}
      </main>
    </div>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  onTurnFinished,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onTurnFinished: () => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const headers: Record<string, string> = {};
          if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
          return {
            body: { threadId, messages },
            headers,
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Erro no chat"),
    onFinish: () => onTurnFinished(),
  });

  const [input, setInput] = useState("");
  const loading = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (!text || loading) return;
    sendMessage({ text });
    setInput("");
  };


  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Sparkles className="h-8 w-8 text-primary" />}
              title="Como posso ajudar com suas finanças?"
            >
              <div className="text-muted-foreground">
                <Sparkles className="h-8 w-8 text-primary mx-auto" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-sm">Como posso ajudar com suas finanças?</h3>
              </div>
              <div className="space-y-2 mt-2 w-full max-w-sm">
                <Suggestion text="Gastei 45 no mercado" onPick={setInput} />
                <Suggestion text="Recebi 5000 de salário" onPick={setInput} />
                <Suggestion text="Quanto eu gastei este mês?" onPick={setInput} />
              </div>
            </ConversationEmptyState>

          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                <MessageContent
                  className={
                    m.role === "user"
                      ? "bg-chat-user text-chat-user-foreground"
                      : "bg-transparent p-0"
                  }
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return m.role === "assistant" ? (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      ) : (
                        <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                      );
                    }
                    if (part.type?.startsWith("tool-")) {
                      const tp = part as {
                        type: string;
                        toolName?: string;
                        state?: string;
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      const name = tp.toolName ?? tp.type.replace("tool-", "");
                      const label = TOOL_LABELS[name] ?? name;
                      return (
                        <Tool key={i} defaultOpen={false} className="my-2 not-prose">
                          <ToolHeader type={label as `tool-${string}`} state={(tp.state ?? "output-available") as "input-streaming" | "input-available" | "output-available" | "output-error"} />
                          <ToolContent>
                            {tp.input != null && <ToolInput input={tp.input} />}
                            {(tp.output != null || tp.errorText) && (
                              <ToolOutput output={renderToolOutput(name, tp.output)} errorText={tp.errorText} />
                            )}
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="px-1"><Shimmer>Pensando…</Shimmer></div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/50 backdrop-blur p-4">
        <div className="max-w-3xl mx-auto">
          <PromptInput onSubmit={submit}>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Conte para o Finn... (ex: gastei 30 no Uber)"
              autoFocus
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!input.trim() || loading} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </>
  );
}

function Suggestion({ text, onPick }: { text: string; onPick: (t: string) => void }) {
  return (
    <button
      onClick={() => onPick(text)}
      className="block w-full text-left px-3 py-2 rounded-lg border border-border bg-card/40 hover:bg-accent text-sm transition-colors"
    >
      <span className="text-muted-foreground">→</span> {text}
    </button>
  );
}

const TOOL_LABELS: Record<string, string> = {
  record_transaction: "Registrando movimentação",
  list_recent: "Buscando últimas movimentações",
  get_summary: "Calculando resumo",
};

function renderToolOutput(name: string, output: unknown): React.ReactNode {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (name === "record_transaction" && o.ok && o.transaction) {
    const tx = o.transaction as { type: string; amount: number; description: string; occurred_at: string };
    const isExp = tx.type === "expense";
    return (
      <div className="p-3 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isExp ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
          {isExp ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{tx.description}</div>
          <div className="text-xs text-muted-foreground">{o.category as string} · {tx.occurred_at}</div>
        </div>
        <div className={`tabular-nums font-semibold ${isExp ? "text-destructive" : "text-success"}`}>
          {isExp ? "-" : "+"}{formatBRL(Number(tx.amount))}
        </div>
      </div>
    );
  }
  return <pre className="p-3 text-xs overflow-auto">{JSON.stringify(output, null, 2)}</pre>;
}

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
