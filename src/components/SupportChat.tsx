// Floating chat widget. Visible only for authenticated users.
// Sends via server fn → Telegram, receives admin replies via Supabase realtime.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyThread, sendSupportMessage } from "@/lib/support.functions";

type Msg = { id: string; sender: "user" | "admin"; content: string; created_at: string };

export function SupportChat() {
  const { isAuthenticated, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fetchThread = useServerFn(getMyThread);
  const sendMsg = useServerFn(sendSupportMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  // load thread on open
  useEffect(() => {
    if (!open || !isAuthenticated || threadId) return;
    fetchThread({ data: undefined } as never).then((r) => {
      setThreadId(r.threadId);
      setMessages(r.messages as Msg[]);
    }).catch(() => void 0);
  }, [open, isAuthenticated, threadId, fetchThread]);

  // realtime subscription
  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`support-${threadId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadId]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function handleSend() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await sendMsg({ data: { content: value } });
      setText("");
    } finally {
      setSending(false);
    }
  }

  if (loading || !isAuthenticated) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Открыть чат"
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-lg glow-primary hover:scale-105 transition"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-gradient-primary px-4 py-3 text-primary-foreground">
            <div>
              <div className="text-sm font-semibold">Онлайн-помощник</div>
              <div className="text-xs opacity-80">Ответим в чате и Telegram</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Закрыть" className="rounded p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                Здравствуйте! Чем можем помочь? Опишите задачу — менеджер ответит здесь же.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                  m.sender === "user"
                    ? "bg-gradient-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 border-t border-border p-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ваше сообщение…"
              maxLength={4000}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground disabled:opacity-50"
              aria-label="Отправить"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
