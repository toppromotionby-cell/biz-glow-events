// Шрифтовые наборы для PDF-документов: фирменный (Inter + Space Grotesk)
// и Ubuntu. Байты встроены в бандл (subset латиница+кириллица) и кешируются.
import type { DocFont } from "@/lib/documents/doc-font";
import { INTER_REGULAR_B64 } from "@/assets/fonts/inter-regular.base64";
import { INTER_BOLD_B64 } from "@/assets/fonts/inter-bold.base64";
import { SPACE_GROTESK_BOLD_B64 } from "@/assets/fonts/space-grotesk-bold.base64";
import { UBUNTU_REGULAR_B64 } from "@/assets/fonts/ubuntu-regular.base64";
import { UBUNTU_MEDIUM_B64 } from "@/assets/fonts/ubuntu-medium.base64";
import { UBUNTU_BOLD_B64 } from "@/assets/fonts/ubuntu-bold.base64";

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

export function pdfFontSet(font: DocFont): PdfFontSet {
  if (font === "ubuntu") {
    return {
      regular: bytes("ub-r", UBUNTU_REGULAR_B64),
      bold: bytes("ub-b", UBUNTU_BOLD_B64),
      display: bytes("ub-m", UBUNTU_MEDIUM_B64),
      displayCyrillic: true,
    };
  }
  return {
    regular: bytes("in-r", INTER_REGULAR_B64),
    bold: bytes("in-b", INTER_BOLD_B64),
    display: bytes("sg-b", SPACE_GROTESK_BOLD_B64),
    displayCyrillic: false,
  };
}
