// Единая кнопка «Отправить в Telegram» для всех типов документов админки.
// Собирает PDF на сервере и отправляет файл в чат администратора.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { sendDocumentToTelegram } from "@/lib/telegram-docs.functions";
import type { TgDocKind } from "@/lib/telegram/doc-kinds";

interface Props {
  kind: TgDocKind;
  id: string;
  /** Отрисовать пунктом меню вместо отдельной кнопки. */
  asMenuItem?: boolean;
  label?: string;
  disabled?: boolean;
}

export function SendToTelegramButton({ kind, id, asMenuItem, label = "Отправить в Telegram", disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendDocumentToTelegram);

  async function run() {
    if (busy) return;
    setBusy(true);
    const t = toast.loading("Готовлю файл для Telegram…");
    try {
      const res = await send({ data: { kind, id } });
      if (res.ok) toast.success("Отправлено в Telegram", { id: t });
      else toast.error(res.error ?? "Не удалось отправить", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить", { id: t });
    } finally {
      setBusy(false);
    }
  }

  if (asMenuItem) {
    return (
      <DropdownMenuItem
        disabled={disabled || busy}
        onSelect={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        {label}
      </DropdownMenuItem>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void run()} disabled={disabled || busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
      Telegram
    </Button>
  );
}
