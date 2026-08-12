// Раздвижное рабочее пространство редакторов (документы и презентации):
// левая панель раздела, холст и панель свойств разделены перетаскиваемыми
// разделителями. Размеры запоминаются в браузере отдельно для каждого
// редактора, двойной клик по разделителю возвращает размер по умолчанию.
import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";

const STORAGE_PREFIX = "editor-layout:";

function readLayout(key: string): Layout | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return undefined;
    const out: Layout = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

function writeLayout(key: string, layout: Layout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(layout));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

/** Разделитель с видимой «ручкой». */
function Handle({ id }: { id: string }) {
  return (
    <Separator
      id={id}
      className="group relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/50 transition-colors hover:bg-primary/40 data-[separator-dragging]:bg-primary/60"
      style={{ touchAction: "none" }}
    >
      <span className="pointer-events-none h-8 w-[3px] rounded-full bg-border transition group-hover:bg-primary" />
    </Separator>
  );
}

export function EditorWorkspace({
  storageKey,
  rail,
  leftPanel,
  center,
  rightPanel,
  className,
}: {
  /** Ключ для запоминания раскладки (свой у документов и презентаций). */
  storageKey: string;
  /** Вертикальный рельс разделов — не участвует в изменении размеров. */
  rail?: ReactNode;
  /** Панель активного раздела; null — панель свёрнута. */
  leftPanel?: ReactNode | null;
  center: ReactNode;
  rightPanel?: ReactNode | null;
  className?: string;
}) {
  // Ключ зависит от набора видимых панелей: раскладка «с левой панелью» и
  // «без неё» сохраняются отдельно и не конфликтуют.
  const variant = `${storageKey}:${leftPanel ? "l" : ""}${rightPanel ? "r" : ""}`;
  const defaultLayout = useMemo(() => readLayout(variant), [variant]);
  const keyRef = useRef(variant);
  keyRef.current = variant;
  const onLayoutChanged = useCallback((layout: Layout) => writeLayout(keyRef.current, layout), []);

  return (
    <div className={`flex min-h-0 flex-1 ${className ?? ""}`}>
      {rail}
      <Group
        key={variant}
        orientation="horizontal"
        className="flex min-h-0 min-w-0 flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        {leftPanel && (
          <>
            <Panel id="left" defaultSize="22%" minSize="14%" maxSize="50%" className="flex min-h-0 min-w-0 flex-col">
              {leftPanel}
            </Panel>
            <Handle id="sep-left" />
          </>
        )}
        <Panel id="center" minSize="25%" className="flex min-h-0 min-w-0 flex-col">
          {center}
        </Panel>
        {rightPanel && (
          <>
            <Handle id="sep-right" />
            <Panel id="right" defaultSize="22%" minSize="14%" maxSize="45%" className="flex min-h-0 min-w-0 flex-col">
              {rightPanel}
            </Panel>
          </>
        )}
      </Group>
    </div>
  );
}
