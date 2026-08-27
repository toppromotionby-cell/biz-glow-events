// Единый источник правды по подписи, факсимиле и печати.
// Раньше каждый формат решал сам: в превью КП картинки были, в PDF — нет,
// в корпоративных документах наоборот. Теперь состав блока подписи и размеры
// картинок считаются здесь, а HTML-превью, PDF и DOCX только рисуют результат.

/** Размеры факсимиле и печати в миллиметрах — одинаковые во всех форматах. */
export const SIGN_MEDIA_MM = {
  /** Высота факсимиле (подписи). */
  signatureH: 18,
  /** Высота печати. */
  stampH: 28,
  /** Насколько печать заходит левее начала линии подписи. */
  stampOffsetX: -4,
  /** Насколько печать опущена относительно линии подписи (доля высоты). */
  stampOverlap: 0.45,
  /** Отступ факсимиле от линии подписи вверх. */
  signatureLift: 2,
} as const;

export type SignatureSource = {
  /** Картинка, заданная в самом документе (приоритет). */
  docSignatureUrl?: string | null;
  docStampUrl?: string | null;
  /** Профиль компании / настройки документов — запасной источник. */
  companySignatureUrl?: string | null;
  companyStampUrl?: string | null;
  /** Тумблеры документа. */
  showSignature?: boolean;
  showStamp?: boolean;
};

export type ResolvedSignature = {
  signatureUrl: string | null;
  stampUrl: string | null;
  /** Предупреждения для админки: тумблер включён, а картинки нет. */
  warnings: string[];
};

const pick = (...vals: Array<string | null | undefined>): string | null => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
};

/**
 * Что реально показывать в блоке подписи.
 * Источник: сначала документ, затем профиль компании; тумблеры выключают жёстко.
 */
export function resolveSignature(src: SignatureSource): ResolvedSignature {
  const showSignature = src.showSignature !== false;
  const showStamp = src.showStamp === true;
  const sig = pick(src.docSignatureUrl, src.companySignatureUrl);
  const stamp = pick(src.docStampUrl, src.companyStampUrl);
  const warnings: string[] = [];
  if (showSignature && !sig) warnings.push("Факсимиле включено, но изображение подписи не загружено в карточке компании.");
  if (showStamp && !stamp) warnings.push("Печать включена, но изображение печати не загружено в карточке компании.");
  return {
    signatureUrl: showSignature ? sig : null,
    stampUrl: showStamp ? stamp : null,
    warnings,
  };
}

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Разметка факсимиле и печати для HTML-превью.
 * Размеры в мм — те же, что уходят в PDF, поэтому превью совпадает с файлом.
 */
export function signatureMediaHtml(sig: ResolvedSignature): string {
  if (!sig.signatureUrl && !sig.stampUrl) return "";
  const parts: string[] = [];
  if (sig.signatureUrl) {
    parts.push(
      `<img class="sign-facsimile" src="${escAttr(sig.signatureUrl)}" alt="Факсимиле подписи" ` +
        `style="height:${SIGN_MEDIA_MM.signatureH}mm" />`,
    );
  }
  if (sig.stampUrl) {
    parts.push(
      `<img class="sign-stamp" src="${escAttr(sig.stampUrl)}" alt="Печать" ` +
        `style="height:${SIGN_MEDIA_MM.stampH}mm" />`,
    );
  }
  return `<div class="sign-media">${parts.join("")}</div>`;
}

/** Общие стили блока факсимиле/печати — подключаются во всех превью. */
export const SIGN_MEDIA_CSS = `
  .sign-media { position:relative; height:${SIGN_MEDIA_MM.signatureH}mm; margin-bottom:2px; pointer-events:none; }
  .sign-media img { position:absolute; bottom:0; width:auto; max-width:60mm; object-fit:contain; }
  .sign-media .sign-facsimile { left:6px; opacity:.95; }
  .sign-media .sign-stamp { left:${SIGN_MEDIA_MM.stampOffsetX}mm; bottom:${-SIGN_MEDIA_MM.stampH * SIGN_MEDIA_MM.stampOverlap}mm; opacity:.85; }
`;
