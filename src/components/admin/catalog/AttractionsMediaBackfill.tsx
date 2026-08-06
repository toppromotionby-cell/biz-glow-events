// Кнопка «Догрузить недостающие фото» для каталога аттракционов.
// Повторяет загрузку медиа только для позиций с пустым photo_urls, партиями.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backfillAttractionMedia, getMissingPhotoCount } from "@/lib/attractions-media.functions";

const BATCH = 10;

export function AttractionsMediaBackfill() {
  const qc = useQueryClient();
  const countFn = useServerFn(getMissingPhotoCount);
  const runFn = useServerFn(backfillAttractionMedia);
  const [running, setRunning] = useState(false);

  const { data: missing = 0, refetch } = useQuery({
    queryKey: ["attractions-missing-photos"],
    queryFn: () => countFn({ data: undefined as never }),
  });

  const run = async () => {
    setRunning(true);
    try {
      const res = await runFn({ data: { limit: BATCH } });
      if (res.processed === 0) {
        toast.success("Все аттракционы уже с фото");
      } else {
        toast.success(
          `Догружено: ${res.updated} из ${res.processed} (фото: ${res.photos}). Осталось: ${res.remaining}`,
          res.failed.length ? { description: `Без фото у источника: ${res.failed.join(", ")}` } : undefined,
        );
      }
      await refetch();
      qc.invalidateQueries({ queryKey: ["catalog", "attractions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось догрузить фото");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button variant="outline" onClick={run} disabled={running || missing === 0}>
      {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageDown className="h-4 w-4 mr-2" />}
      Догрузить недостающие фото{missing > 0 ? ` (${missing})` : ""}
    </Button>
  );
}
