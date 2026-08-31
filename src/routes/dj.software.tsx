// Каталог DJ-софта с версиями и загрузкой для участников клуба.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Search, Wrench } from "lucide-react";
import { MemberGate } from "@/components/dj/MemberGate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { djListSoftware, djSoftwareDownload } from "@/lib/dj/dj.functions";
import { PLATFORMS, SOFTWARE_CATEGORIES, formatBytes } from "@/lib/dj/types";

const ANY = "__any__";

export const Route = createFileRoute("/dj/software")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "DJ-софт и плагины — DJ Hub event-hub.by" },
      { name: "description", content: "Каталог диджейского софта: версии, платформы, даты релизов и дистрибутивы для участников клуба." },
      { property: "og:title", content: "DJ-софт — DJ Hub" },
      { property: "og:description", content: "Актуальные версии DJ-программ, DAW, плагинов и утилит." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <MemberGate><SoftwarePage /></MemberGate>,
});

function SoftwarePage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>(ANY);
  const [platform, setPlatform] = useState<string>(ANY);
  const [busy, setBusy] = useState<string | null>(null);

  const params = {
    q: q || undefined,
    category: category === ANY ? undefined : category,
    platform: platform === ANY ? undefined : platform,
  };

  const { data = [], isLoading } = useQuery({
    queryKey: ["dj", "software", params],
    queryFn: () => djListSoftware({ data: params }),
    placeholderData: (prev) => prev,
  });

  async function download(versionId: string) {
    setBusy(versionId);
    try {
      const { url } = await djSoftwareDownload({ data: { versionId } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось получить файл");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-shell max-w-6xl py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold gradient-text">DJ-софт</h1>
        <p className="mt-1 text-sm text-muted-foreground">Программы, плагины и утилиты с историей версий.</p>
      </header>

      <div className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию" className="pl-9" aria-label="Поиск софта" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Категория"><SelectValue placeholder="Категория" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Все категории</SelectItem>
            {SOFTWARE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger aria-label="Платформа"><SelectValue placeholder="Платформа" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Все платформы</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <div className="glass mt-6 rounded-2xl p-12 text-center text-muted-foreground">Пока пусто — каталог наполняется.</div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {data.map((s) => (
            <li key={s.id} className="glass rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Wrench className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">{s.name}</h2>
                  <p className="text-xs text-muted-foreground">{s.vendor ?? "—"}</p>
                  {s.description && <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(s.platforms ?? []).map((p) => (
                      <Badge key={p} variant="secondary" className="font-normal">
                        {PLATFORMS.find((x) => x.value === p)?.label ?? p}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {(s.versions ?? []).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">v{v.version}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.release_date ? new Date(v.release_date).toLocaleDateString("ru-RU") : "дата не указана"} · {formatBytes(v.file_size)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" disabled={busy === v.id} onClick={() => void download(v.id)}>
                      {busy === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>
                  </li>
                ))}
                {(s.versions ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">Версии ещё не загружены.</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
