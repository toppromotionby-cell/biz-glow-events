// Движок переменных {{...}}: сбор из блоков, авто-контекст из профиля компании
// и метаданных документа, подстановка значений.
import type { CompanyProfile } from "@/lib/documents/company-profile";
import type { PwBlock, PwDocument, PwVariable } from "@/lib/paperwork/model";

export const VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Канонический ключ: без регистра и лишних пробелов. */
export function varKey(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Все переменные, встречающиеся в блоках (в порядке появления). */
export function collectVariables(blocks: PwBlock[]): string[] {
  const seen = new Map<string, string>();
  const scan = (s: string) => {
    for (const m of s.matchAll(VAR_RE)) {
      const label = m[1].trim().replace(/\s+/g, " ");
      const k = varKey(label);
      if (!seen.has(k)) seen.set(k, label);
    }
  };
  for (const b of blocks) {
    scan(b.text);
    b.items.forEach(scan);
    b.header.forEach(scan);
    b.rows.forEach((row) => row.forEach(scan));
    scan(b.signerName);
    scan(b.signerTitle);
  }
  return [...seen.values()];
}

const fmtDateRu = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
};

/** Значения, которые подставляются автоматически. */
export function autoContext(
  company: CompanyProfile | null,
  doc: Pick<PwDocument, "doc_number" | "doc_date" | "title">,
): Record<string, string> {
  const c = company;
  const map: Record<string, string> = {
    "компания": c?.company_brand || c?.company_legal_name || "",
    "название компании": c?.company_brand || c?.company_legal_name || "",
    "юридическое название": c?.company_legal_name || "",
    "унп": c?.company_unp || "",
    "адрес": c?.company_address || "",
    "адрес компании": c?.company_address || "",
    "телефон": c?.company_phone || "",
    "email": c?.company_email || "",
    "сайт": c?.company_website || "",
    "банк": c?.bank_name || "",
    "бик": c?.bank_bic || "",
    "расчётный счёт": c?.bank_account || "",
    "расчетный счет": c?.bank_account || "",
    "фио директора": c?.signer_name || "",
    "должность подписанта": c?.signer_title || "",
    "основание": c?.signer_basis || "",
    "дата": fmtDateRu(doc.doc_date),
    "дата документа": fmtDateRu(doc.doc_date),
    "номер документа": doc.doc_number || "",
    "название документа": doc.title || "",
  };
  return map;
}

/** Итоговая карта значений: авто-контекст + ручные значения документа. */
export function resolveValues(
  auto: Record<string, string>,
  manual: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...auto };
  for (const [k, v] of Object.entries(manual)) {
    const key = varKey(k);
    if (typeof v === "string" && v.trim()) out[key] = v;
    else if (!(key in out)) out[key] = "";
  }
  return out;
}

/** Подстановка в строку. Неизвестная переменная остаётся видимой как «— …». */
export function applyVars(text: string, values: Record<string, string>, keepUnknown = true): string {
  return text.replace(VAR_RE, (full, name: string) => {
    const v = values[varKey(name)];
    if (v && v.trim()) return v;
    return keepUnknown ? full : "";
  });
}

export function applyVarsToBlocks(blocks: PwBlock[], values: Record<string, string>): PwBlock[] {
  const f = (s: string) => applyVars(s, values);
  return blocks.map((b) => ({
    ...b,
    text: f(b.text),
    items: b.items.map(f),
    header: b.header.map(f),
    rows: b.rows.map((r) => r.map(f)),
    signerName: f(b.signerName),
    signerTitle: f(b.signerTitle),
  }));
}

/** Список переменных документа с пометкой «заполняется автоматически». */
export function documentVariables(
  blocks: PwBlock[],
  auto: Record<string, string>,
  declared: PwVariable[] = [],
): PwVariable[] {
  const declaredMap = new Map(declared.map((v) => [varKey(v.key), v]));
  return collectVariables(blocks).map((label) => {
    const k = varKey(label);
    const d = declaredMap.get(k);
    const isAuto = k in auto;
    return {
      key: label,
      label: d?.label || label,
      source: isAuto ? "auto" : "manual",
      defaultValue: d?.defaultValue ?? "",
    };
  });
}
