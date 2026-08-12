// Живое превью документа в iframe без перезагрузки:
// каркас (стили + скрипты подсказок/автоподгонки) пишется один раз,
// дальше точечно обновляется только содержимое — без мигания и сброса прокрутки.
import { useEffect, useImperativeHandle, useRef, type CSSProperties, type Ref } from "react";

const MOUNT_ID = "doc-preview-root";
const UPDATE_MS = 120;

/** Тело документа без служебных узлов (скрипты и подсказка живут в каркасе). */
function bodyContent(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, #edit-hint").forEach((n) => n.remove());
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

export function LivePreviewFrame({
  html,
  title,
  className,
  style,
  frameRef,
}: {
  html: string;
  title: string;
  className?: string;
  style?: CSSProperties;
  /** Ссылка на iframe — нужна для проверки источника postMessage. */
  frameRef?: Ref<HTMLIFrameElement | null>;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const htmlRef = useRef(html);
  htmlRef.current = html;

  useImperativeHandle(frameRef, () => ref.current as HTMLIFrameElement, []);

  // Первичная запись каркаса.
  useEffect(() => {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc || readyRef.current) return;
    doc.open();
    doc.write(htmlRef.current);
    doc.close();
    const body = doc.body;
    if (body && !doc.getElementById(MOUNT_ID)) {
      const mount = doc.createElement("div");
      mount.id = MOUNT_ID;
      const keep: ChildNode[] = [];
      Array.from(body.childNodes).forEach((n) => {
        const el = n as HTMLElement;
        const isScript = el.tagName === "SCRIPT";
        const isHint = el.id === "edit-hint";
        if (isScript || isHint) keep.push(n);
        else mount.appendChild(n);
      });
      body.textContent = "";
      body.appendChild(mount);
      keep.forEach((n) => body.appendChild(n));
    }
    readyRef.current = true;
  }, []);

  // Точечные обновления содержимого.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const doc = ref.current?.contentDocument;
      const mount = doc?.getElementById(MOUNT_ID);
      if (!doc || !mount) return;
      mount.innerHTML = bodyContent(html);
    }, UPDATE_MS);
    return () => window.clearTimeout(t);
  }, [html]);

  return <iframe ref={ref} title={title} className={className} style={style} />;
}
