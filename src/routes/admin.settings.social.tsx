// Админ-настройки соцсетей: Instagram + TikTok URL. Правки уходят автоматически.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";
import { invalidateEntity } from "@/lib/admin/invalidate";
import { useEditorSave } from "@/hooks/use-editor-save";
import { SaveStatus } from "@/components/admin/SaveStatus";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Save, Loader2, ExternalLink } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings.functions";


export const Route = createFileRoute("/admin/settings/social")({
  head: () => ({
    meta: [
      { title: "Соцсети — Админ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SocialSettingsPage,
});

function isValidUrl(v: string): boolean {
  if (!v.trim()) return true;
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function SocialSettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSiteSettings);
  const updateFn = useServerFn(updateSiteSettings);

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.siteSettings,
    queryFn: () => getFn(),
  });

  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const loaded = useRef(false);

  const igValid = isValidUrl(instagram);
  const ttValid = isValidUrl(tiktok);
  const canSave = igValid && ttValid;

  // Автосохранение: правки уходят через ~1.2 с после последнего ввода.
  const save = useEditorSave(async () => {
    if (!isValidUrl(instagram) || !isValidUrl(tiktok)) return;
    await updateFn({
      data: {
        instagram_url: instagram.trim() ? instagram.trim() : null,
        tiktok_url: tiktok.trim() ? tiktok.trim() : null,
      },
    });
    invalidateEntity(qc, "social");
  }, loaded.current);

  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    setInstagram(data.instagram_url ?? "");
    setTiktok(data.tiktok_url ?? "");
    save.reset();
  }, [data, save]);

  useEffect(() => {
    if (save.state === "error" && save.error) toast.error(save.error);
  }, [save.state, save.error]);

  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    save.markDirty();
  };


  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="Соцсети"
        subtitle="Укажите ссылки на ваши профили — иконки появятся в подвале сайта и на странице «Контакты»."
        icon={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl btn-primary-gradient">
            <Instagram className="h-5 w-5 text-primary-foreground" />
          </span>
        }
      />

      <div className="glass rounded-xl p-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ig" className="flex items-center gap-2">
            <Instagram className="h-4 w-4 text-primary" /> Instagram URL
          </Label>
          <Input
            id="ig"
            type="url"
            placeholder="https://instagram.com/your-profile"
            value={instagram}
            onChange={(e) => edit(setInstagram)(e.target.value)}
            disabled={isLoading}
            className={!igValid ? "border-destructive" : ""}
          />
          {!igValid && <p className="text-xs text-destructive">Введите корректный URL (https://…)</p>}
          {instagram && igValid && (
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Открыть профиль
            </a>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tt" className="flex items-center gap-2">
            <TikTokIcon size={16} className="text-primary" /> TikTok URL
          </Label>
          <Input
            id="tt"
            type="url"
            placeholder="https://tiktok.com/@your-profile"
            value={tiktok}
            onChange={(e) => edit(setTiktok)(e.target.value)}
            disabled={isLoading}
            className={!ttValid ? "border-destructive" : ""}
          />
          {!ttValid && <p className="text-xs text-destructive">Введите корректный URL (https://…)</p>}
          {tiktok && ttValid && (
            <a
              href={tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Открыть профиль
            </a>
          )}
        </div>

        <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Оставьте поле пустым, чтобы скрыть соответствующую иконку. Правки сохраняются автоматически.
          </p>
          <div className="flex items-center gap-3">
            <SaveStatus state={save.state} errorMessage={save.error} />
            <Button
              onClick={save.saveNow}
              disabled={!canSave || save.state === "saving" || isLoading}
              className="btn-primary-gradient"
            >
              {save.state === "saving" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Сохранить
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
