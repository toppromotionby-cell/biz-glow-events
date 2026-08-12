// Панель «Доступ»: публичная ссылка на презентацию и история версий.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, ExternalLink, History, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import {
  setPresentationShare, listPresentationVersions,
  createPresentationVersion, restorePresentationVersion,
} from "@/lib/presentations.functions";

export function PresentationSharePanel({
  id, token, enabled, onSaveBeforeSnapshot, onRestored,
}: {
  id: string;
  token: string;
  enabled: boolean;
  /** Сохранить текущие правки перед снимком/откатом. */
  onSaveBeforeSnapshot?: () => Promise<void> | void;
  onRestored?: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [share, setShare] = useState(enabled);
  const [label, setLabel] = useState("");

  const url = typeof window !== "undefined" && token ? `${window.location.origin}/p/${token}` : "";

  const toggle = useMutation({
    mutationFn: useServerFn(setPresentationShare),
    onSuccess: (r) => {
      setShare(r.enabled);
      toast.success(r.enabled ? "Ссылка включена" : "Доступ по ссылке выключен");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const versions = useQuery({
    queryKey: ["presentation-versions", id],
    queryFn: () => listPresentationVersions({ data: { id } }),
  });

  const snapshot = useMutation({
    mutationFn: async (l: string) => {
      await onSaveBeforeSnapshot?.();
      return createPresentationVersion({ data: { id, label: l } });
    },
    onSuccess: () => {
      setLabel("");
      void qc.invalidateQueries({ queryKey: ["presentation-versions", id] });
      toast.success("Версия сохранена");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => restorePresentationVersion({ data: { id, versionId } }),
    onSuccess: () => {
      toast.success("Версия восстановлена");
      onRestored?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="p-share">Доступ по ссылке</Label>
          <Switch
            id="p-share"
            checked={share}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate({ data: { id, enabled: v } })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Клиент открывает презентацию без входа в систему и может скачать PDF.
        </p>
        {share && url && (
          <div className="flex items-center gap-1.5">
            <Input readOnly value={url} className="h-8 text-xs" aria-label="Публичная ссылка" />
            <Button
              type="button" size="icon" variant="outline" aria-label="Скопировать ссылку"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Ссылка скопирована");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="outline" aria-label="Открыть ссылку" asChild>
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4" />Версии
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            value={label}
            placeholder="Название версии"
            className="h-8 text-xs"
            aria-label="Название версии"
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button
            type="button" size="sm" variant="outline"
            disabled={snapshot.isPending}
            onClick={() => snapshot.mutate(label.trim())}
          >
            <Save className="mr-1.5 h-4 w-4" />Снимок
          </Button>
        </div>
        <ul className="space-y-1">
          {(versions.data ?? []).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
              <span className="min-w-0 truncate text-xs">
                {v.label || new Date(v.created_at).toLocaleString("ru-RU")}
              </span>
              <Button
                type="button" size="sm" variant="ghost"
                disabled={restore.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Восстановить версию?",
                    description: "Текущие слайды будут заменены содержимым снимка.",
                    confirmText: "Восстановить",
                  });
                  if (ok) restore.mutate(v.id);
                }}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />Откатить
              </Button>
            </li>
          ))}
          {!versions.isLoading && !(versions.data ?? []).length && (
            <li className="text-xs text-muted-foreground">Снимков пока нет.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
