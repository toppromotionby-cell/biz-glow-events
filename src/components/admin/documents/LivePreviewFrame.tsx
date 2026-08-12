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
    // Внутри редактора масштабирует сцена, поэтому собственный зум листа
    // отключаем — иначе масштаб накладывается дважды и содержимое «съезжает».
    const fix = doc.createElement("style");
    fix.textContent =
      "html,body{background:#fff!important;}body{zoom:1!important;padding:0!important;}" +
      ".sheet{box-shadow:none!important;margin:0 auto!important;}" +
      "[data-edit]{cursor:pointer}[data-edit]:hover{outline:2px solid #2563eb;outline-offset:-2px}" +
      "#edit-hint{position:fixed;z-index:9999;padding:2px 6px;border-radius:6px;background:#111;color:#fff;" +
      "font:500 11px/1.4 system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .12s}" +
      "#edit-hint.on{opacity:1}";
    doc.head?.appendChild(fix);

    // Подсказка «двойной клик» живёт в каркасе, поэтому не пропадает при
    // обновлении содержимого и при включении правки уже после открытия.
    if (!doc.getElementById("edit-hint")) {
      const hint = doc.createElement("div");
      hint.id = "edit-hint";
      hint.textContent = "Двойной клик — редактировать";
      doc.body?.appendChild(hint);
    }
    let currentHover: Element | null = null;
    doc.addEventListener("mouseover", (e) => {
      const hint = doc.getElementById("edit-hint");
      if (!hint) return;
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-edit]") ?? null;
      if (el === currentHover) return;
      currentHover = el;
      if (!el) { hint.classList.remove("on"); return; }
      const r = el.getBoundingClientRect();
      hint.textContent = `${el.getAttribute("data-edit-label") || "Блок"} · двойной клик`;
      hint.style.left = `${Math.max(6, r.left)}px`;
      hint.style.top = `${Math.max(6, r.top - 20)}px`;
      hint.classList.add("on");
    });

    readyRef.current = true;
  }, []);

  // Точечные обновления содержимого + выравнивание сетки таблиц.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const doc = ref.current?.contentDocument;
      const mount = doc?.getElementById(MOUNT_ID);
      if (!doc || !mount) return;
      mount.innerHTML = bodyContent(html);
      requestAnimationFrame(() => syncTableWidths(doc));
    }, UPDATE_MS);
    return () => window.clearTimeout(t);
  }, [html]);

  // Ширина листа меняется вместе с панелями — пересчитываем колонки.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncTableWidths(el.contentDocument));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return <iframe ref={ref} title={title} className={className} style={style} />;
}

