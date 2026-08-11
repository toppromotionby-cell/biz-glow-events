// Кнопка «Открыть в новом окне»: выносит живое превью документа в отдельное окно
// браузера (удобно на втором мониторе). Содержимое обновляется автоматически
// при каждом изменении документа.
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DetachedPreviewButton({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const winRef = useRef<Window | null>(null);
  const [open, setOpen] = useState(false);

  // Держим содержимое окна в актуальном состоянии.
  useEffect(() => {
    const w = winRef.current;
    if (!open || !w || w.closed) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = title;
  }, [html, title, open]);

  // Закрываем окно вместе со страницей редактора.
  useEffect(() => {
    const close = () => winRef.current?.close();
    window.addEventListener("beforeunload", close);
    return () => {
      window.removeEventListener("beforeunload", close);
      close();
    };
  }, []);

  const handleClick = () => {
    const existing = winRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      setOpen(true);
      return;
    }
    const w = window.open("", "doc-preview", "width=1100,height=1400,noopener=no");
    if (!w) {
      toast.error("Браузер заблокировал новое окно — разрешите всплывающие окна для сайта");
      return;
    }
    winRef.current = w;
    setOpen(true);
  };

  return (
    <Button type="button" size="sm" variant="outline" className={className} onClick={handleClick}>
      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />В новом окне
    </Button>
  );
}
