import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Input cell map for the Cash_Flow_Analysis.xlsx template.
 * All other cells contain formulas — we only touch these.
 */
const INPUT_CELLS = {
  // Lease Terms (Column H)
  leaseCommencementDate: 'H10',
  analysisStartDate: 'H11',
  leaseTerm: 'H12',
  leaseExpirationDate: 'H13',
  baseRent: 'H17',
  perAnnumEscalation: 'H18',
  escalationMonth: 'H19',
  squareFootage: 'H20',
  totalMonthsFreeRent: 'H24',
  // Operating Expense Terms (Column M)
  opexBaseYear: 'M12',
  opexBaseMonth: 'M13',
  opexBuildingBaseAmount: 'M17',
  opexTenantBaseAmount: 'M18',
  opexPerAnnumEscalation: 'M19',
  retBuildingBaseAmount: 'M24',
  retTenantBaseAmount: 'M25',
  retPerAnnumEscalation: 'M26',
} as const;

interface ExtractedInputs {
  [key: string]: string | number | Date | null;
}

/**
 * Parse the AI-generated markdown to extract the specific input values
 * that map to template cells.
 */
function extractInputsFromMarkdown(markdown: string): ExtractedInputs {
  const inputs: ExtractedInputs = {};

  const patterns: Record<string, RegExp[]> = {
    leaseCommencementDate: [
      /\*\*Lease Commencement Date:?\*\*\s*(.+)/i,
      /Commencement Date:?\s*(.+)/i,
    ],
    analysisStartDate: [
      /\*\*(?:Analysis|Compilation) Start Date:?\*\*\s*(.+)/i,
      /Analysis Start Date:?\s*(.+)/i,
    ],
    leaseTerm: [
      /\*\*(?:Lease Term|Compilation Term)\s*\(months\):?\*\*\s*(.+)/i,
      /Lease Term:?\s*(\d+)/i,
    ],
    leaseExpirationDate: [
      /\*\*(?:Lease Expiration|Compilation Expiration)\s*(?:Date)?:?\*\*\s*(.+)/i,
      /Expiration Date:?\s*(.+)/i,
    ],
    baseRent: [
      /\*\*Base Rent:?\*\*\s*(.+)/i,
      /Base Rent(?:\/SF)?:?\s*\$?([\d.,]+)/i,
    ],
    perAnnumEscalation: [
      /\*\*Per Annum Escalation:?\*\*\s*(.+)/i,
      /(?:Annual|Per Annum) Escalation:?\s*([\d.]+%?)/i,
    ],
    escalationMonth: [
      /\*\*Escalation Month:?\*\*\s*(.+)/i,
      /Escalation Month:?\s*(.+)/i,
    ],
    squareFootage: [
      /\*\*Square (?:Feet|Footage) Leased:?\*\*\s*(.+)/i,
      /Square Feet:?\s*([\d,]+)/i,
    ],
    totalMonthsFreeRent: [
      /\*\*Total Months of Free Rent:?\*\*\s*(.+)/i,
      /Free Rent:?\s*(\d+)\s*months?/i,
    ],
    opexBaseYear: [
      /\*\*Operating Expense Base Year:?\*\*\s*(.+)/i,
      /(?:OE|OpEx|Operating)\s*(?:Expense)?\s*Base Year:?\s*(.+)/i,
    ],
    opexBaseMonth: [
      /\*\*(?:Operating Expense )?Base Month:?\*\*\s*(.+)/i,
    ],
    opexBuildingBaseAmount: [
      /\*\*Operating Expense Building Base Amount:?\*\*\s*(.+)/i,
      /(?:OE|OpEx)\s*Building Base\s*(?:Amount)?:?\s*\$?([\d.,]+)/i,
    ],
    opexTenantBaseAmount: [
      /\*\*Operating Expense Tenant Base Amount:?\*\*\s*(.+)/i,
      /(?:OE|OpEx)\s*Tenant Base\s*(?:Amount)?:?\s*\$?([\d.,]+)/i,
    ],
    opexPerAnnumEscalation: [
      /\*\*Operating Expense Per Annum Escalation:?\*\*\s*(.+)/i,
      /(?:OE|OpEx)\s*(?:Per Annum |Annual )?Escalation:?\s*([\d.]+%?)/i,
    ],
    retBuildingBaseAmount: [
      /\*\*Real Estate Tax Building Base Amount:?\*\*\s*(.+)/i,
      /(?:RET|Real Estate Tax)\s*Building Base\s*(?:Amount)?:?\s*\$?([\d.,]+)/i,
    ],
    retTenantBaseAmount: [
      /\*\*Real Estate Tax Tenant Base Amount:?\*\*\s*(.+)/i,
      /(?:RET|Real Estate Tax)\s*Tenant Base\s*(?:Amount)?:?\s*\$?([\d.,]+)/i,
    ],
    retPerAnnumEscalation: [
      /\*\*Real Estate Tax Per Annum Escalation:?\*\*\s*(.+)/i,
      /(?:RET|Real Estate Tax)\s*(?:Per Annum |Annual )?Escalation:?\s*([\d.]+%?)/i,
    ],
  };

  for (const [key, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const match = markdown.match(regex);
      if (match) {
        inputs[key] = match[1].trim();
        break;
      }
    }
  }

  return inputs;
}

