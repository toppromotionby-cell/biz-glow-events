// Док ИИ-помощника «Ember»: чат, голос, планы с превью и кнопками решения.
// Виден только главному администратору.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Loader2, Mic, MicOff, Send, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useRoles } from "@/hooks/use-roles";
import { useCopilot } from "@/components/copilot/copilot-context";
import { PlanCard } from "@/components/copilot/PlanCard";
import { copilotDecide, copilotHistory, copilotSend } from "@/lib/copilot/copilot.functions";
import type { CopilotMessage, CopilotRun } from "@/lib/copilot/types";

const QUICK = [
  "Что нового по заявкам за неделю?",
  "Проверь качество данных каталога",
  "Подними цены категории на 5%",
  "Подготовь текст письма клиентам",
];

/** Распознавание речи браузера, если доступно. */
type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CopilotDock() {
  const { has } = useRoles();
  const { open, setOpen, context, prefill, clearPrefill } = useCopilot();
  const qc = useQueryClient();

  const send = useServerFn(copilotSend);
  const history = useServerFn(copilotHistory);
  const decide = useServerFn(copilotDecide);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<ReturnType<SpeechCtor> | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = has("admin");

  const { data } = useQuery({
    queryKey: ["copilot", "history", sessionId],
    enabled: isAdmin && open,
    queryFn: () => history({ data: { sessionId } }),
  });

  const messages: CopilotMessage[] = data?.messages ?? [];
  const runs: CopilotRun[] = data?.runs ?? [];
  const runById = useMemo(() => new Map(runs.map((r) => [r.id, r])), [runs]);

  useEffect(() => {
    if (prefill) {
      setText(prefill);
      clearPrefill();
    }
  }, [prefill, clearPrefill]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  const say = useCallback(
    (phrase: string) => {
      if (!speak || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(phrase.replace(/[*_`#>]/g, "").slice(0, 600));
      u.lang = "ru-RU";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [speak],
  );

  const sendMutation = useMutation({
    mutationFn: (value: string) => send({ data: { sessionId, text: value, context } }),
    onSuccess: (res) => {
      setSessionId(res.sessionId);
      void qc.invalidateQueries({ queryKey: ["copilot"] });
      say(res.reply);
    },
    onError: (e: Error) => toast.error(e.message || "Помощник не ответил"),
  });

  const decideMutation = useMutation({
    mutationFn: (input: { runId: string; decision: "approve" | "reject" | "rollback" }) =>
      decide({ data: input }),
    onSuccess: (res) => {
      toast.success(res.message);
      void qc.invalidateQueries({ queryKey: ["copilot"] });
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось применить план"),
  });

  const submit = () => {
    const value = text.trim();
    if (!value || sendMutation.isPending) return;
    setText("");
    sendMutation.mutate(value);
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) {
      toast.error("Браузер не поддерживает распознавание речи");
      return;
    }
    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const phrase = e.results?.[0]?.[0]?.transcript ?? "";
      if (phrase) setText((prev) => (prev ? `${prev} ${phrase}` : phrase));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  // Cmd/Ctrl + J — быстрый вызов помощника.
  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin, open, setOpen]);

  if (!isAdmin) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="ИИ-помощник Ember"
          className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 grid place-items-center hover:scale-105 transition"
        >
          <Flame className="h-5 w-5" />
        </button>
      )}

      {open && (
        <aside className="fixed z-40 bottom-0 right-0 left-0 sm:left-auto sm:bottom-4 sm:right-4 flex flex-col rounded-t-2xl sm:rounded-2xl border border-border/70 bg-background/95 backdrop-blur-xl shadow-2xl h-[85vh] sm:h-[min(78vh,44rem)] w-full sm:w-[min(28rem,calc(100vw-2rem))]">
          <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <span className="grid place-items-center h-8 w-8 rounded-full bg-primary/15 text-primary">
              <Flame className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Ember</div>
              <div className="text-[11px] text-muted-foreground truncate">{context.section}</div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={speak ? "Выключить озвучку" : "Включить озвучку"}
                onClick={() => setSpeak((v) => !v)}
              >
                {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Закрыть" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <ScrollArea className="flex-1 min-h-0 px-3 py-3">
            <div className="space-y-3">
              {!messages.length && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Я помогу с каталогом, заявками, контентом, документами и рассылками. Сначала покажу превью — применю
                    только после вашего «Утвердить».
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK.map((q) => (
                      <Badge
                        key={q}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setText(q)}
                      >
                        {q}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                const run = m.run_id ? runById.get(m.run_id) : null;
                return (
                  <div key={m.id} className="space-y-2">
                    <div
                      className={
                        m.role === "user"
                          ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm whitespace-pre-wrap"
                          : "max-w-[92%] rounded-2xl rounded-bl-sm bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap"
                      }
                    >
                      {m.content}
                    </div>
                    {!!m.sources.length && (
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        {m.sources.slice(0, 5).map((s) => (
                          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block truncate hover:underline">
                            🔗 {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                    {run && (
                      <PlanCard
                        run={run}
                        busy={decideMutation.isPending}
                        onDecide={(decision) => decideMutation.mutate({ runId: run.id, decision })}
                      />
                    )}
                  </div>
                );
              })}

              {sendMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Думаю и проверяю данные…
                </div>
              )}
              <div ref={endRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 p-2 flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Что сделать? Например: сними с публикации фотозоны без фото"
              className="min-h-[44px] max-h-32 resize-none"
            />
            <Button
              variant={listening ? "default" : "outline"}
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
              onClick={toggleMic}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button size="icon" className="h-10 w-10 shrink-0" aria-label="Отправить" disabled={sendMutation.isPending} onClick={submit}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </aside>
      )}
    </>
  );
}
