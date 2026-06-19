// Умная двухстрочная обрезка заголовков карточек.
//
// Архитектура:
//   `background-clip: text` (используется в .card-title-gradient) и
//   `line-clamp-2` должны жить на ОДНОМ элементе — иначе клиппинг
//   рендерится как сплошной градиентный прямоугольник. Поэтому хук
//   `useClampedText` ничего не делает с DOM реального элемента: он
//   ИЗМЕРЯЕТ текст в скрытом offscreen-клоне, а возвращает строку,
//   которую вызывающий код просто кладёт через React.
//
//   Многоточие в Chromium/WebKit рисует line-clamp; в Firefox (где
//   line-clamp обрезает без `…`) и в граничных случаях — наш JS-путь:
//   бинарный поиск максимального префикса слов с `…`, удаление висячих
//   предлогов.
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ORPHANS = new Set([
  "в", "во", "и", "на", "с", "со", "по", "от", "до", "из", "к", "ко",
  "о", "об", "у", "для", "при", "над", "под", "за", "без",
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "by", "with",
]);

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function trimOrphans(words: string[]): string[] {
  let i = words.length;
  while (i > 1 && ORPHANS.has(words[i - 1]!.toLowerCase().replace(/[.,;:!?]+$/g, ""))) {
    i -= 1;
  }
  return words.slice(0, i);
}

/**
 * Возвращает текст, который гарантированно укладывается в `lines` строк
 * внутри элемента `ref`. Если исходный текст не помещается, обрезает
 * по словам и дописывает многоточие (`…`).
 *
 * Не модифицирует DOM элемента — все замеры делаются в offscreen-клоне,
 * чтобы не конфликтовать с background-clip:text родителя.
 */
export function useClampedText(
  ref: React.RefObject<HTMLElement | null>,
  text: string,
  lines = 2,
): string {
  const [displayed, setDisplayed] = useState(text);
  const lastInputRef = useRef<{ text: string; width: number; result: string } | null>(null);

  useIsoLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;

    let raf = 0;
    const compute = () => {
      const cs = getComputedStyle(host);
      const lineHeightPx = parseFloat(cs.lineHeight) || 0;
      if (lineHeightPx <= 0) {
        setDisplayed(text);
        return;
      }
      const rect = host.getBoundingClientRect();
      const width = rect.width;
      if (width <= 0) return;

      // Мемоизация: одинаковые text+width → пропускаем.
      const last = lastInputRef.current;
      if (last && last.text === text && Math.abs(last.width - width) < 0.5) {
        if (last.result !== displayed) setDisplayed(last.result);
        return;
      }

      // Offscreen-клон: те же шрифт-стили, та же ширина, но абсолютно
      // позиционирован далеко за вьюпортом. Не имеет clip:text,
      // line-clamp или ограничения по высоте — высота свободна.
      const probe = document.createElement(host.tagName);
      // копируем шрифт-метрики
      const props = [
        "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight",
        "letterSpacing", "wordSpacing", "textTransform", "fontVariant",
        "fontStretch", "textIndent", "whiteSpace", "wordBreak", "overflowWrap",
      ] as const;
      for (const p of props) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (probe.style as any)[p] = (cs as any)[p];
      }
      probe.style.position = "absolute";
      probe.style.left = "-99999px";
      probe.style.top = "0";
      probe.style.width = `${width}px`;
      probe.style.height = "auto";
      probe.style.maxHeight = "none";
      probe.style.minHeight = "0";
      probe.style.overflow = "visible";
      probe.style.display = "block";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.setAttribute("aria-hidden", "true");
      document.body.appendChild(probe);

      const maxHeight = lineHeightPx * lines + 1;
      const fits = (candidate: string) => {
        probe.textContent = candidate;
        return probe.getBoundingClientRect().height <= maxHeight;
      };

      let result: string;
      if (fits(text)) {
        result = text;
      } else {
        const words = text.split(/\s+/).filter(Boolean);
        let lo = 1;
        let hi = words.length;
        let best = 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const candidate = trimOrphans(words.slice(0, mid)).join(" ") + "…";
          if (fits(candidate)) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        const finalWords = trimOrphans(words.slice(0, best));
        result = finalWords.length === 0 ? words[0]! + "…" : finalWords.join(" ") + "…";
      }

      document.body.removeChild(probe);
      lastInputRef.current = { text, width, result };
      if (result !== displayed) setDisplayed(result);
    };

    compute();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    });
    ro.observe(host);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, text, lines]);

  return displayed;
}
