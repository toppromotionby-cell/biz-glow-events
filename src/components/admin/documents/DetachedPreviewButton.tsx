// Кнопка «Открыть в новом окне»: выносит живое превью документа в отдельное окно
// браузера (удобно на втором мониторе). Каркас страницы пишется один раз при
// открытии, дальше обновляется только содержимое — без мигания и без сброса
// прокрутки. Обновления дебаунсятся, чтобы быстрый ввод не тормозил редактор.
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MOUNT_ID = "doc-preview-root";

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

  // Держим содержимое окна в актуальном состоянии (только innerHTML контейнера).
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const w = winRef.current;
      if (!w || w.closed) return;
      const mount = w.document.getElementById(MOUNT_ID);
      if (!mount) return;
      mount.innerHTML = html;
      if (w.document.title !== title) w.document.title = title;
    }, 150);
    return () => window.clearTimeout(timer);
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
    if (existing && !existing.closed && existing.document.getElementById(MOUNT_ID)) {
      existing.focus();
      setOpen(true);
      return;
    }
    const w = window.open("", "doc-preview", "width=1100,height=1400,noopener=no");
    if (!w) {
      toast.error("Браузер заблокировал новое окно — разрешите всплывающие окна для сайта");
      return;
    }
    // Каркас пишем один раз: стили уже внутри переданного html-документа.
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Оборачиваем содержимое body в контейнер, который будем обновлять точечно.
    const body = w.document.body;
    if (body && !w.document.getElementById(MOUNT_ID)) {
      const mount = w.document.createElement("div");
      mount.id = MOUNT_ID;
      while (body.firstChild) mount.appendChild(body.firstChild);
      body.appendChild(mount);
    }
    w.document.title = title;
    winRef.current = w;
    setOpen(true);
  };

  return (
    <Button type="button" size="sm" variant="outline" className={className} onClick={handleClick}>
      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />В новом окне
    </Button>
  );
}
