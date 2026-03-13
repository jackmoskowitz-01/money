import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  PageOrientation,
  TableLayoutType,
  Header,
  HeightRule,
} from 'docx';
import { saveAs } from 'file-saver';

const NAVY = '0D1B3E';
const GRAY_HEADER = 'D9D9D9';
const GOLD_LABEL = 'C87E0A';
const WHITE = 'FFFFFF';
const LIGHT_BORDER = 'B0B0B0';
const TABLE_FONT = 'Calibri';

const thinBorder: Record<string, { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }> = {
  top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
  left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
  right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
};

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
  left: { style: BorderStyle.NONE, size: 0, color: WHITE },
  right: { style: BorderStyle.NONE, size: 0, color: WHITE },
};

interface MatrixData {
  title: string;
  buildingGroups: { address: string; offerLabels: string[] }[];
  rows: { label: string; values: string[] }[];
  footnotes?: string;
}

/**
 * Parse the AI's markdown output into structured matrix data.
 * Expected markdown format:
 * # Summary of Proposals
 * | | Addr1 | Addr1 | Addr2 | ... |
 * |---|---|---|---|---|
 * | **Lease Terms** | **Offer #1A** | **Offer #1B** | **Offer #1** | ... |
 * | **Premises:** | 40,000 RSF | ... |
 * ...
 */
export function parseMatrixMarkdown(markdown: string): MatrixData {
  const lines = markdown.split('\n');
  
  const titleMatch = markdown.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.replace(/\*+/g, '').trim() || 'Summary of Proposals';

  const tableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      if (/^\|[\s-:]+\|/.test(trimmed) || /^[\s-:|]+$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      inTable = true;
      tableLines.push(trimmed);
    } else if (inTable && trimmed === '') {
      break;
    }
  }

  if (tableLines.length < 2) {
    return { title, buildingGroups: [], rows: [] };
  }

  const parseCells = (line: string) =>
    line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

  const addressCells = parseCells(tableLines[0]);
  const offerCells = parseCells(tableLines[1]);

  const totalCols = addressCells.length;
  const dataCols = totalCols - 1;
  const buildingGroups: MatrixData['buildingGroups'] = [];

  const clean = (s: string) => s.replace(/\*+/g, '').trim();

  let currentAddr = '';
  let currentOffers: string[] = [];
  for (let c = 1; c < totalCols; c++) {
    const addr = clean(addressCells[c]);
    const offer = clean(offerCells[c]);
    
    if (addr && addr !== currentAddr) {
      if (currentAddr) {
        buildingGroups.push({ address: currentAddr, offerLabels: currentOffers });
      }
      currentAddr = addr;
      currentOffers = [offer];
    } else {
      currentOffers.push(offer);
    }
  }
  if (currentAddr) {
    buildingGroups.push({ address: currentAddr, offerLabels: currentOffers });
  }

  const rows: MatrixData['rows'] = [];
  for (let r = 2; r < tableLines.length; r++) {
    const cells = parseCells(tableLines[r]);
    if (cells.length === 0) continue;
    const label = clean(cells[0]);
    if (!label || /^lease\s*terms$/i.test(label)) continue;
    const values = cells.slice(1).map(c => clean(c));
    while (values.length < dataCols) values.push('');
    rows.push({ label, values });
  }

  const tableEnd = markdown.lastIndexOf('|');
  const afterTable = markdown.slice(tableEnd + 1).trim();
  const footnotesMatch = afterTable.match(/(?:notes?|footnotes?|analysis)[:\s]*([\s\S]+)/i);
  const footnotes = footnotesMatch?.[1]?.trim() || undefined;

  return { title, buildingGroups, rows, footnotes };
}

