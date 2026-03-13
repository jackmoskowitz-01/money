import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const NAVY = '002B5C';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'F2F2F2';
const BORDER_COLOR = 'B0B0B0';

const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } };
const allBorders: Partial<ExcelJS.Borders> = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const currency = '#,##0.00';
const currencyWhole = '#,##0';

interface CashflowData {
  companyName: string;
  analysisType: string;
  compilationStartDate: string;
  compilationTerm: string;
  compilationExpiration: string;
  leaseTerms: Record<string, string>;
  annualTable: { label: string; values: string[] }[];
  yearHeaders: string[];
  monthlyTable: { label: string; values: string[] }[];
  monthHeaders: string[];
  totals: Record<string, string>;
}

function parseCashflowMarkdown(markdown: string): CashflowData {
  const data: CashflowData = {
    companyName: '',
    analysisType: '',
    compilationStartDate: '',
    compilationTerm: '',
    compilationExpiration: '',
    leaseTerms: {},
    annualTable: [],
    yearHeaders: [],
    monthlyTable: [],
    monthHeaders: [],
    totals: {},
  };

  // Extract header fields
  const companyMatch = markdown.match(/\*\*Company Name:\*\*\s*(.+)/i);
  if (companyMatch) data.companyName = companyMatch[1].trim();

  const typeMatch = markdown.match(/\*\*Type of Analysis.*?:\*\*\s*(.+)/i);
  if (typeMatch) data.analysisType = typeMatch[1].trim();

  const startMatch = markdown.match(/\*\*Compilation Start Date:\*\*\s*(.+)/i);
  if (startMatch) data.compilationStartDate = startMatch[1].trim();

  const termMatch = markdown.match(/\*\*Compilation Term \(months\):\*\*\s*(.+)/i);
  if (termMatch) data.compilationTerm = termMatch[1].trim();

  const expMatch = markdown.match(/\*\*Compilation Expiration.*?:\*\*\s*(.+)/i);
  if (expMatch) data.compilationExpiration = expMatch[1].trim();

  // Extract key lease terms
  const termFields = [
    'Lease Commencement Date', 'Analysis Start Date', 'Lease Term',
    'Lease Expiration Date', 'Base Rent', 'Per Annum Escalation',
    'Escalation Month', 'Square Feet Leased', 'Total Months of Free Rent',
    'Lease Type', 'Operating Expense', 'Real Estate Tax',
    'Tenant Improvement Allowance', 'Project/Buildout Cost',
  ];
  for (const field of termFields) {
    const re = new RegExp(`\\*\\*${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?:\\*\\*\\s*(.+)`, 'i');
    const m = markdown.match(re);
    if (m) data.leaseTerms[field] = m[1].trim();
  }

  // Extract totals
  const totalFields = ['Total Compilation Value', 'Average Annual Cost', 'NPV'];
  for (const field of totalFields) {
    const re = new RegExp(`\\*\\*${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?:\\*\\*\\s*(.+)`, 'i');
    const m = markdown.match(re);
    if (m) data.totals[field] = m[1].trim();
  }

  // Parse annual summary table
  const annualSection = markdown.match(/### Format — Annual Summary Table[\s\S]*?\n(\|[\s\S]*?\n)\n/i)
    || markdown.match(/Annual Summary[\s\S]*?\n(\|[\s\S]*?\n)\n/i);

  // Find all markdown tables
  const tables = findMarkdownTables(markdown);

  if (tables.length > 0) {
    // First substantial table = annual summary
    const annual = tables[0];
    if (annual.headers.length > 0) {
      data.yearHeaders = annual.headers.slice(1); // skip label column
      data.annualTable = annual.rows.map(row => ({
        label: row[0] || '',
        values: row.slice(1),
      }));
    }

    // Second substantial table = monthly detail
    if (tables.length > 1) {
      const monthly = tables[1];
      if (monthly.headers.length > 0) {
        data.monthHeaders = monthly.headers.slice(1);
        data.monthlyTable = monthly.rows.map(row => ({
          label: row[0] || '',
          values: row.slice(1),
        }));
      }
    }
  }

  return data;
}

function findMarkdownTables(md: string): { headers: string[]; rows: string[][] }[] {
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      // Check if next line is separator
      if (i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())) {
        const headers = line.split('|').slice(1, -1).map(c => c.replace(/\*\*/g, '').trim());
        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
          const cells = lines[j].trim().split('|').slice(1, -1).map(c => c.replace(/\*\*/g, '').trim());
          rows.push(cells);
          j++;
        }
        if (rows.length >= 3) {
          tables.push({ headers, rows });
        }
        i = j;
        continue;
      }
    }
    i++;
  }

  return tables;
}

