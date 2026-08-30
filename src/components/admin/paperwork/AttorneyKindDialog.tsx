// Шаг перед созданием доверенности: какую именно доверенность оформляем.
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ATTORNEY_KINDS } from "@/lib/paperwork/attorney-presets";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  /** presetId === null — пустая доверенность без шаблона. */
  onPick: (presetId: string | null) => void;
};

export function AttorneyKindDialog({ open, onOpenChange, busy, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Какую доверенность создать?</DialogTitle>
          <DialogDescription>
            Текст и полномочия подставим из образца — останется заполнить данные поверенного и срок.
          </DialogDescription>
        </DialogHeader>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Создаём доверенность…
          </div>
        )}

        <div className="space-y-2">
          {ATTORNEY_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              disabled={busy}
              onClick={() => onPick(k.presetId)}
              className="w-full rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-accent/50 disabled:opacity-60"
            >
              <span className="block font-medium">{k.label}</span>
              <span className="block text-sm text-muted-foreground">{k.hint}</span>
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onPick(null)}>
          Пустая доверенность без шаблона
        </Button>
      </DialogContent>
    </Dialog>
  );
}
