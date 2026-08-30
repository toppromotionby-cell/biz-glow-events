// Управление видимостью секций сайта.
// iOS-style переключатели для каждой зарегистрированной секции.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTION_REGISTRY } from "@/lib/site-sections";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin/sections")({
  head: () => ({ meta: [{ title: "Блоки на сайте — admin" }] }),
  component: SectionsAdmin,
});

function SectionsAdmin() {
  const [state, setState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("site_sections").select("key, enabled");
      if (error) {
        toast.error("Не удалось загрузить настройки: " + error.message);
        setLoading(false);
        return;
      }
      const map: Record<string, boolean> = {};
      SECTION_REGISTRY.forEach((s) => (map[s.key] = true));
      (data ?? []).forEach((r: { key: string; enabled: boolean }) => (map[r.key] = r.enabled));
      setState(map);
      setLoading(false);

      // Авто-засев недостающих ключей, чтобы строки появились в БД.
      const existing = new Set((data ?? []).map((r: { key: string }) => r.key));
      const missing = SECTION_REGISTRY.filter((s) => !existing.has(s.key));
      if (missing.length) {
        await supabase
          .from("site_sections")
          .upsert(missing.map((s) => ({ key: s.key, label: s.label, enabled: true })));
      }
    })();
  }, []);

  const groups = useMemo(() => {
    const g: Record<string, typeof SECTION_REGISTRY[number][]> = {};
    SECTION_REGISTRY.forEach((s) => {
      (g[s.group] ??= []).push(s);
    });
    return g;
  }, []);

  async function toggle(key: string, label: string, next: boolean) {
    setBusy(key);
    setState((p) => ({ ...p, [key]: next }));
    const { error } = await supabase
      .from("site_sections")
      .upsert({ key, label, enabled: next }, { onConflict: "key" });
    setBusy(null);
    if (error) {
      setState((p) => ({ ...p, [key]: !next }));
      toast.error("Не удалось сохранить: " + error.message);
      return;
    }
    toast.success(next ? "Включено" : "Скрыто от посетителей");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-display font-bold">Блоки на сайте</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Включайте и выключайте блоки сайта. Скрытые секции невидимы посетителям,
          но видны вам с пометкой и прозрачностью.
        </p>
      </header>

      {loading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : (
        Object.entries(groups).map(([group, items]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-base">{group}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((s) => {
                const on = state[s.key] !== false;
                return (
                  <label
                    key={s.key}
                    htmlFor={`sw-${s.key}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-card/30 px-4 py-3 cursor-pointer hover:border-primary/40 transition"
                  >
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        {on ? (
                          <Eye className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-destructive" />
                        )}
                        {s.label}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.key}</div>
                    </div>
                    <Switch
                      id={`sw-${s.key}`}
                      checked={on}
                      disabled={busy === s.key}
                      onCheckedChange={(v) => toggle(s.key, s.label, v)}
                    />
                  </label>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