/** Build the Word document matching the Cresa Summary of Proposals template */
function buildMatrixDocument(data: MatrixData): Document {
  const { buildingGroups, rows, footnotes } = data;
  const totalDataCols = buildingGroups.reduce((sum, g) => sum + g.offerLabels.length, 0);
  const numBuildings = buildingGroups.length;

  const labelColWidth = 3200;
  const remainingWidth = 13000 - labelColWidth;
  // Each BUILDING GROUP gets equal width, then sub-options divide that width
  const buildingGroupWidth = Math.floor(remainingWidth / Math.max(numBuildings, 1));
  const getSubColWidth = (group: MatrixData['buildingGroups'][0]) =>
    Math.floor(buildingGroupWidth / Math.max(group.offerLabels.length, 1));

  // Row height for data rows (generous spacing)
  const dataRowHeight = 480; // ~0.33 inches
  const headerRowHeight = 520;
  const imageRowHeight = 1800; // ~1.25 inches for building image placeholder

  const makeCell = (
    text: string,
    opts: {
      bold?: boolean;
      color?: string;
      bgColor?: string;
      width?: number;
      alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
      fontSize?: number;
      columnSpan?: number;
      verticalAlign?: "center" | "top" | "bottom";
      borders?: typeof thinBorder;
      spacingBefore?: number;
      spacingAfter?: number;
    } = {}
  ): TableCell => {
    return new TableCell({
      children: [
        new Paragraph({
          alignment: opts.alignment || AlignmentType.CENTER,
          spacing: { before: opts.spacingBefore ?? 100, after: opts.spacingAfter ?? 100 },
          children: [
            new TextRun({
              text,
              bold: opts.bold ?? false,
              color: opts.color || '222222',
              font: TABLE_FONT,
              size: opts.fontSize || 20,
            }),
          ],
        }),
      ],
      width: { size: opts.width || buildingGroupWidth, type: WidthType.DXA },
      shading: opts.bgColor
        ? { type: ShadingType.SOLID, color: opts.bgColor, fill: opts.bgColor }
        : undefined,
      verticalAlign: opts.verticalAlign || "center",
      columnSpan: opts.columnSpan,
      borders: opts.borders || thinBorder,
    });
  };

  // === ROW 1: Building image placeholder row (one image per building, spanning its offer columns) ===
  const imageRowCells: TableCell[] = [
    makeCell('', {
      width: labelColWidth,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: WHITE },
        bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
        left: { style: BorderStyle.NONE, size: 0, color: WHITE },
        right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
      },
    }),
  ];

  for (const group of buildingGroups) {
    imageRowCells.push(
      new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: '[Building Photo]',
                color: 'AAAAAA',
                font: TABLE_FONT,
                size: 18,
                italics: true,
              }),
            ],
          }),
        ],
        width: { size: buildingGroupWidth, type: WidthType.DXA },
        columnSpan: group.offerLabels.length,
        verticalAlign: "center",
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
          left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        },
      })
    );
  }

  const imageRow = new TableRow({
    children: imageRowCells,
    height: { value: imageRowHeight, rule: HeightRule.ATLEAST },
  });

  // === ROW 2: Building address row (address text below each photo) ===
  const addressRowCells: TableCell[] = [
    makeCell('', {
      width: labelColWidth,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: WHITE },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: NAVY },
        left: { style: BorderStyle.NONE, size: 0, color: WHITE },
        right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
      },
    }),
  ];

  for (const group of buildingGroups) {
    addressRowCells.push(
      new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: group.address,
                bold: true,
                color: NAVY,
                font: TABLE_FONT,
                size: 20,
              }),
            ],
          }),
        ],
        width: { size: buildingGroupWidth, type: WidthType.DXA },
        columnSpan: group.offerLabels.length,
        verticalAlign: "center",
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: WHITE },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: NAVY },
          left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        },
      })
    );
  }

  const addressRow = new TableRow({
    children: addressRowCells,
    height: { value: 420, rule: HeightRule.ATLEAST },
  });

  // === ROW 3: Offer labels (gray background) ===
  const offerRowCells: TableCell[] = [
    makeCell('Lease Terms', {
      bold: true,
      width: labelColWidth,
      bgColor: GRAY_HEADER,
      alignment: AlignmentType.LEFT,
      fontSize: 20,
      spacingBefore: 120,
      spacingAfter: 120,
    }),
  ];

  for (const group of buildingGroups) {
    for (const label of group.offerLabels) {
      offerRowCells.push(
        makeCell(label, {
          bold: true,
          bgColor: GRAY_HEADER,
          fontSize: 20,
          spacingBefore: 120,
          spacingAfter: 120,
        })
      );
    }
  }

  const offerRow = new TableRow({
    children: offerRowCells,
    tableHeader: true,
    height: { value: headerRowHeight, rule: HeightRule.ATLEAST },
  });

  // === DATA ROWS ===
  const dataRows = rows.map((row) => {
    const cells: TableCell[] = [
      makeCell(row.label, {
        bold: true,
        color: GOLD_LABEL,
        width: labelColWidth,
        alignment: AlignmentType.LEFT,
        fontSize: 20,
        spacingBefore: 100,
        spacingAfter: 100,
      }),
    ];

    for (let c = 0; c < totalDataCols; c++) {
      cells.push(
        makeCell(row.values[c] || '', {
          alignment: AlignmentType.CENTER,
          fontSize: 20,
          spacingBefore: 100,
          spacingAfter: 100,
        })
      );
    }

    return new TableRow({
      children: cells,
      height: { value: dataRowHeight, rule: HeightRule.ATLEAST },
    });
  });

  // Build the table
  const table = new Table({
    rows: [imageRow, addressRow, offerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });

  // Build footnotes paragraph if any
  const footnoteParagraphs: Paragraph[] = [];
  if (footnotes) {
    footnoteParagraphs.push(
      new Paragraph({ spacing: { before: 300 } }),
      new Paragraph({
        children: [
          new TextRun({ text: footnotes, font: TABLE_FONT, size: 18, italics: true, color: '666666' }),
        ],
      })
    );
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 12240,  // 8.5" (short edge)
              height: 15840, // 11" (long edge)
            },
            margin: {
              top: 1200,
              bottom: 720,
              left: 900,
              right: 900,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 200 },
                children: [
                  new TextRun({
                    text: 'Summary of Proposals',
                    bold: true,
                    color: NAVY,
                    font: TABLE_FONT,
                    size: 36,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ spacing: { after: 200 } }),
          table,
          ...footnoteParagraphs,
        ],
      },
    ],
  });
}

/** Export matrix markdown as a professionally formatted .docx file */
export async function exportMatrixToWord(markdownContent: string, filename: string = 'Summary_of_Proposals') {
  const data = parseMatrixMarkdown(markdownContent);

  if (data.buildingGroups.length === 0 || data.rows.length === 0) {
    const { exportToWord } = await import('./exportToWord');
    return exportToWord(markdownContent, filename);
  }

  const doc = buildMatrixDocument(data);
  const blob = await Packer.toBlob(doc);
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${safeName}.docx`);
}
