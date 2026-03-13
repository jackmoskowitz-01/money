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
      const isSeparatorRow = /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(trimmed);
      if (isSeparatorRow) {
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

  const clean = (s: string) => s.replace(/\*+/g, '').trim();

  const inferredDataCols = Math.max(
    1,
    addressCells.length - 1,
    offerCells.length - 1,
    ...tableLines.slice(2).map((line) => Math.max(parseCells(line).length - 1, 0))
  );

  const rawAddresses = addressCells.slice(1).map(clean);
  const rawOffers = offerCells.slice(1).map(clean);

  const addresses: string[] = [];
  let lastAddress = '';
  for (let i = 0; i < inferredDataCols; i++) {
    const candidate = rawAddresses[i] || '';
    if (candidate) lastAddress = candidate;
    addresses.push(candidate || lastAddress || 'Unknown Address');
  }

  const offers: string[] = [];
  for (let i = 0; i < inferredDataCols; i++) {
    offers.push(rawOffers[i] || `Offer #${i + 1}`);
  }

  const buildingGroups: MatrixData['buildingGroups'] = [];
  let currentAddr = '';
  let currentOffers: string[] = [];

  for (let i = 0; i < inferredDataCols; i++) {
    const addr = addresses[i];
    const offer = offers[i];

    if (!currentAddr || addr !== currentAddr) {
      if (currentOffers.length > 0) {
        buildingGroups.push({ address: currentAddr, offerLabels: currentOffers });
      }
      currentAddr = addr;
      currentOffers = [offer];
    } else {
      currentOffers.push(offer);
    }
  }

  if (currentOffers.length > 0) {
    buildingGroups.push({ address: currentAddr, offerLabels: currentOffers });
  }

  const rows: MatrixData['rows'] = [];
  for (let r = 2; r < tableLines.length; r++) {
    const cells = parseCells(tableLines[r]);
    if (cells.length === 0) continue;

    const label = clean(cells[0]);
    if (!label || /^lease\s*terms$/i.test(label)) continue;

    const values = Array.from({ length: inferredDataCols }, (_, i) => clean(cells[i + 1] || ''));
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

  // === ROW 1: Photo space row (one block per building group) ===
  const imageRowCells: TableCell[] = [
    makeCell('', {
      width: labelColWidth,
      bgColor: WHITE,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
      },
    }),
  ];

  for (const group of buildingGroups) {
    imageRowCells.push(
      makeCell('', {
        width: buildingGroupWidth,
        columnSpan: group.offerLabels.length,
        bgColor: GRAY_HEADER,
        verticalAlign: 'center',
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
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

  // === ROW 2: Address row directly below photo space ===
  const addressRowCells: TableCell[] = [
    makeCell('', {
      width: labelColWidth,
      bgColor: WHITE,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
      },
    }),
  ];

  for (const group of buildingGroups) {
    const [streetLine, ...rest] = group.address.split(',').map((part) => part.trim());
    const cityStateLine = rest.join(', ');

    addressRowCells.push(
      new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 20 },
            children: [
              new TextRun({
                text: streetLine || group.address,
                bold: true,
                color: '1F5C99',
                font: TABLE_FONT,
                size: 20,
              }),
            ],
          }),
          ...(cityStateLine
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 60 },
                  children: [
                    new TextRun({
                      text: cityStateLine,
                      bold: true,
                      color: '1F5C99',
                      font: TABLE_FONT,
                      size: 20,
                    }),
                  ],
                }),
              ]
            : []),
        ],
        width: { size: buildingGroupWidth, type: WidthType.DXA },
        columnSpan: group.offerLabels.length,
        verticalAlign: 'center',
        shading: { type: ShadingType.SOLID, color: WHITE, fill: WHITE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          right: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
        },
      })
    );
  }

  const addressRow = new TableRow({
    children: addressRowCells,
    height: { value: 480, rule: HeightRule.ATLEAST },
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
    const subColWidth = getSubColWidth(group);
    for (let i = 0; i < group.offerLabels.length; i++) {
      const isLastInGroup = i === group.offerLabels.length - 1;
      offerRowCells.push(
        makeCell(group.offerLabels[i], {
          bold: true,
          bgColor: GRAY_HEADER,
          fontSize: 20,
          width: subColWidth,
          spacingBefore: 120,
          spacingAfter: 120,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
            left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
            right: { style: BorderStyle.SINGLE, size: isLastInGroup ? 3 : 1, color: isLastInGroup ? NAVY : LIGHT_BORDER },
          },
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

    let colIdx = 0;
    for (const group of buildingGroups) {
      const subColWidth = getSubColWidth(group);
      for (let i = 0; i < group.offerLabels.length; i++) {
        const isLastInGroup = i === group.offerLabels.length - 1;
        cells.push(
          makeCell(row.values[colIdx] || '', {
            alignment: AlignmentType.CENTER,
            fontSize: 20,
            width: subColWidth,
            spacingBefore: 100,
            spacingAfter: 100,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
              left: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
              right: { style: BorderStyle.SINGLE, size: isLastInGroup ? 3 : 1, color: isLastInGroup ? NAVY : LIGHT_BORDER },
            },
          })
        );
        colIdx++;
      }
    }

    return new TableRow({
      children: cells,
      height: { value: dataRowHeight, rule: HeightRule.ATLEAST },
    });
  });

  // Build the table
  const table = new Table({
    rows: [headerRow, offerRow, ...dataRows],
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