function parseDollar(val: string): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^0-9.\-()]/g, '');
  if (!cleaned) return null;
  const isNeg = val.includes('(') && val.includes(')');
  const num = parseFloat(cleaned.replace(/[()]/g, ''));
  if (isNaN(num)) return null;
  return isNeg ? -num : num;
}

export async function exportCashflowToExcel(markdown: string, filename: string) {
  const data = parseCashflowMarkdown(markdown);
  const wb = new ExcelJS.Workbook();

  // ──── Sheet 1: Annual Summary ────
  const ws1 = wb.addWorksheet('Cash Flow Summary');
  const yearCount = Math.max(data.yearHeaders.length, 1);
  const totalCols = yearCount + 2; // label col + individual total + year cols

  // Set column widths
  ws1.getColumn(1).width = 30;
  ws1.getColumn(2).width = 18;
  for (let c = 3; c <= totalCols; c++) ws1.getColumn(c).width = 16;

  // Header rows
  let row = 1;

  // Company Name
  const companyRow = ws1.getRow(row);
  ws1.mergeCells(row, 1, row, totalCols);
  companyRow.getCell(1).value = data.companyName || 'Company Name';
  companyRow.getCell(1).font = { bold: true, size: 14, color: { argb: WHITE } };
  companyRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  companyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  companyRow.height = 28;
  row++;

  // Type of Analysis
  const typeRow = ws1.getRow(row);
  ws1.mergeCells(row, 1, row, totalCols);
  typeRow.getCell(1).value = data.analysisType || 'Lease Analysis';
  typeRow.getCell(1).font = { bold: true, size: 11, color: { argb: WHITE } };
  typeRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  typeRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row++;

  // Blank row
  row++;

  // Compilation info
  const compFields = [
    ['Compilation Start Date', data.compilationStartDate],
    ['Compilation Term (months)', data.compilationTerm],
    ['Compilation Expiration Date', data.compilationExpiration],
  ];
  for (const [label, val] of compFields) {
    const r = ws1.getRow(row);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).value = val || '';
    r.getCell(2).font = { size: 10 };
    row++;
  }

  // Blank row
  row++;

  // Year headers row
  const yearHeaderRow = ws1.getRow(row);
  yearHeaderRow.getCell(1).value = 'Analysis Year';
  yearHeaderRow.getCell(1).font = { bold: true, size: 10, color: { argb: WHITE } };
  yearHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  yearHeaderRow.getCell(2).value = 'Individual Total';
  yearHeaderRow.getCell(2).font = { bold: true, size: 10, color: { argb: WHITE } };
  yearHeaderRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  for (let c = 0; c < data.yearHeaders.length; c++) {
    const cell = yearHeaderRow.getCell(c + 3);
    cell.value = data.yearHeaders[c];
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center' };
  }
  yearHeaderRow.eachCell(c => { c.border = allBorders; });
  row++;

  // Data rows
  for (const item of data.annualTable) {
    const r = ws1.getRow(row);
    const label = item.label;
    const isTotal = /total/i.test(label);
    const isDates = /dates?$/i.test(label) || /start date|end date/i.test(label);
    const isSeparator = !label && item.values.every(v => !v);

    if (isSeparator) { row++; continue; }

    r.getCell(1).value = label;
    r.getCell(1).font = { bold: isTotal, size: 10, italic: isDates };

    if (isTotal) {
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
    }

    for (let c = 0; c < item.values.length; c++) {
      const cell = r.getCell(c + 2);
      const val = item.values[c];
      const num = parseDollar(val);
      if (num !== null) {
        cell.value = num;
        cell.numFmt = num % 1 === 0 ? currencyWhole : currency;
      } else {
        cell.value = val || '';
      }
      cell.font = { bold: isTotal, size: 10, italic: isDates };
      cell.alignment = { horizontal: 'right' };
      if (isTotal) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
      }
    }
    r.eachCell(c => { c.border = allBorders; });
    row++;
  }

  // Blank rows
  row += 2;

  // Totals section
  const totalsHeaderRow = ws1.getRow(row);
  ws1.mergeCells(row, 1, row, 3);
  totalsHeaderRow.getCell(1).value = 'Totals';
  totalsHeaderRow.getCell(1).font = { bold: true, size: 12, color: { argb: WHITE } };
  totalsHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  row++;

  for (const [label, val] of Object.entries(data.totals)) {
    const r = ws1.getRow(row);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true, size: 10 };
    const num = parseDollar(val);
    if (num !== null) {
      r.getCell(2).value = num;
      r.getCell(2).numFmt = currencyWhole;
    } else {
      r.getCell(2).value = val || '';
    }
    r.getCell(2).font = { size: 10 };
    r.eachCell(c => { c.border = allBorders; });
    row++;
  }

  // ──── Sheet 2: Monthly Detail ────
  if (data.monthlyTable.length > 0) {
    const ws2 = wb.addWorksheet('Monthly Detail');
    const monthCount = Math.max(data.monthHeaders.length, 1);

    ws2.getColumn(1).width = 22;
    for (let c = 2; c <= monthCount + 1; c++) ws2.getColumn(c).width = 14;

    // Title
    let mRow = 1;
    const titleRow = ws2.getRow(mRow);
    ws2.mergeCells(mRow, 1, mRow, Math.min(monthCount + 1, 14));
    titleRow.getCell(1).value = `${data.companyName || 'Company'} — Monthly Cash Flow Detail`;
    titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: WHITE } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    titleRow.height = 26;
    mRow++;

    // Month headers
    const mHeaderRow = ws2.getRow(mRow);
    mHeaderRow.getCell(1).value = 'Month';
    mHeaderRow.getCell(1).font = { bold: true, size: 10, color: { argb: WHITE } };
    mHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    for (let c = 0; c < data.monthHeaders.length; c++) {
      const cell = mHeaderRow.getCell(c + 2);
      cell.value = data.monthHeaders[c];
      cell.font = { bold: true, size: 9, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: 'center' };
    }
    mHeaderRow.eachCell(c => { c.border = allBorders; });
    mRow++;

    // Monthly data rows
    for (const item of data.monthlyTable) {
      const r = ws2.getRow(mRow);
      const label = item.label;
      const isTotal = /total/i.test(label);

      r.getCell(1).value = label;
      r.getCell(1).font = { bold: isTotal, size: 9 };
      if (isTotal) {
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
      }

      for (let c = 0; c < item.values.length; c++) {
        const cell = r.getCell(c + 2);
        const val = item.values[c];
        const num = parseDollar(val);
        if (num !== null) {
          cell.value = num;
          cell.numFmt = currencyWhole;
        } else {
          cell.value = val || '';
        }
        cell.font = { bold: isTotal, size: 9 };
        cell.alignment = { horizontal: 'right' };
        if (isTotal) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
        }
      }
      r.eachCell(c => { c.border = allBorders; });
      mRow++;
    }
  }

  // ──── Sheet 3: Lease Terms ────
  if (Object.keys(data.leaseTerms).length > 0) {
    const ws3 = wb.addWorksheet('Lease Terms');
    ws3.getColumn(1).width = 35;
    ws3.getColumn(2).width = 30;

    let tRow = 1;
    const tTitle = ws3.getRow(tRow);
    ws3.mergeCells(tRow, 1, tRow, 2);
    tTitle.getCell(1).value = 'Lease Terms';
    tTitle.getCell(1).font = { bold: true, size: 13, color: { argb: WHITE } };
    tTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    tTitle.height = 26;
    tRow++;

    for (const [key, val] of Object.entries(data.leaseTerms)) {
      const r = ws3.getRow(tRow);
      r.getCell(1).value = key;
      r.getCell(1).font = { bold: true, size: 10 };
      r.getCell(2).value = val;
      r.getCell(2).font = { size: 10 };
      r.eachCell(c => { c.border = allBorders; });
      tRow++;
    }
  }

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename.replace(/[^a-zA-Z0-9_\- ]/g, '')}.xlsx`);
}
