// Замена нативному window.confirm() — доступный AlertDialog.
// Использование: const confirm = useConfirm(); if (await confirm({ title, description })) { ... }
import { useCallback, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Opts = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export function useConfirm() {
  const [state, setState] = useState<{ opts: Opts; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((opts: Opts) => {
    return new Promise<boolean>((resolve) => setState({ opts, resolve }));
  }, []);

  const handle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const dialog = state ? (
    <AlertDialog open onOpenChange={(open) => { if (!open) handle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.opts.title}</AlertDialogTitle>
          {state.opts.description && (
            <AlertDialogDescription>{state.opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handle(false)}>
            {state.opts.cancelText ?? "Отмена"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handle(true)}
            className={state.opts.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {state.opts.confirmText ?? "Подтвердить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { confirm, dialog };
}
