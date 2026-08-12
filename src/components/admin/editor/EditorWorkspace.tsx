// Раздвижное рабочее пространство редакторов (документы и презентации):
// левая панель раздела, холст и панель свойств разделены перетаскиваемыми
// разделителями. Размеры запоминаются в браузере и в профиле пользователя
// отдельно для каждого редактора.
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import { prefsVersion, pullRemotePrefs, readPref, subscribePrefs, writePref } from "@/lib/editor/workspace-prefs";


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
  // Настройки из профиля приезжают асинхронно — при их появлении раскладка
  // пересобирается (version меняется → Group монтируется заново).
  const version = useSyncExternalStore(subscribePrefs, prefsVersion, () => 0);
  useEffect(() => { void pullRemotePrefs(); }, []);
  const defaultLayout = useMemo(() => readPref(variant) as Layout | undefined, [variant, version]);
  const keyRef = useRef(variant);
  keyRef.current = variant;
  const onLayoutChanged = useCallback((layout: Layout) => writePref(keyRef.current, layout), []);

  return (
    <div className={`flex min-h-0 flex-1 ${className ?? ""}`}>
      {rail}
      <Group
        key={`${variant}:${version}`}
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
