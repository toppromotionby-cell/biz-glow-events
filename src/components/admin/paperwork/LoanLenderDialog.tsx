// Шаг перед созданием договора займа: кто выдаёт заём — от ответа зависит шаблон.
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LOAN_LENDERS } from "@/lib/paperwork/loan-presets";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  /** presetId === null — пустой договор без шаблона. */
  onPick: (presetId: string | null) => void;
};

export function LoanLenderDialog({ open, onOpenChange, busy, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Кто выдаёт заём?</DialogTitle>
          <DialogDescription>
            Подставим нужный шаблон договора с реквизитами сторон и подписантом.
          </DialogDescription>
        </DialogHeader>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Создаём договор…
          </div>
        )}

        <div className="space-y-2">
          {LOAN_LENDERS.map((l) => (
            <button
              key={l.key}
              type="button"
              disabled={busy}
              onClick={() => onPick(l.presetId)}
              className="w-full rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-accent/50 disabled:opacity-60"
            >
              <span className="block font-medium">{l.label}</span>
              <span className="block text-sm text-muted-foreground">{l.hint}</span>
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onPick(null)}>
          Пустой договор без шаблона
        </Button>
      </DialogContent>
    </Dialog>
  );
}
