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
} from 'docx';
import { saveAs } from 'file-saver';

const NAVY = '0D1B3E';
const GRAY_HEADER = 'D9D9D9';
const GOLD_LABEL = 'C87E0A';
const WHITE = 'FFFFFF';
const LIGHT_BORDER = 'B0B0B0';
const TABLE_FONT = 'Calibri';

const thinBorder = {
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
  /** Each group = one building address with N offers underneath */
  buildingGroups: { address: string; offerLabels: string[] }[];
  /** Row label -> array of values (one per total column) */
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
  
  // Extract title
  const titleMatch = markdown.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.replace(/\*+/g, '').trim() || 'Summary of Proposals';

  // Find the table lines
  const tableLines: string[] = [];
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      // Skip separator lines
      if (/^\|[\s-:]+\|/.test(trimmed) || /^[\s-:|]+$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      inTable = true;
      tableLines.push(trimmed);
    } else if (inTable && trimmed === '') {
      // End of table
      break;
    }
  }

  if (tableLines.length < 2) {
    return { title, buildingGroups: [], rows: [] };
  }

  const parseCells = (line: string) =>
    line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

  // Row 0: building addresses (may have empty cells where same building spans)
  const addressCells = parseCells(tableLines[0]);
  // Row 1: offer labels (Lease Terms | Offer #1A | Offer #1B | ...)
  const offerCells = parseCells(tableLines[1]);

  // Build building groups by detecting address spans
  const totalCols = addressCells.length; // includes the label column
  const dataCols = totalCols - 1; // exclude first label column
  const buildingGroups: MatrixData['buildingGroups'] = [];

  // Clean markdown bold from cells
  const clean = (s: string) => s.replace(/\*+/g, '').trim();

  // Parse addresses — skip first cell (empty label column)
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

  // Parse data rows (skip first two header rows)
  const rows: MatrixData['rows'] = [];
  for (let r = 2; r < tableLines.length; r++) {
    const cells = parseCells(tableLines[r]);
    if (cells.length === 0) continue;
    const label = clean(cells[0]);
    if (!label || /^lease\s*terms$/i.test(label)) continue;
    const values = cells.slice(1).map(c => clean(c));
    // Pad to match column count
    while (values.length < dataCols) values.push('');
    rows.push({ label, values });
  }

  // Extract footnotes (anything after the table)
  const tableEnd = markdown.lastIndexOf('|');
  const afterTable = markdown.slice(tableEnd + 1).trim();
  const footnotesMatch = afterTable.match(/(?:notes?|footnotes?|analysis)[:\s]*([\s\S]+)/i);
  const footnotes = footnotesMatch?.[1]?.trim() || undefined;

  return { title, buildingGroups, rows, footnotes };
}

/** Build the Word document matching the Cresa Summary of Proposals template */
function buildMatrixDocument(data: MatrixData): Document {
  const { title, buildingGroups, rows, footnotes } = data;
  const totalDataCols = buildingGroups.reduce((sum, g) => sum + g.offerLabels.length, 0);
  const totalCols = totalDataCols + 1; // +1 for label column

  const labelColWidth = 2800;
  const remainingWidth = 11500 - labelColWidth; // landscape ~14000, but leave margins
  const dataColWidth = Math.floor(remainingWidth / Math.max(totalDataCols, 1));

  // Helper to create a cell with specific styling
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
      verticalAlign?: (typeof VerticalAlign)[keyof typeof VerticalAlign];
      borders?: typeof thinBorder;
    } = {}
  ): TableCell => {
    return new TableCell({
      children: [
        new Paragraph({
          alignment: opts.alignment || AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({
              text,
              bold: opts.bold ?? false,
              color: opts.color || '222222',
              font: TABLE_FONT,
              size: opts.fontSize || 18,
            }),
          ],
        }),
      ],
      width: { size: opts.width || dataColWidth, type: WidthType.DXA },
      shading: opts.bgColor
        ? { type: ShadingType.SOLID, color: opts.bgColor, fill: opts.bgColor }
        : undefined,
      verticalAlign: opts.verticalAlign || VerticalAlign.CENTER,
      columnSpan: opts.columnSpan,
      borders: opts.borders || thinBorder,
    });
  };

  // === ROW 1: Building address header (dark navy, white text, merged cells) ===
  const addressRowCells: TableCell[] = [
    makeCell('', {
      width: labelColWidth,
      bgColor: NAVY,
      borders: { ...thinBorder, top: { style: BorderStyle.SINGLE, size: 2, color: NAVY }, left: { style: BorderStyle.SINGLE, size: 2, color: NAVY } },
    }),
  ];

  for (const group of buildingGroups) {
    addressRowCells.push(
      makeCell(group.address, {
        bold: true,
        color: WHITE,
        bgColor: NAVY,
        fontSize: 20,
        columnSpan: group.offerLabels.length,
        width: dataColWidth * group.offerLabels.length,
        alignment: AlignmentType.CENTER,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: NAVY },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: NAVY },
          left: { style: BorderStyle.SINGLE, size: 1, color: '4A5C8A' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '4A5C8A' },
        },
      })
    );
  }

  const addressRow = new TableRow({ children: addressRowCells, tableHeader: true });

  // === ROW 2: Offer labels (gray background) ===
  const offerRowCells: TableCell[] = [
    makeCell('Lease Terms', {
      bold: true,
      width: labelColWidth,
      bgColor: GRAY_HEADER,
      alignment: AlignmentType.LEFT,
      fontSize: 18,
    }),
  ];

  for (const group of buildingGroups) {
    for (const label of group.offerLabels) {
      offerRowCells.push(
        makeCell(label, {
          bold: true,
          bgColor: GRAY_HEADER,
          fontSize: 18,
        })
      );
    }
  }

  const offerRow = new TableRow({ children: offerRowCells, tableHeader: true });

  // === DATA ROWS ===
  const dataRows = rows.map((row) => {
    const cells: TableCell[] = [
      makeCell(row.label, {
        bold: true,
        color: GOLD_LABEL,
        width: labelColWidth,
        alignment: AlignmentType.LEFT,
        fontSize: 18,
      }),
    ];

    for (let c = 0; c < totalDataCols; c++) {
      cells.push(
        makeCell(row.values[c] || '', {
          alignment: AlignmentType.CENTER,
          fontSize: 18,
        })
      );
    }

    return new TableRow({ children: cells });
  });

  // Build the table
  const table = new Table({
    rows: [addressRow, offerRow, ...dataRows],
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
          new TextRun({ text: footnotes, font: TABLE_FONT, size: 16, italics: true, color: '666666' }),
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
              width: 15840, // 11" in twips
              height: 12240, // 8.5"
            },
            margin: {
              top: 1200,
              bottom: 720,
              left: 1080,
              right: 1080,
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
          new Paragraph({ spacing: { after: 300 } }),
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
    // Fallback to generic export if parsing fails
    const { exportToWord } = await import('./exportToWord');
    return exportToWord(markdownContent, filename);
  }

  const doc = buildMatrixDocument(data);
  const blob = await Packer.toBlob(doc);
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${safeName}.docx`);
}
