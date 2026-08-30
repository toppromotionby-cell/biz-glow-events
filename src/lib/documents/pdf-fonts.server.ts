// Шрифтовые наборы для PDF-документов: фирменный (Inter + Space Grotesk),
// Ubuntu, Roboto, Calibri (Carlito) и Times New Roman (Tinos). Байты встроены
// в бандл (subset латиница+кириллица) и кешируются.
import type { DocFont } from "@/lib/documents/doc-font";
import { INTER_REGULAR_B64 } from "@/assets/fonts/inter-regular.base64";
import { INTER_BOLD_B64 } from "@/assets/fonts/inter-bold.base64";
import { SPACE_GROTESK_BOLD_B64 } from "@/assets/fonts/space-grotesk-bold.base64";
import { UBUNTU_REGULAR_B64 } from "@/assets/fonts/ubuntu-regular.base64";
import { UBUNTU_MEDIUM_B64 } from "@/assets/fonts/ubuntu-medium.base64";
import { UBUNTU_BOLD_B64 } from "@/assets/fonts/ubuntu-bold.base64";
import { ROBOTO_REGULAR_B64 } from "@/assets/fonts/roboto-regular.base64";
import { ROBOTO_MEDIUM_B64 } from "@/assets/fonts/roboto-medium.base64";
import { ROBOTO_BOLD_B64 } from "@/assets/fonts/roboto-bold.base64";
import { CARLITO_REGULAR_B64 } from "@/assets/fonts/carlito-regular.base64";
import { CARLITO_BOLD_B64 } from "@/assets/fonts/carlito-bold.base64";
import { TINOS_REGULAR_B64 } from "@/assets/fonts/tinos-regular.base64";
import { TINOS_BOLD_B64 } from "@/assets/fonts/tinos-bold.base64";

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const cache = new Map<string, Uint8Array>();
function bytes(key: string, b64: string): Uint8Array {
  const hit = cache.get(key);
  if (hit) return hit;
  const out = decodeBase64(b64);
  cache.set(key, out);
  return out;
}

export type PdfFontSet = {
  regular: Uint8Array;
  bold: Uint8Array;
  display: Uint8Array;
  /** Есть ли кириллица в display-шрифте (у Space Grotesk её нет). */
  displayCyrillic: boolean;
};

/** Описание набора: какие байты подставлять под каждый шрифт документа. */
const SETS: Record<DocFont, () => PdfFontSet> = {
  brand: () => ({
    regular: bytes("in-r", INTER_REGULAR_B64),
    bold: bytes("in-b", INTER_BOLD_B64),
    display: bytes("sg-b", SPACE_GROTESK_BOLD_B64),
    displayCyrillic: false,
  }),
  ubuntu: () => ({
    regular: bytes("ub-r", UBUNTU_REGULAR_B64),
    bold: bytes("ub-b", UBUNTU_BOLD_B64),
    display: bytes("ub-m", UBUNTU_MEDIUM_B64),
    displayCyrillic: true,
  }),
  roboto: () => ({
    regular: bytes("ro-r", ROBOTO_REGULAR_B64),
    bold: bytes("ro-b", ROBOTO_BOLD_B64),
    display: bytes("ro-m", ROBOTO_MEDIUM_B64),
    displayCyrillic: true,
  }),
  // Calibri → Carlito (метрически совместим).
  calibri: () => ({
    regular: bytes("ca-r", CARLITO_REGULAR_B64),
    bold: bytes("ca-b", CARLITO_BOLD_B64),
    display: bytes("ca-b", CARLITO_BOLD_B64),
    displayCyrillic: true,
  }),
  // Times New Roman → Tinos (метрически совместим).
  times: () => ({
    regular: bytes("ti-r", TINOS_REGULAR_B64),
    bold: bytes("ti-b", TINOS_BOLD_B64),
    display: bytes("ti-b", TINOS_BOLD_B64),
    displayCyrillic: true,
  }),
};

export function pdfFontSet(font: DocFont): PdfFontSet {
  return (SETS[font] ?? SETS.brand)();
}
