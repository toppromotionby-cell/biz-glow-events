// Экспорт корпоративного документа в DOCX из тех же блоков, что PDF и превью.
import { DOC_FONT_DOCX_NAME } from "@/lib/documents/doc-font";
import { fittedBlank } from "./fit-page";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ImageRun,
  WidthType,
  ShadingType,
  convertMillimetersToTwip,
} from "docx";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import type { PwBlank, PwBlock, PwDocument } from "@/lib/paperwork/model";
import { lineItemColFractions, tableColFractions } from "@/lib/paperwork/table-cols";

import { blockTotals, formatMoney, lineTotal } from "@/lib/paperwork/totals";
import { resolveSignature, SIGN_MEDIA_MM } from "@/lib/documents/signature";

/** Картинка подписи/печати для DOCX: байты + тип, иначе ImageRun не собрать. */
type DocxImage = { data: Uint8Array; type: "png" | "jpg" | "gif" | "bmp"; width: number; height: number };

async function loadDocxImage(url: string | null, heightMm: number): Promise<DocxImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    const type = ct.includes("jpeg") || /\.jpe?g($|\?)/i.test(url)
      ? "jpg"
      : ct.includes("gif") ? "gif" : ct.includes("bmp") ? "bmp" : "png";
    // Реальных размеров не знаем — держим фиксированную высоту и разумную ширину.
    const height = Math.round(heightMm * 3.7795);
    return { data, type, width: Math.round(height * 2.2), height };
  } catch {
    return null;
  }
}

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function textParagraph(
  text: string,
  opts: { align?: string; bold?: boolean; size?: number; indent?: boolean; color?: string; font?: string } = {},
) {
  // Без явного шрифта абзац наследует шрифт документа (styles.default).
  const font = opts.font;
  const size = Math.round((opts.size ?? 11) * 2); // half-points
  return new Paragraph({
    alignment: ALIGN[opts.align ?? "left"] ?? AlignmentType.LEFT,
    indent: opts.indent ? { firstLine: convertMillimetersToTwip(8) } : undefined,
    spacing: { after: 120 },
    children: String(text ?? "")
      .split("\n")
      .flatMap((line, i) =>
        i === 0
          ? [new TextRun({ text: line, bold: opts.bold, size, font, color: opts.color })]
          : [new TextRun({ text: line, bold: opts.bold, size, font, color: opts.color, break: 1 })],
      ),
  });
}

