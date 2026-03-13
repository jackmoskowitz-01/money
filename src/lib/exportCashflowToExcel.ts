import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Exact input cells in Cash_Flow_Analysis.xlsx.
 * Only these cells are updated.
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

const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

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

function parseDateLoose(value: string): Date | null {
  const dt = new Date(value.trim());
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function deriveInputsFromNarrative(markdown: string, inputs: ExtractedInputs): void {
  const analysisStartMatch = markdown.match(/\*\*Analysis Start Date:\*\*\s*([^\n]+)/i);
  if (!inputs.analysisStartDate && analysisStartMatch) {
    inputs.analysisStartDate = analysisStartMatch[1].replace(/\(.*?\)/g, '').trim();
  }

  const premisesMatch = markdown.match(/\*\*Premises:\*\*\s*([\d,]+)\s*(?:RSF|SF)/i);
  if (!inputs.squareFootage && premisesMatch) {
    inputs.squareFootage = premisesMatch[1];
  }

  const termMatch = markdown.match(/\*\*Term:\*\*[^\n(]*\((\d+)\s*Months\)/i) || markdown.match(/\b(\d+)\s*Months\b/i);
  if (!inputs.leaseTerm && termMatch) {
    inputs.leaseTerm = termMatch[1];
  }

  const year1Match = markdown.match(/\|\s*\*\*?Year\s*1\*\*?\s*\|\s*[^|]*\|\s*\$?([\d,.]+)\s*\|/i);
  const year2Match = markdown.match(/\|\s*\*\*?Year\s*2\*\*?\s*\|\s*[^|]*\|\s*\$?([\d,.]+)\s*\|/i);
  if (!inputs.baseRent && year1Match) {
    inputs.baseRent = year1Match[1];
  }

  if (!inputs.perAnnumEscalation) {
    const escalationMatch = markdown.match(/(?:Per Annum|Annual)\s+Escalation[^\n:]*:\s*([\d.]+%?)/i);
    if (escalationMatch) {
      inputs.perAnnumEscalation = escalationMatch[1];
    } else if (year1Match && year2Match) {
      const y1 = parseNumeric(year1Match[1]);
      const y2 = parseNumeric(year2Match[1]);
      if (y1 && y2 && y1 > 0) {
        inputs.perAnnumEscalation = ((y2 / y1) - 1).toString();
      }
    }
  }

  const freeRentMatch = markdown.match(/(\d+)\s*months?\s*(?:of\s*)?(?:base\s*)?rent\s*abatement/i)
    || markdown.match(/free\s*rent[^\n]*?(\d+)\s*months?/i);
  if (!inputs.totalMonthsFreeRent && freeRentMatch) {
    inputs.totalMonthsFreeRent = freeRentMatch[1];
  }

  if (!inputs.leaseCommencementDate) {
    const explicitCommencement = markdown.match(/Lease\s+Commencement\s+Date[^\n:]*:\s*([^\n]+)/i);
    if (explicitCommencement) {
      inputs.leaseCommencementDate = explicitCommencement[1].trim();
    } else if (analysisStartMatch && /lease commencement/i.test(analysisStartMatch[0])) {
      inputs.leaseCommencementDate = analysisStartMatch[1].replace(/\(.*?\)/g, '').trim();
    } else if (inputs.analysisStartDate) {
      inputs.leaseCommencementDate = inputs.analysisStartDate;
    }
  }

  const commencementRaw = inputs.leaseCommencementDate;
  const commencementDate = typeof commencementRaw === 'string'
    ? parseDateLoose(commencementRaw)
    : commencementRaw instanceof Date
      ? commencementRaw
      : null;

  if (!inputs.escalationMonth && commencementDate) {
    inputs.escalationMonth = commencementDate.getMonth() + 1;
  }

  if (!inputs.leaseExpirationDate && commencementDate && inputs.leaseTerm) {
    const termMonths = parseNumeric(String(inputs.leaseTerm));
    if (termMonths && termMonths > 0) {
      const exp = new Date(commencementDate);
      exp.setMonth(exp.getMonth() + Math.round(termMonths));
      exp.setDate(exp.getDate() - 1);
      inputs.leaseExpirationDate = exp;
    }
  }

  const opexHeaderMatch = markdown.match(/OpEx\s*\(\$?([\d,.]+)\s*\/\s*SF\)/i);
  if (opexHeaderMatch) {
    if (!inputs.opexBuildingBaseAmount) inputs.opexBuildingBaseAmount = opexHeaderMatch[1];
    if (!inputs.opexTenantBaseAmount) inputs.opexTenantBaseAmount = opexHeaderMatch[1];
  }

  if (commencementDate) {
    if (!inputs.opexBaseYear) inputs.opexBaseYear = commencementDate.getFullYear();
    if (!inputs.opexBaseMonth) inputs.opexBaseMonth = commencementDate.getMonth() + 1;
  }
}

function extractInputsFromMarkdown(markdown: string): ExtractedInputs {
  const values = collectLabeledValues(markdown);
  const inputs: ExtractedInputs = {};

  (Object.keys(KEY_ALIASES) as InputKey[]).forEach((key) => {
    const found = findByAliases(values, KEY_ALIASES[key]);
    if (found) inputs[key] = found;
  });

  deriveInputsFromNarrative(markdown, inputs);

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

function toExcelSerial(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const epoch = Date.UTC(1899, 11, 30);
  return (utc - epoch) / 86400000;
}

function coerceValue(key: InputKey, raw: string | number | Date | null | undefined): string | number | null {
  if (raw == null || raw === '') return null;

  if (typeof raw === 'number') return raw;
  if (raw instanceof Date) return toExcelSerial(raw);

  const value = String(raw).trim();

  if (DATE_KEYS.includes(key)) {
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? value : toExcelSerial(dt);
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

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function serializeXml(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

function createNode(doc: Document, name: string): Element {
  return doc.createElementNS(SPREADSHEET_NS, name);
}

function getFirstSheetPath(workbookXml: string, relsXml: string): string {
  const workbookDoc = parseXml(workbookXml);
  const relsDoc = parseXml(relsXml);

  const sheet = workbookDoc.getElementsByTagName('sheet')[0];
  if (!sheet) throw new Error('Template workbook has no sheets');

  const relId = sheet.getAttribute('r:id') || sheet.getAttribute('id');
  if (!relId) throw new Error('Unable to resolve first sheet relationship id');

  const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));
  const rel = relationships.find((r) => r.getAttribute('Id') === relId);
  if (!rel) throw new Error('Unable to resolve worksheet target path');

  const target = rel.getAttribute('Target');
  if (!target) throw new Error('Worksheet target missing in relationship');

  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.?\//, '')}`;
}

function getOrCreateRow(doc: Document, rowNumber: number): Element {
  const rows = Array.from(doc.getElementsByTagName('row'));
  const existing = rows.find((row) => Number(row.getAttribute('r')) === rowNumber);
  if (existing) return existing;

  const sheetData = doc.getElementsByTagName('sheetData')[0];
  if (!sheetData) throw new Error('sheetData node missing in worksheet xml');

  const row = createNode(doc, 'row');
  row.setAttribute('r', String(rowNumber));
  sheetData.appendChild(row);
  return row;
}

function getOrCreateCell(doc: Document, row: Element, cellRef: string): Element {
  const cells = Array.from(row.getElementsByTagName('c'));
  const existing = cells.find((c) => c.getAttribute('r') === cellRef);
  if (existing) return existing;

  const cell = createNode(doc, 'c');
  cell.setAttribute('r', cellRef);
  row.appendChild(cell);
  return cell;
}

function clearCellValueNodes(cell: Element): void {
  const children = Array.from(cell.childNodes);
  children.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const name = (child as Element).localName;
    if (name === 'v' || name === 'is' || name === 'f') {
      cell.removeChild(child);
    }
  });
}

function setCellValue(doc: Document, cellRef: string, value: string | number): void {
  const rowMatch = cellRef.match(/([A-Z]+)(\d+)/i);
  if (!rowMatch) return;

  const rowNumber = Number(rowMatch[2]);
  const row = getOrCreateRow(doc, rowNumber);
  const cell = getOrCreateCell(doc, row, cellRef.toUpperCase());

  clearCellValueNodes(cell);

  if (typeof value === 'number') {
    cell.removeAttribute('t');
    const v = createNode(doc, 'v');
    v.textContent = String(value);
    cell.appendChild(v);
    return;
  }

  cell.setAttribute('t', 'inlineStr');
  const is = createNode(doc, 'is');
  const t = createNode(doc, 't');
  t.textContent = value;
  is.appendChild(t);
  cell.appendChild(is);
}

export async function exportCashflowToExcel(markdown: string, filename: string) {
  const inputs = extractInputsFromMarkdown(markdown);

  const templateResponse = await fetch('/templates/Cash_Flow_Analysis.xlsx');
  const templateBuffer = await templateResponse.arrayBuffer();

  const zip = await JSZip.loadAsync(templateBuffer);

  const workbookFile = zip.file('xl/workbook.xml');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbookFile || !relsFile) {
    throw new Error('Invalid template: workbook metadata missing');
  }

  const workbookXml = await workbookFile.async('text');
  const relsXml = await relsFile.async('text');
  const firstSheetPath = getFirstSheetPath(workbookXml, relsXml);

  const sheetFile = zip.file(firstSheetPath);
  if (!sheetFile) throw new Error(`Invalid template: worksheet not found (${firstSheetPath})`);

  const sheetXml = await sheetFile.async('text');
  const sheetDoc = parseXml(sheetXml);

  for (const [key, cellRef] of Object.entries(INPUT_CELLS) as [InputKey, string][]) {
    const coerced = coerceValue(key, inputs[key]);
    if (coerced == null) continue;
    setCellValue(sheetDoc, cellRef, coerced);
  }

  zip.file(firstSheetPath, serializeXml(sheetDoc));

  const updatedWorkbook = await zip.generateAsync({ type: 'arraybuffer' });
  const blob = new Blob([updatedWorkbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  saveAs(blob, `${filename.replace(/[^a-zA-Z0-9_\- ]/g, '')}.xlsx`);
}
