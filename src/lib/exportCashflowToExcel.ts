import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Exact input cells in Cash_Flow_Analysis.xlsx.
 * We only write these cells so formulas/formatting remain untouched.
 */
const INPUT_CELLS = {
  leaseCommencementDate: 'H10',
  analysisStartDate: 'H11',
  leaseTerm: 'H12',
  leaseExpirationDate: 'H13',
  baseRent: 'H17',
  perAnnumEscalation: 'H18',
  escalationMonth: 'H19',
  squareFootage: 'H20',
  totalMonthsFreeRent: 'H24',
  opexBaseYear: 'M12',
  opexBaseMonth: 'M13',
  opexBuildingBaseAmount: 'M17',
  opexTenantBaseAmount: 'M18',
  opexPerAnnumEscalation: 'M19',
  retBuildingBaseAmount: 'M24',
  retTenantBaseAmount: 'M25',
  retPerAnnumEscalation: 'M26',
} as const;

type InputKey = keyof typeof INPUT_CELLS;
type ExtractedInputs = Partial<Record<InputKey, string | number | Date | null>>;

const KEY_ALIASES: Record<InputKey, string[]> = {
  leaseCommencementDate: ['lease commencement date', 'commencement date'],
  analysisStartDate: ['analysis start date', 'compilation start date', 'start date'],
  leaseTerm: ['lease term months', 'lease term', 'compilation term months', 'compilation term'],
  leaseExpirationDate: ['lease expiration date', 'expiration date', 'compilation expiration date'],
  baseRent: ['base rent', 'base rent sf', 'base rent/sf'],
  perAnnumEscalation: ['per annum escalation', 'annual escalation', 'rent escalation'],
  escalationMonth: ['escalation month'],
  squareFootage: ['square feet leased', 'square footage leased', 'square feet', 'sf leased'],
  totalMonthsFreeRent: ['total months of free rent', 'free rent months', 'total free rent months'],
  opexBaseYear: ['operating expense base year', 'opex base year', 'oe base year', 'base year'],
  opexBaseMonth: ['operating expense base month', 'opex base month', 'oe base month', 'base month'],
  opexBuildingBaseAmount: ['operating expense building base amount', 'opex building base amount', 'oe building base amount'],
  opexTenantBaseAmount: ['operating expense tenant base amount', 'opex tenant base amount', 'oe tenant base amount'],
  opexPerAnnumEscalation: ['operating expense per annum escalation', 'opex per annum escalation', 'oe escalation'],
  retBuildingBaseAmount: ['real estate tax building base amount', 'ret building base amount'],
  retTenantBaseAmount: ['real estate tax tenant base amount', 'ret tenant base amount'],
  retPerAnnumEscalation: ['real estate tax per annum escalation', 'ret per annum escalation'],
};

const DATE_KEYS: InputKey[] = ['leaseCommencementDate', 'analysisStartDate', 'leaseExpirationDate'];
const PERCENT_KEYS: InputKey[] = ['perAnnumEscalation', 'opexPerAnnumEscalation', 'retPerAnnumEscalation'];
const NUMBER_KEYS: InputKey[] = [
  'leaseTerm',
  'baseRent',
  'squareFootage',
  'totalMonthsFreeRent',
  'opexBaseYear',
  'opexBuildingBaseAmount',
  'opexTenantBaseAmount',
  'retBuildingBaseAmount',
  'retTenantBaseAmount',
];

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/\*\*/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\(.*?\)/g, (m) => m.replace(/[()]/g, ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanValue(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function parseMarkdownLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Table row: | Key | Value |
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => cleanValue(c));

    if (cells.length >= 2) {
      const key = cells[0];
      const value = cells[1];
      if (key && value && !/^[-: ]+$/.test(key)) {
        return { key, value };
      }
    }
  }

  // Bullet / plain / bold: - **Key:** value OR **Key:** value OR Key: value
  const colonMatch = trimmed.match(/^(?:[-*]\s+)?(?:\*\*)?([^:|]+?)(?:\*\*)?\s*:\s*(.+)$/);
  if (colonMatch) {
    const key = cleanValue(colonMatch[1]);
    const value = cleanValue(colonMatch[2]);
    if (key && value) return { key, value };
  }

  return null;
}

