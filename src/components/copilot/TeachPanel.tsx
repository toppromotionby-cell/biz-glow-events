// Ручное обучение ИИ-управленца: загрузить документ → превью фактов → утвердить → база знаний.
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BookOpenCheck, FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copilotTeachApprove, copilotTeachPreview } from "@/lib/copilot/copilot.functions";
import { acceptsTeachFile, type TeachCandidate, type TeachPreview } from "@/lib/copilot/teach";

function humanSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

/** Чтение файла: текст — строкой, PDF и картинки — base64 без префикса data:. */
async function readFile(file: File, kind: "pdf" | "image" | "text"): Promise<{ text?: string; base64?: string }> {
  if (kind === "text") return { text: await file.text() };
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  return { base64: btoa(bin) };
}

export function TeachPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [preview, setPreview] = useState<TeachPreview | null>(null);
  const [rows, setRows] = useState<(TeachCandidate & { keep: boolean })[]>([]);

  const analyze = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Выберите файл");
      const check = acceptsTeachFile(file.type, file.size, file.name);
      if (!check.ok) throw new Error(check.reason ?? "Неподдерживаемый файл");
      const body = await readFile(file, check.kind ?? "text");
      return copilotTeachPreview({
        data: {
          filename: file.name,
          mime: file.type || (check.kind === "pdf" ? "application/pdf" : "text/plain"),
          bytes: file.size,
          ...body,
          ...(hint.trim() ? { hint: hint.trim() } : {}),
        },
      });
    },
    onSuccess: (r) => {
      if (!r.ok || !r.preview) {
        toast.error(r.message ?? "Не удалось разобрать документ");
        return;
      }
      setPreview(r.preview);
      setRows(r.preview.candidates.map((c) => ({ ...c, keep: true })));
      toast.success(`Найдено фактов: ${r.preview.candidates.length}. Проверьте и утвердите.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: () => {
      const chosen = rows.filter((r) => r.keep && r.subject.trim() && r.fact.trim());
      if (!chosen.length) throw new Error("Не выбрано ни одного факта");
      return copilotTeachApprove({
        data: {
          title: preview?.title ?? "Обучение",
          filename: preview?.filename ?? file?.name ?? "документ",
          candidates: chosen.map(({ keep: _keep, ...c }) => c),
        },
      });
    },
    onSuccess: (r) => {
      toast.success(r.message);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setPreview(null);
    setRows([]);
    setFile(null);
    setHint("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Загрузите документ для обучения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="teach-file">Файл</Label>
              <Input
                id="teach-file"
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,.json,.html,.xml,image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setPreview(null);
                  setRows([]);
                  if (f) {
                    const check = acceptsTeachFile(f.type, f.size, f.name);
                    if (!check.ok) {
                      toast.error(check.reason ?? "Неподдерживаемый файл");
                      e.target.value = "";
                      setFile(null);
                      return;
                    }
                  }
                  setFile(f);
                }}
              />
              <p className="text-xs text-muted-foreground">
                PDF, сканы и фото (PNG, JPG, WEBP), а также TXT, MD, CSV, JSON. До 12 МБ.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teach-hint">На что обратить внимание (необязательно)</Label>
              <Textarea
                id="teach-hint"
                rows={2}
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Например: запомни условия оплаты и сроки монтажа"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => analyze.mutate()} disabled={!file || analyze.isPending} className="gap-2">
              {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Разобрать документ
            </Button>
            {file && (
              <span className="text-sm text-muted-foreground">
                {file.name} · {humanSize(file.size)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{preview.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{preview.summary}</p>

            <div className="space-y-3">
              {rows.map((r, i) => (
                <div
                  key={r.id}
                  className={`rounded-xl border p-3 transition ${r.keep ? "border-border/60" : "border-border/40 opacity-55"}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={r.keep}
                      onCheckedChange={(v) =>
                        setRows((prev) => prev.map((x, xi) => (xi === i ? { ...x, keep: v === true } : x)))
                      }
                      className="mt-2"
                      aria-label="Сохранить этот факт"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={r.subject}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, xi) => (xi === i ? { ...x, subject: e.target.value } : x)))
                        }
                        placeholder="Тема факта"
                      />
                      <Textarea
                        rows={2}
                        value={r.fact}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, xi) => (xi === i ? { ...x, fact: e.target.value } : x)))
                        }
                        placeholder="Сам факт"
                      />
                      {r.tags.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">Теги: {r.tags.join(", ")}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => approve.mutate()} disabled={approve.isPending} className="gap-2">
                {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
                Утвердить и записать в базу знаний
              </Button>
              <Button variant="ghost" onClick={reset} className="gap-2">
                <Trash2 className="h-4 w-4" /> Отменить
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Утверждённые факты сразу видят ИИ-управленец и оба Telegram-бота — база знаний общая.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
