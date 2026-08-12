// Единая защита от потери данных в админ-редакторах.
// Блокирует переход по SPA-навигации и закрытие вкладки, пока есть несохранённые правки.
// Использование:
//   const { guardDialog } = useUnsavedGuard(dirty);
//   ...  {guardDialog}
import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useConfirm } from "@/components/admin/ConfirmDialog";

export function useUnsavedGuard(dirty: boolean, opts: { beforeUnload?: boolean } = {}) {
  const { beforeUnload = true } = opts;
  const { confirm, dialog } = useConfirm();

  useBlocker({
    shouldBlockFn: async () => {
      if (!dirty) return false;
      const ok = await confirm({
        title: "Есть несохранённые правки",
        description: "Если уйти сейчас, последние изменения могут не сохраниться на сервере.",
        confirmText: "Уйти без сохранения",
        cancelText: "Остаться",
        destructive: true,
      });
      return !ok;
    },
    enableBeforeUnload: false,
  });

  useEffect(() => {
    if (!beforeUnload || !dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty, beforeUnload]);

  return { guardDialog: dialog };
}
