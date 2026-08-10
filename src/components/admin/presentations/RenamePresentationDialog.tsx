// Переименование презентации из списка — модалка с валидацией.
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RenamePresentationDialog({
  open,
  initialTitle,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initialTitle: string;
  saving?: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (title: string) => void;
}) {
  const [value, setValue] = useState(initialTitle);

  useEffect(() => {
    if (open) setValue(initialTitle);
  }, [open, initialTitle]);

  const trimmed = value.trim();
  const error =
    trimmed.length === 0
      ? "Название не может быть пустым"
      : trimmed.length > 200
        ? "Не длиннее 200 символов"
        : null;

  const submit = () => {
    if (error) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Переименовать презентацию</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="presentation-title">Название</Label>
          <Input
            id="presentation-title"
            autoFocus
            value={value}
            maxLength={220}
            aria-invalid={!!error}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submit(); }
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button disabled={!!error || saving} onClick={submit}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
