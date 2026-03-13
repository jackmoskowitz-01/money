import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface CashflowData {
  companyName: string;
  analysisType: string;
  compilationStartDate: string;
  compilationTerm: string;
  compilationExpiration: string;
  annualTable: { label: string; values: string[] }[];
  yearHeaders: string[];
  totals: Record<string, string>;
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

function parseCashflowMarkdown(markdown: string): CashflowData {
  const data: CashflowData = {
    companyName: '',
    analysisType: '',
    compilationStartDate: '',
    compilationTerm: '',
    compilationExpiration: '',
    annualTable: [],
    yearHeaders: [],
    totals: {},
  };

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

  // Extract totals
  const totalFields = ['Total Compilation Value', 'Average Annual Cost', 'NPV'];
  for (const field of totalFields) {
    const re = new RegExp(`\\*\\*${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?:\\*\\*\\s*(.+)`, 'i');
    const m = markdown.match(re);
    if (m) data.totals[field] = m[1].trim();
  }

  // Parse tables
  const tables = findMarkdownTables(markdown);
  if (tables.length > 0) {
    const annual = tables[0];
    if (annual.headers.length > 0) {
      data.yearHeaders = annual.headers.slice(1);
      data.annualTable = annual.rows.map(row => ({
        label: row[0] || '',
        values: row.slice(1),
      }));
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
      if (i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())) {
        const headers = line.split('|').slice(1, -1).map(c => c.replace(/\*\*/g, '').trim());
        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
          const cells = lines[j].trim().split('|').slice(1, -1).map(c => c.replace(/\*\*/g, '').trim());
          rows.push(cells);
          j++;
        }
        if (rows.length >= 1) {
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

export async function exportCashflowToExcel(markdown: string, filename: string) {
  const data = parseCashflowMarkdown(markdown);

  // Load the template file
  const wb = new ExcelJS.Workbook();
  try {
    const response = await fetch('/templates/Cash_Flow_Analysis.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    await wb.xlsx.load(arrayBuffer);
  } catch (err) {
    console.error('Failed to load template, falling back to generated workbook:', err);
    return exportCashflowFallback(markdown, filename, data);
  }

  const ws = wb.getWorksheet(1);
  if (!ws) {
    console.error('No worksheet found in template');
    return exportCashflowFallback(markdown, filename, data);
  }

  // Fill in header fields — only set values, preserve formatting
  // Row 1: Company Name
  const cellA1 = ws.getCell('A1');
  if (data.companyName) cellA1.value = data.companyName;

  // Row 2: Analysis type (already "Lease Analysis" in template)
  if (data.analysisType) ws.getCell('A2').value = data.analysisType;

  // Row 4-6: Compilation info — values go in column B
  if (data.compilationStartDate) ws.getCell('B4').value = data.compilationStartDate;
  if (data.compilationTerm) {
    const termNum = parseInt(data.compilationTerm);
    ws.getCell('B5').value = isNaN(termNum) ? data.compilationTerm : termNum;
  }
  if (data.compilationExpiration) ws.getCell('B6').value = data.compilationExpiration;

  // Row 8 is the header row (Analysis Year, Individual Total, Period, Base Rent/SF, etc.)
  // Rows 9+ are data rows — fill in values but preserve formulas in formula columns
  const dataStartRow = 9;
  const dataRows = data.annualTable.filter(item => !/total/i.test(item.label) && item.label);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataStartRow + i;
    const item = dataRows[i];

    // Column A: Year label (e.g., "Year 1")
    ws.getCell(`A${row}`).value = item.label;

    // Fill data values into columns B onwards
    // The template columns are: A=label, B=Individual Total (year), C=Period/Rent per SF, D=Annual Base Rent, E=OpEx, F=Total
    for (let c = 0; c < item.values.length; c++) {
      const colLetter = String.fromCharCode(66 + c); // B, C, D, E, F...
      const cell = ws.getCell(`${colLetter}${row}`);
      
      // Check if cell has a formula — if so, skip it to preserve the formula
      if (cell.formula || cell.sharedFormula) {
        continue;
      }

      const val = item.values[c];
      const num = parseDollar(val);
      if (num !== null) {
        cell.value = num;
      } else {
        // Try plain number
        const plain = parseFloat(val?.replace(/,/g, '') || '');
        if (!isNaN(plain)) {
          cell.value = plain;
        } else {
          cell.value = val || '';
        }
      }
    }
  }

  // TOTAL row — find it in the annual table
  const totalItem = data.annualTable.find(item => /total/i.test(item.label));
  if (totalItem) {
    const totalRow = dataStartRow + dataRows.length;
    ws.getCell(`A${totalRow}`).value = totalItem.label || 'TOTAL';
    
    for (let c = 0; c < totalItem.values.length; c++) {
      const colLetter = String.fromCharCode(66 + c);
      const cell = ws.getCell(`${colLetter}${totalRow}`);
      
      // Preserve formulas (SUM formulas in total row)
      if (cell.formula || cell.sharedFormula) continue;

      const val = totalItem.values[c];
      const num = parseDollar(val);
      if (num !== null) {
        cell.value = num;
      } else {
        cell.value = val || '';
      }
    }
  }

  // Totals section at the bottom — find the "Totals" label row and fill below it
  // Scan for the Totals section starting after the annual table
  const totalsStartRow = dataStartRow + dataRows.length + 3;
  let totalsRow = totalsStartRow;
  for (const [label, val] of Object.entries(data.totals)) {
    ws.getCell(`A${totalsRow}`).value = label;
    const num = parseDollar(val);
    if (num !== null) {
      ws.getCell(`B${totalsRow}`).value = num;
    } else {
      ws.getCell(`B${totalsRow}`).value = val || '';
    }
    totalsRow++;
  }

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename.replace(/[^a-zA-Z0-9_\- ]/g, '')}.xlsx`);
}

// Fallback: build from scratch if template can't be loaded
async function exportCashflowFallback(markdown: string, filename: string, data: CashflowData) {
  const NAVY = '002B5C';
  const WHITE = 'FFFFFF';
  const LIGHT_GRAY = 'F2F2F2';
  const BORDER_COLOR = 'B0B0B0';
  const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } };
  const allBorders: Partial<ExcelJS.Borders> = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const currencyWhole = '#,##0';
  const currency = '#,##0.00';

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cash Flow Summary');
  const yearCount = Math.max(data.yearHeaders.length, 1);
  const totalCols = yearCount + 2;

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 18;
  for (let c = 3; c <= totalCols; c++) ws.getColumn(c).width = 16;

  let row = 1;

  // Company Name
  const companyRow = ws.getRow(row);
  ws.mergeCells(row, 1, row, totalCols);
  companyRow.getCell(1).value = data.companyName || 'Company Name';
  companyRow.getCell(1).font = { bold: true, size: 14, color: { argb: WHITE } };
  companyRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  companyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  companyRow.height = 28;
  row++;

  const typeRow = ws.getRow(row);
  ws.mergeCells(row, 1, row, totalCols);
  typeRow.getCell(1).value = data.analysisType || 'Lease Analysis';
  typeRow.getCell(1).font = { bold: true, size: 11, color: { argb: WHITE } };
  typeRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  typeRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row++;
  row++;

  const compFields = [
    ['Compilation Start Date', data.compilationStartDate],
    ['Compilation Term (months)', data.compilationTerm],
    ['Compilation Expiration Date', data.compilationExpiration],
  ];
  for (const [label, val] of compFields) {
    const r = ws.getRow(row);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).value = val || '';
    r.getCell(2).font = { size: 10 };
    row++;
  }
  row++;

  const yearHeaderRow = ws.getRow(row);
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

  for (const item of data.annualTable) {
    const r = ws.getRow(row);
    const label = item.label;
    const isTotal = /total/i.test(label);
    const isSeparator = !label && item.values.every(v => !v);
    if (isSeparator) { row++; continue; }

    r.getCell(1).value = label;
    r.getCell(1).font = { bold: isTotal, size: 10 };
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
      cell.font = { bold: isTotal, size: 10 };
      cell.alignment = { horizontal: 'right' };
      if (isTotal) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } };
      }
    }
    r.eachCell(c => { c.border = allBorders; });
    row++;
  }

  row += 2;

  const totalsHeaderRow = ws.getRow(row);
  ws.mergeCells(row, 1, row, 3);
  totalsHeaderRow.getCell(1).value = 'Totals';
  totalsHeaderRow.getCell(1).font = { bold: true, size: 12, color: { argb: WHITE } };
  totalsHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  row++;

  for (const [label, val] of Object.entries(data.totals)) {
    const r = ws.getRow(row);
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

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename.replace(/[^a-zA-Z0-9_\- ]/g, '')}.xlsx`);
}