function blockParagraphs(
  b: PwBlock,
  blank: PwBlank,
  media?: { signature: DocxImage | null; stamp: DocxImage | null },
  pageWmm = 210,
): (Paragraph | Table)[] {
  const base = blank.fontSizePt;
  const font = DOC_FONT_DOCX_NAME[blank.font];
  switch (b.type) {
    case "heading":
      return [
        new Paragraph({
          alignment: ALIGN[b.align] ?? AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 160 },
          children: [new TextRun({ text: b.text, bold: true, size: Math.round((base + 2.5) * 2), font })],
        }),
      ];
    case "recipient":
      return [textParagraph(b.text, { align: b.align || "right", size: base - 0.5 })];
    case "note":
      return [textParagraph(b.text, { size: base - 1.5, color: "5B6270" })];
    case "list":
      return b.items.map(
        (item, i) =>
          new Paragraph({
            numbering: b.ordered ? { reference: "pw-numbers", level: 0 } : undefined,
            bullet: b.ordered ? undefined : { level: 0 },
            spacing: { after: 80 },
            children: [new TextRun({ text: item, size: Math.round(base * 2), font })],
            ...(i === -1 ? {} : {}),
          }),
      );
    case "table": {
      const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
      const totalW = convertMillimetersToTwip(pageWmm - blank.marginXMm * 2);
      const widths = tableColFractions(b.header, b.rows, cols).map((f) => Math.floor(totalW * f));
      const cell = (text: string, head: boolean, i: number) =>
        new TableCell({
          width: { size: widths[i] ?? Math.floor(totalW / cols), type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: head ? { fill: "F4F5F7", type: ShadingType.CLEAR } : undefined,
          children: [textParagraph(text, { bold: head, size: base - 1 })],
        });

      const rows: TableRow[] = [];
      if (b.header.length) {
        rows.push(new TableRow({ children: Array.from({ length: cols }, (_, i) => cell(b.header[i] ?? "", true, i)) }));
      }
      for (const r of b.rows) {
        rows.push(new TableRow({ children: Array.from({ length: cols }, (_, i) => cell(r[i] ?? "", false, i)) }));

      }
      return [
        new Table({ width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA }, columnWidths: widths, rows }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    }
    case "lineitems": {
      const t = blockTotals(b);
      const totalW = convertMillimetersToTwip(pageWmm - blank.marginXMm * 2);
      const ratios = lineItemColFractions(
        b.lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          unit: l.unit,
          price: formatMoney(l.price),
          total: formatMoney(lineTotal(l)),
        })),
      );
      const widths = ratios.map((r) => Math.floor(totalW * r));

      const cell = (text: string, i: number, head: boolean, right = false) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: head ? { fill: "F4F5F7", type: ShadingType.CLEAR } : undefined,
          children: [textParagraph(text, { bold: head, size: base - 1, align: right ? "right" : "left" })],
        });
      const head = ["№", "Наименование", "Кол-во", "Ед.", "Цена", "Сумма"];
      const rows: TableRow[] = [
        new TableRow({ children: head.map((h, i) => cell(h, i, true, i >= 4)) }),
        ...b.lines.map(
          (l, idx) =>
            new TableRow({
              children: [
                cell(String(idx + 1), 0, false),
                cell(l.name, 1, false),
                cell(String(l.qty), 2, false),
                cell(l.unit, 3, false),
                cell(formatMoney(l.price), 4, false, true),
                cell(formatMoney(lineTotal(l)), 5, false, true),
              ],
            }),
        ),
      ];
      const out: (Paragraph | Table)[] = [
        new Table({ width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA }, columnWidths: widths, rows }),
        textParagraph(`Итого без НДС: ${formatMoney(t.net)} ${t.currency}`, { align: "right", size: base }),
      ];
      if (b.vatPct > 0) {
        out.push(textParagraph(`НДС ${b.vatPct}%: ${formatMoney(t.vat)} ${t.currency}`, { align: "right", size: base }));
      }
      out.push(
        textParagraph(`Всего к оплате: ${formatMoney(t.gross)} ${t.currency}`, {
          align: "right",
          size: base,
          bold: true,
        }),
      );
      if (b.totalWords) out.push(textParagraph(`Сумма прописью: ${t.words}`, { size: base - 1 }));
      return out;
    }
    case "parties": {
      const totalW = convertMillimetersToTwip(pageWmm - blank.marginXMm * 2);
      const colW = Math.floor(totalW / 2);
      const side = (title: string, text: string) =>
        new TableCell({
          width: { size: colW, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          children: [
            ...(title ? [textParagraph(title, { bold: true, size: base - 0.5 })] : []),
            textParagraph(text, { size: base - 1 }),
          ],
        });
      return [
        new Table({
          width: { size: colW * 2, type: WidthType.DXA },
          columnWidths: [colW, colW],
          rows: [new TableRow({ children: [side(b.leftTitle, b.leftText), side(b.rightTitle, b.rightText)] })],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    }
    case "signature": {
      const img = (m: DocxImage | null) =>
        m
          ? new ImageRun({
              type: m.type,
              data: m.data,
              transformation: { width: m.width, height: m.height },
              altText: { title: "Подпись", description: "Подпись или печать", name: "sign" },
            })
          : null;
      const marks = [
        b.withSignature ? img(media?.signature ?? null) : null,
        b.withStamp ? img(media?.stamp ?? null) : null,
      ].filter(Boolean) as ImageRun[];
      return [
        ...(marks.length ? [new Paragraph({ spacing: { before: 200 }, children: marks })] : []),
        new Paragraph({
          spacing: { before: marks.length ? 0 : 320, after: 120 },
          tabStops: [{ type: "right" as never, position: 9000 }],
          children: [
            new TextRun({ text: b.signerTitle, size: Math.round(base * 2), font }),
            new TextRun({ text: `\t${b.signerName}`, size: Math.round(base * 2), font }),
          ],
        }),
      ];
    }
    case "spacer":
      return [new Paragraph({ spacing: { after: Math.round(b.size * 20) }, children: [] })];
    default:
      return [textParagraph(b.text, { align: b.align, size: base, indent: b.indent })];
  }
}

export async function buildPaperworkDocx(opts: {
  doc: Pick<PwDocument, "title" | "doc_number" | "doc_date">;
  blocks: PwBlock[];
  company: CompanyProfile | null;
  blank: PwBlank;
  /** Альбомный лист A4. */
  landscape?: boolean;
}): Promise<Uint8Array> {
  const { doc, blocks, company } = opts;
  const landscape = opts.landscape === true;
  const pageWmm = landscape ? 297 : 210;
  const blank = fittedBlank(opts.blocks, opts.blank, landscape);
  // Шрифт документа: в DOCX пишем настоящее имя (Calibri / Times New Roman).
  const font = DOC_FONT_DOCX_NAME[blank.font];

  // Подпись и печать грузим один раз: те же источники и высоты, что в PDF.
  const needSign = blocks.some((b) => b.type === "signature" && (b.withSignature || b.withStamp));
  const signSrc = resolveSignature({
    companySignatureUrl: company?.signature_url ?? null,
    companyStampUrl: company?.stamp_url ?? null,
    showSignature: blocks.some((b) => b.type === "signature" && b.withSignature),
    showStamp: blocks.some((b) => b.type === "signature" && b.withStamp),
  });

  const [signature, stamp] = needSign
    ? await Promise.all([
        loadDocxImage(signSrc.signatureUrl, SIGN_MEDIA_MM.signatureH),
        loadDocxImage(signSrc.stampUrl, SIGN_MEDIA_MM.stampH),
      ])
    : [null, null];
  const media = { signature, stamp };

  const header: Paragraph[] = [];
  if (blank.headerLayout !== "none" && company) {
    header.push(
      textParagraph(company.company_brand || company.company_legal_name, {
        align: blank.headerLayout === "logo-center" ? "center" : blank.headerLayout === "logo-right" ? "right" : "left",
        bold: true,
        size: blank.fontSizePt + 4,
      }),
    );
    if (blank.headerRequisites) {
      const req = [
        company.company_legal_name,
        company.company_unp ? `УНП ${company.company_unp}` : "",
        company.company_address,
        [company.company_phone, company.company_email, company.company_website].filter(Boolean).join(" · "),
      ]
        .filter(Boolean)
        .join("\n");
      header.push(
        // Реквизиты идут под названием компании и выравниваются так же, как логотип.
        textParagraph(req, {
          align:
            blank.headerLayout === "logo-center"
              ? "center"
              : blank.headerLayout === "logo-right"
                ? "right"
                : "left",
          size: 8.5,
          color: "5B6270",
        }),
      );
    }
    header.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E2E5EA", space: 1 } },
        spacing: { after: 200 },
        children: [],
      }),
    );
  }

  const dateLabel = (() => {
    const d = new Date(`${doc.doc_date}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? doc.doc_date
      : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  })();
  const meta = new Paragraph({
    tabStops: [{ type: "right" as never, position: 9000 }],
    spacing: { after: 200 },
    children: [
      new TextRun({ text: doc.doc_number ? `№ ${doc.doc_number}` : "", size: 19, font, color: "5B6270" }),
      new TextRun({ text: `\t${dateLabel}`, size: 19, font, color: "5B6270" }),
    ],
  });

  const footerText =
    blank.footerText ||
    [company?.company_legal_name, company?.company_address, company?.company_phone].filter(Boolean).join(" · ");

  const document = new Document({
    styles: { default: { document: { run: { font, size: Math.round(blank.fontSizePt * 2) } } } },
    numbering: {
      config: [
        {
          reference: "pw-numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              // docx-js сам меняет местами стороны при альбомной ориентации —
              // передаём размеры портретного A4.
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(blank.marginTopMm),
              bottom: convertMillimetersToTwip(blank.marginBottomMm),
              left: convertMillimetersToTwip(blank.marginXMm),
              right: convertMillimetersToTwip(blank.marginXMm),
            },
          },
        },
        footers: blank.footer && footerText
          ? {
              default: new Footer({
                children: [textParagraph(footerText, { align: "center", size: 8, color: "7A828F" })],
              }),
            }
          : undefined,
        children: [...header, meta, ...blocks.flatMap((b) => blockParagraphs(b, blank, media, pageWmm))],
      },
    ],
  });

  const buf = await Packer.toBuffer(document);
  return new Uint8Array(buf);
}
