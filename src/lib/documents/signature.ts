// Единый источник правды по подписи и печати.
// Правило одно для всех форматов: показываем только то, для чего реально
// загружена картинка. Нет изображения — элемента нет и опция не предлагается.

/** Размеры подписи и печати в миллиметрах — одинаковые во всех форматах. */
export const SIGN_MEDIA_MM = {
  /** Высота подписи. */
  signatureH: 18,
  /** Высота печати. */
  stampH: 28,
  /** Насколько печать заходит левее начала линии подписи. */
  stampOffsetX: -4,
  /** Насколько печать опущена относительно линии подписи (доля высоты). */
  stampOverlap: 0.45,
  /** Отступ подписи от линии подписи вверх. */
  signatureLift: 2,
} as const;

export type SignatureSource = {
  /** Картинка, заданная в самом документе (приоритет). */
  docSignatureUrl?: string | null;
  docStampUrl?: string | null;
  /** Профиль компании / настройки документов — запасной источник. */
  companySignatureUrl?: string | null;
  companyStampUrl?: string | null;
  /** Тумблеры документа. Действуют только когда картинка есть. */
  showSignature?: boolean;
  showStamp?: boolean;
};

export type ResolvedSignature = {
  signatureUrl: string | null;
  stampUrl: string | null;
};

export type SignatureAvailability = {
  /** Есть загруженная подпись — можно предлагать тумблер. */
  hasSignature: boolean;
  /** Есть загруженная печать — можно предлагать тумблер. */
  hasStamp: boolean;
};

const pick = (...vals: Array<string | null | undefined>): string | null => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
};

/** Что вообще доступно по загруженным картинкам — используется редакторами. */
export function signatureAvailability(src: SignatureSource): SignatureAvailability {
  return {
    hasSignature: pick(src.docSignatureUrl, src.companySignatureUrl) !== null,
    hasStamp: pick(src.docStampUrl, src.companyStampUrl) !== null,
  };
}

/**
 * Что реально показывать в блоке подписи.
 * Источник: сначала документ, затем профиль компании.
 * Подпись подставляется по умолчанию, печать — по тумблеру; обе молча
 * пропускаются, если картинка не загружена.
 */
export function resolveSignature(src: SignatureSource): ResolvedSignature {
  const sig = pick(src.docSignatureUrl, src.companySignatureUrl);
  const stamp = pick(src.docStampUrl, src.companyStampUrl);
  return {
    signatureUrl: src.showSignature === false ? null : sig,
    stampUrl: src.showStamp === false ? null : stamp,
  };
}

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Разметка подписи и печати для HTML-превью.
 * Размеры в мм — те же, что уходят в PDF, поэтому превью совпадает с файлом.
 */
export function signatureMediaHtml(sig: ResolvedSignature): string {
  if (!sig.signatureUrl && !sig.stampUrl) return "";
  const parts: string[] = [];
  if (sig.signatureUrl) {
    parts.push(
      `<img class="sign-image" src="${escAttr(sig.signatureUrl)}" alt="Подпись" ` +
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

/** Общие стили блока подписи/печати — подключаются во всех превью. */
export const SIGN_MEDIA_CSS = `
  .sign-media { position:relative; height:${SIGN_MEDIA_MM.signatureH}mm; margin-bottom:2px; pointer-events:none; }
  .sign-media img { position:absolute; bottom:0; width:auto; max-width:60mm; object-fit:contain; }
  .sign-media .sign-image { left:6px; opacity:.95; }
  .sign-media .sign-stamp { left:${SIGN_MEDIA_MM.stampOffsetX}mm; bottom:${-SIGN_MEDIA_MM.stampH * SIGN_MEDIA_MM.stampOverlap}mm; opacity:.85; }
`;