function collectLabeledValues(markdown: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = markdown.split('\n');

  for (const line of lines) {
    const parsed = parseMarkdownLine(line);
    if (!parsed) continue;

    const normalizedKey = normalizeLabel(parsed.key);
    if (!normalizedKey || !parsed.value) continue;

    // Keep first occurrence by default; many reports repeat values in other sections.
    if (!map.has(normalizedKey)) {
      map.set(normalizedKey, parsed.value);
    }
  }

  return map;
}

function findByAliases(values: Map<string, string>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const normalizedAlias = normalizeLabel(alias);

    if (values.has(normalizedAlias)) return values.get(normalizedAlias) ?? null;

    // Fuzzy fallback: alias contained in key or key contained in alias.
    for (const [k, v] of values.entries()) {
      if (k.includes(normalizedAlias) || normalizedAlias.includes(k)) {
        return v;
      }
    }
  }

  return null;
}

function monthNameToNumber(value: string): number | null {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];

  const numeric = parseInt(value, 10);
  if (!isNaN(numeric) && numeric >= 1 && numeric <= 12) return numeric;

  const normalized = value.toLowerCase();
  const idx = monthNames.findIndex((m) => normalized.startsWith(m) || normalized.startsWith(m.slice(0, 3)));
  return idx >= 0 ? idx + 1 : null;
}

function extractInputsFromMarkdown(markdown: string): ExtractedInputs {
  const values = collectLabeledValues(markdown);
  const inputs: ExtractedInputs = {};

  (Object.keys(KEY_ALIASES) as InputKey[]).forEach((key) => {
    const found = findByAliases(values, KEY_ALIASES[key]);
    if (found) inputs[key] = found;
  });

  // Derive escalation month from commencement date if not explicitly provided.
  if (!inputs.escalationMonth && typeof inputs.leaseCommencementDate === 'string') {
    const dt = new Date(inputs.leaseCommencementDate);
    if (!isNaN(dt.getTime())) inputs.escalationMonth = dt.getMonth() + 1;
  }

  return inputs;
}

function parseNumeric(value: string): number | null {
  const cleaned = value.replace(/[^0-9.\-()]/g, '');
  if (!cleaned) return null;

  const isNegative = cleaned.includes('(') && cleaned.includes(')');
  const number = parseFloat(cleaned.replace(/[()]/g, ''));
  if (isNaN(number)) return null;

  return isNegative ? -number : number;
}

function coerceValue(key: InputKey, raw: string | number | Date | null | undefined): string | number | Date | null {
  if (raw == null || raw === '') return null;

  if (typeof raw === 'number' || raw instanceof Date) return raw;
  const value = String(raw).trim();

  if (DATE_KEYS.includes(key)) {
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? value : dt;
  }

  if (PERCENT_KEYS.includes(key)) {
    const num = parseNumeric(value);
    if (num == null) return value;
    return num > 1 ? num / 100 : num;
  }

  if (NUMBER_KEYS.includes(key)) {
    const num = parseNumeric(value);
    return num == null ? value : num;
  }

  if (key === 'escalationMonth' || key === 'opexBaseMonth') {
    return monthNameToNumber(value) ?? value;
  }

  return value;
}

export async function exportCashflowToExcel(markdown: string, filename: string) {
  const inputs = extractInputsFromMarkdown(markdown);

  const workbook = new ExcelJS.Workbook();
  const response = await fetch('/templates/Cash_Flow_Analysis.xlsx');
  const arrayBuffer = await response.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const sheet = workbook.getWorksheet(1);
  if (!sheet) throw new Error('No worksheet found in template');

  for (const [key, cellRef] of Object.entries(INPUT_CELLS) as [InputKey, string][]) {
    const coerced = coerceValue(key, inputs[key]);
    if (coerced == null) continue;
    sheet.getCell(cellRef).value = coerced as ExcelJS.CellValue;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  saveAs(blob, `${filename.replace(/[^a-zA-Z0-9_\- ]/g, '')}.xlsx`);
}
