// Единое окно «Сохранить в библиотеку» для КП и промо-КП:
// один пункт меню вместо пары «шаблон» / «образец», выбор области видимости — радиокнопками.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/admin/Field";

export type LibraryScope = "shared" | "type";

export function SaveToLibraryDialog({
  open,
  onOpenChange,
  defaultName,
  typeLabel,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Подставляется в поле названия при открытии. */
  defaultName: string;
  /** Как называется тип документа: «КП» или «КП промо». */
  typeLabel: string;
  onSave: (name: string, scope: LibraryScope) => Promise<void> | void;
}) {
  const [name, setName] = useState(defaultName);
  const [scope, setScope] = useState<LibraryScope>("shared");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave(name.trim() || defaultName, scope);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Сохранить в библиотеку</DialogTitle>
        </DialogHeader>

        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Корпоратив под ключ" />
        </Field>

        <RadioGroup value={scope} onValueChange={(v) => setScope(v as LibraryScope)} className="gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3">
            <RadioGroupItem value="shared" className="mt-0.5" />
            <span className="space-y-0.5">
              <Label className="cursor-pointer">Образец сметы — для любого документа</Label>
              <span className="block text-xs text-muted-foreground">
                Доступен при создании и КП, и КП промо. Подходит для типовых составов.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3">
            <RadioGroupItem value="type" className="mt-0.5" />
            <span className="space-y-0.5">
              <Label className="cursor-pointer">Шаблон только для «{typeLabel}»</Label>
              <span className="block text-xs text-muted-foreground">
                Сохраняет документ целиком: оформление, тексты и настройки этого типа.
              </span>
            </span>
          </label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={busy}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
