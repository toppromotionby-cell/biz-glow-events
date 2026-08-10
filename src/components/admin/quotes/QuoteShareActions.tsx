// Панель отправки КП клиенту: копирование публичной ссылки, предпросмотр «как клиент»
// и письмо со ссылкой + PDF. Используется в редакторах обычного КП и КП промо.
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Link2, Mail, Eye, Loader2 } from "lucide-react";

export type ShareState = {
  token: string;
  email: string;
  sentAt: string | null;
  viewedAt: string | null;
  clientResponse: string;
  clientComment: string;
};

type Props = {
  share: ShareState;
  onSend: (input: { email: string; note: string; attachPdf: boolean }) => Promise<void>;
  /** Критичные замечания документа: показываем предупреждение перед отправкой. */
  issues?: string[];
};

export function QuoteShareActions({ share, onSend, issues = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(share.email);
  const [note, setNote] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const blocked = issues.length > 0 && !confirmed;

  const url = share.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/kp/${share.token}` : "";

  const copy = async () => {
    if (!url) return toast.error("Ссылка недоступна");
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка для клиента скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const submit = async () => {
    if (!email.trim()) return toast.error("Укажите e-mail клиента");
    setBusy(true);
    try {
      await onSend({ email: email.trim(), note: note.trim(), attachPdf });
      setOpen(false);
      setNote("");
      toast.success(`Отправлено на ${email.trim()}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={copy} disabled={!url}>
        <Link2 className="h-4 w-4 mr-1.5" />Ссылка
      </Button>
      <Button variant="outline" size="sm" asChild disabled={!url}>
        <a href={url || "#"} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 mr-1.5" />Как клиент</a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => { setEmail(share.email); setConfirmed(false); setOpen(true); }}>
        <Mail className="h-4 w-4 mr-1.5" />Отправить
        {issues.length > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">{issues.length}</Badge>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отправить КП клиенту</DialogTitle>
            <DialogDescription>
              Клиент получит письмо со ссылкой на документ и сможет согласовать его онлайн.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {issues.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />В документе не хватает данных
                </div>
                <ul className="space-y-0.5">
                  {issues.slice(0, 6).map((m, i) => <li key={i}>• {m}</li>)}
                  {issues.length > 6 && <li>… ещё {issues.length - 6}</li>}
                </ul>
                <label className="mt-1 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  Понимаю риск, отправить как есть
                </label>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="share-email">E-mail клиента</Label>
              <Input id="share-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.by" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-note">Сообщение (необязательно)</Label>
              <Textarea id="share-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Добрый день! Направляем предложение…" />
            </div>
            <label className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
              Приложить PDF к письму
              <Switch checked={attachPdf} onCheckedChange={setAttachPdf} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={submit} disabled={busy || blocked}>
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {issues.length ? "Всё равно отправить" : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Компактный статус доставки: отправлено / просмотрено / решение клиента. */
export function QuoteShareStatus({ share }: { share: ShareState }) {
  const d = (v: string | null) => (v ? new Date(v).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "");
  if (share.clientResponse === "accepted") {
    return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Клиент согласовал{share.clientComment ? ` · «${share.clientComment}»` : ""}</Badge>;
  }
  if (share.clientResponse === "rejected") {
    return <Badge variant="destructive">Клиент отказался{share.clientComment ? ` · «${share.clientComment}»` : ""}</Badge>;
  }
  if (share.viewedAt) return <Badge variant="secondary">Просмотрено {d(share.viewedAt)}</Badge>;
  if (share.sentAt) return <Badge variant="outline">Отправлено {d(share.sentAt)}</Badge>;
  return null;
}
