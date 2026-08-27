// AI-помощник и импорт DOCX: черновик документа или перенос основы из Word.
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { draftPaperworkWithAi, importPaperworkDocx } from "@/lib/paperwork.functions";
import type { PwBlock, PwDocType } from "@/lib/paperwork/model";

const MODES = [
  { key: "create", label: "Создать документ по описанию" },
  { key: "rewrite", label: "Переписать текущий текст" },
] as const;

const toBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

export function PwAiPanel({
  docType,
  companyName,
  currentText,
  onApply,
}: {
  docType: PwDocType;
  companyName: string;
  currentText: string;
  onApply: (blocks: PwBlock[], title: string, mode: "replace" | "append") => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("create");
  const fileRef = useRef<HTMLInputElement>(null);

  const draft = useServerFn(draftPaperworkWithAi);
  const importDocx = useServerFn(importPaperworkDocx);

  const aiMutation = useMutation({
    mutationFn: () => draft({ data: { prompt, docType, companyName, mode, currentText: currentText.slice(0, 8000) } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? "AI не смог составить документ");
        return;
      }
      onApply(res.blocks, res.title, mode === "create" ? "replace" : "replace");
      toast.success("Черновик готов — проверьте текст перед отправкой");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return importDocx({ data: { fileBase64: toBase64(bytes), fileName: file.name } });
    },
    onSuccess: (res) => {
      res.warnings.forEach((w) => toast.warning(w));
      if (!res.blocks.length) return;
      onApply(res.blocks, "", "append");
      toast.success(
        `Импортировано: абзацев ${res.stats.paragraphs}, заголовков ${res.stats.headings}, списков ${res.stats.lists}, таблиц ${res.stats.tables}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI-помощник</h3>
        </div>
        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MODES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Например: письмо-уведомление арендодателю о переносе мероприятия на другую дату с просьбой подтвердить бронь"
        />
        <Button onClick={() => aiMutation.mutate()} disabled={prompt.trim().length < 3 || aiMutation.isPending}>
          {aiMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
          Составить
        </Button>
        <p className="text-xs text-muted-foreground">
          Реквизиты, даты и имена AI подставляет переменными — они заполнятся из профиля компании.
        </p>
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Импорт из DOCX</h3>
        </div>
        <Label className="text-xs text-muted-foreground">
          Текст, списки и таблицы переносятся в блоки. Картинки и сложная вёрстка Word — нет.
        </Label>
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importMutation.mutate(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMutation.isPending}>
          {importMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
          Выбрать файл
        </Button>
      </section>
    </div>
  );
}
