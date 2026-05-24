// Floating chat widget. Visible only for authenticated users.
// Sends via server fn → Telegram, receives admin replies via Supabase realtime.
// Может работать как самостоятельная плавающая кнопка, либо в "controlled"-режиме
// из FloatingContacts (через props open/onClose).
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyThread, sendSupportMessage } from "@/lib/support.functions";

type Msg = { id: string; sender: "user" | "admin"; content: string; created_at: string };

interface Props {
  open?: boolean;
  onClose?: () => void;
  /** Прячет встроенную плавающую кнопку (когда чат открывается из другого UI). */
  hideTrigger?: boolean;
}

const ADMIN_NAME = "Менеджер event-hub.by";

export function SupportChat({ open: openProp, onClose, hideTrigger }: Props = {}) {
  const { isAuthenticated, loading, user } = useAuth();
  const controlled = typeof openProp === "boolean";
  const [openInternal, setOpenInternal] = useState(false);
  const open = controlled ? !!openProp : openInternal;

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [profileName, setProfileName] = useState<string>("");

  const fetchThread = useServerFn(getMyThread);
  const sendMsg = useServerFn(sendSupportMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const closeChat = () => {
    if (controlled) onClose?.();
    else setOpenInternal(false);
  };
  const openChat = () => {
    if (!controlled) setOpenInternal(true);
  };

  // load profile name
  useEffect(() => {
    if (!user?.id) { setProfileName(""); return; }
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfileName((data?.full_name as string) || ""));
  }, [user?.id]);

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
        if (m.sender === "admin") setTyping(false);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadId]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, typing]);

  // typing indicator timeout (на случай, если ответ не пришёл)
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setTyping(false), 60_000);
    return () => clearTimeout(t);
  }, [typing]);

  async function handleSend() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setTyping(true);
    try {
      await sendMsg({ data: { content: value } });
      setText("");
    } finally {
      setSending(false);
    }
  }

  if (loading || !isAuthenticated) return null;

  const greetingName = profileName ? profileName.split(" ")[0] : "";

  return (
    <>
      {!open && !hideTrigger && (
        <button
          onClick={openChat}
          aria-label="Открыть чат"
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-lg glow-primary hover:scale-105 transition"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div
          className="fixed z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl right-4 sm:right-6"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
          role="dialog"
          aria-label="Онлайн-помощник"
        >
          <div className="relative flex items-center justify-between border-b border-border bg-gradient-primary px-4 py-3 pr-14 text-primary-foreground">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{ADMIN_NAME}</div>
              <div className="text-xs opacity-80 truncate">
                {greetingName ? `Здравствуйте, ${greetingName}!` : "Ответим в чате"}
              </div>
            </div>
            <button
              onClick={closeChat}
              aria-label="Закрыть"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-offset-background cursor-pointer transition-all hover:bg-primary/90 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 text-right"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                {greetingName ? `Здравствуйте, ${greetingName}! ` : "Здравствуйте! "}
                Чем можем помочь? Опишите задачу — менеджер ответит здесь же.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                <div className="text-[11px] text-muted-foreground mb-0.5 px-1">
                  {m.sender === "user" ? (profileName || "Вы") : ADMIN_NAME}
                </div>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                  m.sender === "user"
                    ? "bg-gradient-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex flex-col items-start" aria-live="polite">
                <div className="text-[11px] text-muted-foreground mb-0.5 px-1">{ADMIN_NAME} печатает…</div>
                <div className="bg-muted text-foreground rounded-2xl px-4 py-3 inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
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
