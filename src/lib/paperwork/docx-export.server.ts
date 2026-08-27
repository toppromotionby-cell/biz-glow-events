// Экспорт корпоративного документа в DOCX из тех же блоков, что PDF и превью.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
  convertMillimetersToTwip,
} from "docx";
import type { CompanyProfile } from "@/lib/documents/company-profile";
import type { PwBlank, PwBlock, PwDocument } from "@/lib/paperwork/model";

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const FONT = "Arial";

function textParagraph(text: string, opts: { align?: string; bold?: boolean; size?: number; indent?: boolean; color?: string } = {}) {
  const size = Math.round((opts.size ?? 11) * 2); // half-points
  return new Paragraph({
    alignment: ALIGN[opts.align ?? "left"] ?? AlignmentType.LEFT,
    indent: opts.indent ? { firstLine: convertMillimetersToTwip(8) } : undefined,
    spacing: { after: 120 },
    children: String(text ?? "")
      .split("\n")
      .flatMap((line, i) =>
        i === 0
          ? [new TextRun({ text: line, bold: opts.bold, size, font: FONT, color: opts.color })]
          : [new TextRun({ text: line, bold: opts.bold, size, font: FONT, color: opts.color, break: 1 })],
      ),
  });
}

function blockParagraphs(b: PwBlock, blank: PwBlank): (Paragraph | Table)[] {
  const base = blank.fontSizePt;
  switch (b.type) {
    case "heading":
      return [
        new Paragraph({
          alignment: ALIGN[b.align] ?? AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 160 },
          children: [new TextRun({ text: b.text, bold: true, size: Math.round((base + 2.5) * 2), font: FONT })],
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
            children: [new TextRun({ text: item, size: Math.round(base * 2), font: FONT })],
            ...(i === -1 ? {} : {}),
          }),
      );
    case "table": {
      const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
      const totalW = convertMillimetersToTwip(210 - blank.marginXMm * 2);
      const colW = Math.floor(totalW / cols);
      const widths = Array.from({ length: cols }, () => colW);
      const cell = (text: string, head: boolean) =>
        new TableCell({
          width: { size: colW, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: head ? { fill: "F4F5F7", type: ShadingType.CLEAR } : undefined,
          children: [textParagraph(text, { bold: head, size: base - 1 })],
        });
      const rows: TableRow[] = [];
      if (b.header.length) {
        rows.push(new TableRow({ children: Array.from({ length: cols }, (_, i) => cell(b.header[i] ?? "", true)) }));
      }
      for (const r of b.rows) {
        rows.push(new TableRow({ children: Array.from({ length: cols }, (_, i) => cell(r[i] ?? "", false)) }));
      }
      return [
        new Table({ width: { size: widths.reduce((a, c) => a + c, 0), type: WidthType.DXA }, columnWidths: widths, rows }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    }
    case "signature":
      return [
        new Paragraph({
          spacing: { before: 320, after: 120 },
          tabStops: [{ type: "right" as never, position: 9000 }],
          children: [
            new TextRun({ text: b.signerTitle, size: Math.round(base * 2), font: FONT }),
            new TextRun({ text: `\t${b.signerName}`, size: Math.round(base * 2), font: FONT }),
          ],
        }),
      ];
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
}): Promise<Uint8Array> {
  const { doc, blocks, company, blank } = opts;

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
        textParagraph(req, {
          align: blank.headerLayout === "logo-center" ? "center" : "right",
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
      new TextRun({ text: doc.doc_number ? `№ ${doc.doc_number}` : "", size: 19, font: FONT, color: "5B6270" }),
      new TextRun({ text: `\t${dateLabel}`, size: 19, font: FONT, color: "5B6270" }),
    ],
  });

  const footerText =
    blank.footerText ||
    [company?.company_legal_name, company?.company_address, company?.company_phone].filter(Boolean).join(" · ");

  const document = new Document({
    styles: { default: { document: { run: { font: FONT, size: Math.round(blank.fontSizePt * 2) } } } },
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
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
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
        children: [...header, meta, ...blocks.flatMap((b) => blockParagraphs(b, blank))],
      },
    ],
  });

  const buf = await Packer.toBuffer(document);
  return new Uint8Array(buf);
}
