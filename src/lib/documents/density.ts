/**
 * Плотность документа — единые правила для HTML-превью, окна просмотра и PDF.
 *
 * PDF подбирает плотность «лесенкой», пока документ не влезет в целевое число
 * листов. Тот же алгоритм выполняется в HTML: скрипт замеряет фактическую
 * высоту листа и подставляет тот же коэффициент, поэтому превью и выгрузка
 * выглядят одинаково.
 */
import { BASE_PRINT_PRESET, type DocPrintPreset } from "@/lib/documents/print-preset";

export type DocDensity = "comfortable" | "compact" | "dense" | "ultra";

export const DOC_DENSITY_SCALE: Record<DocDensity, number> = {
  comfortable: 1,
  compact: 0.94,
  dense: 0.88,
  ultra: 0.8,
};

export const DOC_DENSITY_LADDER: DocDensity[] = ["comfortable", "compact", "dense", "ultra"];

/** Кегли ужимаем мягче отступов — та же формула, что в PDF. */
export const densityFontK = (k: number) => 0.5 + k / 2;

/** CSS-переменные плотности по умолчанию (до работы скрипта). */
export function densityRootVars(): string {
  return "--dk:1; --fk:1; --page-h:0px";
}

/** Разметка листов A4 в превью (скрыта при печати). */
export const DENSITY_PAGE_CSS = `
  .sheet.paged { background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--page-h) - 1px), #e2e5ea calc(var(--page-h) - 1px), #e2e5ea var(--page-h)); background-repeat: repeat-y; }
  @media print { .sheet.paged { background-image:none; } }
`;

/**
 * Inline-скрипт авто-подгонки: перебирает лесенку плотности, пока содержимое
 * не уложится в `maxPages` листов A4 с полями пресета.
 */
export function autoFitScript(preset: DocPrintPreset = BASE_PRINT_PRESET, opts: { zoomMode?: boolean } = {}): string {
  const scales = DOC_DENSITY_LADDER.map((d) => DOC_DENSITY_SCALE[d]);
  return `<script>
(function(){
  var LADDER = ${JSON.stringify(scales)};
  var MM = 96 / 25.4;
  var P = ${JSON.stringify({
    top: preset.marginTopMm,
    bottom: preset.marginBottomMm,
    x: preset.marginXMm,
    maxPages: preset.maxPages,
  })};
  var ZOOM = ${opts.zoomMode ? "true" : "false"};
  var root = document.documentElement;
  var sheet = document.querySelector('.sheet');
  if (!sheet) return;
  function pageHeightPx(){
    var cs = getComputedStyle(sheet);
    var contentW = sheet.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
    var paperW = (210 - 2 * P.x) * MM;
    var scale = paperW > 0 ? contentW / paperW : 1;
    return Math.max(1, (297 - P.top - P.bottom) * MM * scale);
  }
  function apply(k){
    root.style.setProperty('--dk', String(k));
    root.style.setProperty('--fk', String(0.5 + k / 2));
    if (ZOOM) { var inner = sheet.firstElementChild; if (inner) inner.style.zoom = String(k); }
  }
  function fit(){
    var limit = P.maxPages;
    var chosen = LADDER[LADDER.length - 1];
    for (var i = 0; i < LADDER.length; i++){
      apply(LADDER[i]);
      var ph = pageHeightPx();
      var pages = Math.ceil((sheet.scrollHeight - 1) / ph);
      if (pages <= limit) { chosen = LADDER[i]; break; }
    }
    apply(chosen);
    var ph2 = pageHeightPx();
    root.style.setProperty('--page-h', ph2 + 'px');
    sheet.classList.add('paged');
  }
  function schedule(){ requestAnimationFrame(function(){ requestAnimationFrame(fit); }); }
  schedule();
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule).catch(function(){});
})();
<\/script>`;
}
