// Кнопка «Сбросить состав»: убирает все разделы и позиции документа
// (данные шапки, реквизиты и настройки остаются нетронутыми).
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ClearCompositionButton({
  count,
  onClear,
}: {
  /** Сколько позиций сейчас в документе — кнопка неактивна, если их нет. */
  count: number;
  onClear: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={count === 0} className="text-destructive">
          <Trash2 className="mr-1 h-4 w-4" />Сбросить состав
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Убрать все разделы и позиции?</AlertDialogTitle>
          <AlertDialogDescription>
            Из документа будут удалены все {count} позиций вместе с разделами. Шапка, реквизиты,
            тексты и настройки документа сохранятся. Изменение можно отменить, не сохраняя документ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onClear}>Убрать</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