/**
 * Coerce a raw string value into the right type for an Excel cell.
 */
function coerceValue(key: string, raw: string | number | Date | null | undefined): string | number | Date | null {
  if (raw == null || raw === '') return null;
  const str = String(raw).trim();

  // Date fields
  const dateFields = ['leaseCommencementDate', 'analysisStartDate', 'leaseExpirationDate'];
  if (dateFields.includes(key)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return str; // fallback to string if date can't be parsed
  }

  // Percentage fields — store as decimal (e.g., 3% → 0.03)
  const pctFields = ['perAnnumEscalation', 'opexPerAnnumEscalation', 'retPerAnnumEscalation'];
  if (pctFields.includes(key)) {
    const cleaned = str.replace(/[%$,]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num > 1 ? num / 100 : num;
    return str;
  }

  // Dollar/number fields
  const numFields = [
    'leaseTerm', 'baseRent', 'squareFootage', 'totalMonthsFreeRent',
    'opexBaseYear', 'opexBuildingBaseAmount', 'opexTenantBaseAmount',
    'retBuildingBaseAmount', 'retTenantBaseAmount',
  ];
  if (numFields.includes(key)) {
    const cleaned = str.replace(/[$,]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
    return str;
  }

  // Escalation month — try to parse as a number (month index) or leave as string
  if (key === 'escalationMonth') {
    const monthNum = parseInt(str);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) return monthNum;
    // Try month name → number
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const idx = monthNames.findIndex(m => str.toLowerCase().startsWith(m));
    if (idx >= 0) return idx + 1;
    return str;
  }

  // opexBaseMonth — similar to escalation month
  if (key === 'opexBaseMonth') {
    const monthNum = parseInt(str);
    if (!isNaN(monthNum)) return monthNum;
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const idx = monthNames.findIndex(m => str.toLowerCase().startsWith(m));
    if (idx >= 0) return idx + 1;
    return str;
  }

  return str;
}

export async function exportCashflowToExcel(markdown: string, filename: string) {
  const inputs = extractInputsFromMarkdown(markdown);

  // Load the template
  const wb = new ExcelJS.Workbook();
  try {
    const response = await fetch('/templates/Cash_Flow_Analysis.xlsx');
    const arrayBuffer = await response.arrayBuffer();
    await wb.xlsx.load(arrayBuffer);
  } catch (err) {
    console.error('Failed to load template:', err);
    throw new Error('Could not load Cash Flow template');
  }

  const ws = wb.getWorksheet(1);
  if (!ws) throw new Error('No worksheet found in template');

  // Inject each extracted value into the correct cell
  for (const [key, cellRef] of Object.entries(INPUT_CELLS)) {
    const rawValue = inputs[key];
    const value = coerceValue(key, rawValue);

    if (value != null) {
      const cell = ws.getCell(cellRef);
      cell.value = value as ExcelJS.CellValue;
    }
  }

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${filename.replace(/[^a-zA-Z0-9_\- ]/g, '')}.xlsx`);
}
