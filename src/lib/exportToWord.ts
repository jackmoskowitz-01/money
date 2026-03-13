import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Parse markdown content and convert to docx paragraphs.
 * Supports: H1-H3, bold, italic, bullet lists, numbered lists, tables, horizontal rules.
 */
function parseMarkdownToElements(markdown: string) {
  const lines = markdown.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      elements.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          },
          spacing: { after: 200 },
        })
      );
      i++;
      continue;
    }

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && /\|[\s-:]+\|/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        // Skip separator line
        if (/^\|[\s-:]+\|/.test(lines[i].trim()) || /^[\s-:|]+$/.test(lines[i].trim())) {
          i++;
          continue;
        }
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length > 0) {
        elements.push(buildTable(tableLines));
      }
      continue;
    }

    // Headings
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h1Match) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: parseInlineFormatting(h1Match[1]),
          spacing: { before: 400, after: 200 },
        })
      );
      i++;
      continue;
    }
    if (h2Match) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInlineFormatting(h2Match[1]),
          spacing: { before: 300, after: 150 },
        })
      );
      i++;
      continue;
    }
    if (h3Match) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineFormatting(h3Match[1]),
          spacing: { before: 240, after: 120 },
        })
      );
      i++;
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineFormatting(bulletMatch[1]),
          spacing: { after: 60 },
        })
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        new Paragraph({
          numbering: { reference: 'default-numbering', level: 0 },
          children: parseInlineFormatting(numMatch[1]),
          spacing: { after: 60 },
        })
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { after: 120 },
      })
    );
    i++;
  }

  return elements;
}

/** Parse inline bold, italic, bold+italic from markdown text */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Regex to match **bold**, *italic*, ***bold+italic***, and `code`
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // ***bold+italic***
      runs.push(new TextRun({ text: match[2], bold: true, italics: true, font: 'Calibri', size: 22 }));
    } else if (match[3]) {
      // **bold**
      runs.push(new TextRun({ text: match[3], bold: true, font: 'Calibri', size: 22 }));
    } else if (match[4]) {
      // *italic*
      runs.push(new TextRun({ text: match[4], italics: true, font: 'Calibri', size: 22 }));
    } else if (match[5]) {
      // `code`
      runs.push(new TextRun({ text: match[5], font: 'Consolas', size: 20, color: '555555' }));
    } else if (match[6]) {
      // plain text
      runs.push(new TextRun({ text: match[6], font: 'Calibri', size: 22 }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, font: 'Calibri', size: 22 }));
  }

  return runs;
}

/** Build a Word table from markdown table lines */
function buildTable(tableLines: string[]): Table {
  const parsedRows = tableLines.map(line =>
    line
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '')
  );

  const rows = parsedRows.map((cells, rowIndex) =>
    new TableRow({
      children: cells.map(cell =>
        new TableCell({
          children: [
            new Paragraph({
              children: parseInlineFormatting(cell),
              alignment: AlignmentType.LEFT,
              spacing: { before: 40, after: 40 },
            }),
          ],
          width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
          shading: rowIndex === 0
            ? { type: ShadingType.SOLID, color: 'E8E8E8', fill: 'E8E8E8' }
            : undefined,
        })
      ),
    })
  );

  return new Table({
    rows,
    width: { size: 9000, type: WidthType.DXA },
  });
}

/** Export markdown content as a .docx file */
export async function exportToWord(markdownContent: string, filename: string = 'report') {
  const elements = parseMarkdownToElements(markdownContent);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        heading1: {
          run: { size: 32, bold: true, font: 'Calibri', color: '1A1A2E' },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
        heading2: {
          run: { size: 26, bold: true, font: 'Calibri', color: '2D2D44' },
          paragraph: { spacing: { before: 300, after: 150 } },
        },
        heading3: {
          run: { size: 24, bold: true, font: 'Calibri', color: '3D3D5C' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
      },
    },
    sections: [
      {
        children: elements,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${safeName}.docx`);
}
