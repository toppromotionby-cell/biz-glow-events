// Импорт основы шаблона из DOCX: распаковка zip (fflate), разбор word/document.xml
// в блоки редактора. Сложная вёрстка Word переносится приближённо — об этом
// сообщает отчёт импорта.
import { unzipSync, strFromU8 } from "fflate";
import { normalizeBlock, type PwBlock } from "@/lib/paperwork/model";

export type ImportReport = {
  blocks: PwBlock[];
  stats: { paragraphs: number; headings: number; lists: number; tables: number; skipped: number };
  warnings: string[];
};

const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

/** Текст абзаца/ячейки: конкатенация <w:t>, переводы строк из <w:br>. */
function nodeText(xml: string): string {
  let out = "";
  const re = /<w:(t|br|tab)(?:\s[^>]*)?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1] === "br") out += "\n";
    else if (m[1] === "tab") out += "\t";
    else if (!m[2]) {
      const close = xml.indexOf("</w:t>", re.lastIndex);
      if (close < 0) break;
      out += decodeXml(xml.slice(re.lastIndex, close));
      re.lastIndex = close + 6;
    }
  }
  return out.replace(/\u00a0/g, " ").trim();
}

const styleOf = (p: string): string => /<w:pStyle[^>]*w:val="([^"]+)"/.exec(p)?.[1] ?? "";
const isNumbered = (p: string): boolean => /<w:numPr[\s>]/.test(p);
const alignOf = (p: string): "left" | "center" | "right" | "justify" => {
  const v = /<w:jc[^>]*w:val="([^"]+)"/.exec(p)?.[1];
  if (v === "center") return "center";
  if (v === "right" || v === "end") return "right";
  if (v === "both" || v === "distribute") return "justify";
  return "left";
};

/** Верхнеуровневые элементы тела документа в порядке следования. */
function topLevelNodes(body: string): { tag: "p" | "tbl"; xml: string }[] {
  const out: { tag: "p" | "tbl"; xml: string }[] = [];
  const re = /<w:(p|tbl)(?:\s[^>]*)?>/g;
  let m: RegExpExecArray | null;
  let cursor = 0;
  while ((m = re.exec(body))) {
    if (m.index < cursor) continue;
    const tag = m[1] as "p" | "tbl";
    const open = new RegExp(`<w:${tag}(?:\\s[^>]*)?>`, "g");
    const close = new RegExp(`</w:${tag}>`, "g");
    let depth = 1;
    let pos = re.lastIndex;
    while (depth > 0) {
      open.lastIndex = pos;
      close.lastIndex = pos;
      const o = open.exec(body);
      const c = close.exec(body);
      if (!c) {
        pos = body.length;
        break;
      }
      if (o && o.index < c.index) {
        depth += 1;
        pos = o.index + o[0].length;
      } else {
        depth -= 1;
        pos = c.index + c[0].length;
      }
    }
    out.push({ tag, xml: body.slice(m.index, pos) });
    cursor = pos;
    re.lastIndex = pos;
  }
  return out;
}

function parseTable(xml: string): PwBlock | null {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)) {
      cells.push(nodeText(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return null;
  const [header, ...rest] = rows;
  return normalizeBlock({ type: "table", header, rows: rest.length ? rest : [header.map(() => "")] });
}

export function parseDocxToBlocks(bytes: Uint8Array): ImportReport {
  const stats = { paragraphs: 0, headings: 0, lists: 0, tables: 0, skipped: 0 };
  const warnings: string[] = [];
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { blocks: [], stats, warnings: ["Файл не читается как DOCX (повреждённый архив)."] };
  }
  const entry = files["word/document.xml"];
  if (!entry) return { blocks: [], stats, warnings: ["В файле нет word/document.xml."] };
  const xml = strFromU8(entry);
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;

  if (/<w:drawing[\s>]/.test(body)) warnings.push("Изображения из DOCX не переносятся — добавьте их отдельно.");
  if (/<w:sectPr[\s\S]*?<w:cols[^>]*w:num="[2-9]"/.test(body)) warnings.push("Многоколоночная вёрстка упрощена в один поток.");

  const blocks: PwBlock[] = [];
  let listBuffer: { items: string[]; ordered: boolean } | null = null;
  const flushList = () => {
    if (listBuffer && listBuffer.items.length) {
      blocks.push(normalizeBlock({ type: "list", items: listBuffer.items, ordered: listBuffer.ordered }));
      stats.lists += 1;
    }
    listBuffer = null;
  };

  for (const node of topLevelNodes(body)) {
    if (node.tag === "tbl") {
      flushList();
      const t = parseTable(node.xml);
      if (t) {
        blocks.push(t);
        stats.tables += 1;
      } else stats.skipped += 1;
      continue;
    }
    const text = nodeText(node.xml);
    if (!text) {
      flushList();
      continue;
    }
    const style = styleOf(node.xml);
    if (isNumbered(node.xml)) {
      const ordered = /Number|Decimal/i.test(style);
      if (!listBuffer) listBuffer = { items: [], ordered };
      listBuffer.items.push(text);
      continue;
    }
    flushList();
    if (/^Heading|^Title|^Заголовок/i.test(style)) {
      blocks.push(normalizeBlock({ type: "heading", text, align: alignOf(node.xml) === "left" ? "left" : alignOf(node.xml) }));
      stats.headings += 1;
      continue;
    }
    const align = alignOf(node.xml);
    blocks.push(
      normalizeBlock({
        type: "paragraph",
        text,
        align,
        indent: /<w:ind[^>]*w:firstLine="/.test(node.xml),
      }),
    );
    stats.paragraphs += 1;
  }
  flushList();

  if (!blocks.length) warnings.push("Не удалось распознать текст — документ пустой или защищён.");
  return { blocks, stats, warnings };
}
