import fs from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';
import crypto from 'crypto';

const args = process.argv.slice(2);
const getArg = (key) => {
  const idx = args.indexOf(key);
  return idx === -1 ? null : args[idx + 1];
};

const wordPath = getArg('--word');
const excelPath = getArg('--excel');
const monthOverride = getArg('--month');

if (!wordPath || !excelPath) {
  console.error('Usage: node scripts/validate-and-generate.mjs --word <file.docx> --excel <file.xlsx> --month <YYYY-MM>');
  process.exit(1);
}

const root = process.cwd();
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));

const [dictionary, requiredMetrics, metricRules, crossChecks, caseFieldMap, caseRules, mapping, carryOverRules] = await Promise.all([
  readJson('config/metricDictionary.json'),
  readJson('config/requiredMetrics.json'),
  readJson('config/metricRules.json'),
  readJson('config/crossChecks.json'),
  readJson('config/caseFieldMap.json'),
  readJson('config/caseRules.json'),
  readJson('config/metricCellMap.json'),
  readJson('config/carryOverRules.json')
]);

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const extractTextFromRuns = (runs) => {
  const runArray = asArray(runs);
  const texts = [];
  for (const run of runArray) {
    const t = run?.['w:t'];
    if (typeof t === 'string') texts.push(t);
    else if (t && typeof t === 'object' && typeof t['#text'] === 'string') texts.push(t['#text']);
  }
  return texts.join(' ').replace(/\s+/g, ' ').trim();
};
const extractTextFromParagraph = (p) => extractTextFromRuns(p?.['w:r']);
const extractTextFromCell = (cell) => asArray(cell?.['w:p']).map(extractTextFromParagraph).filter(Boolean).join(' | ').replace(/\s+/g, ' ').trim();

async function parseDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('DOCX missing word/document.xml');
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const doc = parser.parse(documentXml);
  const body = doc?.['w:document']?.['w:body'];
  if (!body) throw new Error('DOCX missing w:body');

  const paragraphs = [];
  asArray(body['w:p']).forEach((p, index) => {
    const text = extractTextFromParagraph(p);
    if (text) paragraphs.push({ text, index });
  });
  const tables = [];
  asArray(body['w:tbl']).forEach((tbl) => {
    const rows = [];
    asArray(tbl?.['w:tr']).forEach((row) => {
      const cells = asArray(row?.['w:tc']);
      const rowText = cells.map(extractTextFromCell);
      if (rowText.some((value) => value.length > 0)) rows.push(rowText);
    });
    if (rows.length > 0) tables.push({ rows });
  });
  return { paragraphs, tables };
}

function parseNumber(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, '').replace(/,/g, '.');
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function extractMetrics(paragraphs, tables) {
  const metrics = [];
  const duplicates = [];
  for (const [name, def] of Object.entries(dictionary)) {
    const matches = [];
    for (const paragraph of paragraphs) {
      for (const pattern of def.patterns) {
        const regex = new RegExp(pattern.regex, 'i');
        const match = paragraph.text.match(regex);
        if (match && match[1]) {
          const value = parseNumber(match[1]);
          if (value !== null) matches.push({ name, value, source: { type: 'paragraph', textSnippet: paragraph.text.slice(0, 160) } });
        }
      }
    }
    tables.forEach((table, tableIndex) => {
      table.rows.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          for (const pattern of def.patterns) {
            const regex = new RegExp(pattern.regex, 'i');
            const match = cell.match(regex);
            if (match && match[1]) {
              const value = parseNumber(match[1]);
              if (value !== null) matches.push({ name, value, source: { type: 'table', tableIndex, row: rowIndex, col: colIndex, textSnippet: cell.slice(0, 160) } });
            }
          }
        });
      });
    });
    if (matches.length > 1) duplicates.push(name);
    if (matches.length > 0) metrics.push(matches[0]);
  }
  return { metrics, duplicates };
}

function extractCaseRows(tables) {
  const results = [];
  tables.forEach((table, tableIndex) => {
    if (table.rows.length < 2) return;
    const headerRow = table.rows[0].map((text) => text.replace(/\s+/g, ' ').trim());
    const mappedHeaders = headerRow.map((header) => caseFieldMap.headerMap[header] || null);
    const matchedCount = mappedHeaders.filter(Boolean).length;
    if (matchedCount < 2) return;
    table.rows.slice(1).forEach((row, rowOffset) => {
      if (row.every((cell) => cell.trim().length === 0)) return;
      const normalized = {};
      row.forEach((cell, idx) => {
        const key = mappedHeaders[idx];
        if (key) normalized[key] = cell.trim();
      });
      results.push({ section: caseFieldMap.section, normalized, rawCells: row, header: headerRow, source: { tableIndex, row: rowOffset + 1 } });
    });
  });
  return results;
}

function detectMonth(paragraphs) {
  const candidates = new Set();
  const regex = /(20\d{2})[-/.](0[1-9]|1[0-2])/g;
  const scan = (text) => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      candidates.add(`${match[1]}-${match[2]}`);
    }
  };
  paragraphs.forEach((p) => scan(p.text));
  const list = Array.from(candidates);
  if (list.length === 1) return { month: list[0], candidates: list };
  return { month: null, candidates: list };
}

function validate({ metrics, cases, monthCandidates, monthOverride, duplicates }) {
  const validations = [];
  const metricMap = new Map(metrics.map((m) => [m.name, m]));
  const resolvedMonth = monthOverride || (monthCandidates.length === 1 ? monthCandidates[0] : null);
  if (!resolvedMonth) validations.push('Month could not be resolved.');

  requiredMetrics.forEach((name) => {
    if (!metricMap.has(name)) validations.push(`Missing metric: ${name}`);
    const mappingEntry = mapping[name];
    if (!mappingEntry || !/^[A-Z]+[1-9][0-9]*$/.test(mappingEntry.cell || '') || !(mappingEntry.sheet || '').trim()) {
      validations.push(`Missing mapping for ${name}`);
    }
  });

  metrics.forEach((metric) => {
    const override = metricRules.overrides[metric.name] || {};
    const min = override.min ?? metricRules.defaults.min;
    const max = override.max ?? metricRules.defaults.max;
    const allowNegative = override.allowNegative ?? metricRules.defaults.allowNegative;
    if (!Number.isFinite(metric.value)) validations.push(`Metric not numeric: ${metric.name}`);
    if (!allowNegative && metric.value < 0) validations.push(`Metric negative: ${metric.name}`);
    if (metric.value < min || metric.value > max) validations.push(`Metric out of bounds: ${metric.name}`);
  });

  crossChecks.forEach((check) => {
    const total = metricMap.get(check.total);
    const components = check.components.map((name) => metricMap.get(name));
    if (!total || components.some((c) => !c)) {
      validations.push(`Cross-check missing metrics: ${check.reason}`);
      return;
    }
    const sum = components.reduce((acc, metric) => acc + (metric?.value ?? 0), 0);
    if (sum !== total.value) validations.push(`Cross-check failed: ${check.reason}`);
  });

  if (caseRules.caseCountMetric) {
    const countMetric = metricMap.get(caseRules.caseCountMetric);
    if (!countMetric) validations.push(`Case count metric missing: ${caseRules.caseCountMetric}`);
    else if (cases.length !== countMetric.value) validations.push(`Case count mismatch: ${cases.length} vs ${countMetric.value}`);
  }

  const seen = new Set();
  for (const row of cases) {
    const id = row.normalized[caseRules.caseIdField];
    if (!id) continue;
    if (seen.has(id)) {
      validations.push(`Duplicate case ID: ${id}`);
      break;
    }
    seen.add(id);
  }

  if (duplicates.length > 0) validations.push(`Duplicate metrics: ${duplicates.join(', ')}`);

  carryOverRules.forEach((rule) => {
    if (!metricMap.get(rule.sourceMetric) || !metricMap.get(rule.targetMetric)) {
      validations.push(`Carry-over rule missing: ${rule.description}`);
    }
  });

  return { validations, resolvedMonth };
}

function applyCarryOverRules(metrics) {
  const result = new Map(metrics.map((m) => [m.name, m.value]));
  carryOverRules.forEach((rule) => {
    const source = result.get(rule.sourceMetric);
    const target = result.get(rule.targetMetric);
    if (source === undefined || target === undefined) return;
    const next = rule.operation === 'add' ? target + source : source;
    result.set(rule.targetMetric, next);
  });
  return result;
}

const wordBuffer = await fs.readFile(wordPath);
const excelBuffer = await fs.readFile(excelPath);

const wordHash = crypto.createHash('sha256').update(wordBuffer).digest('hex');
const excelHash = crypto.createHash('sha256').update(excelBuffer).digest('hex');

const parsedDocx = await parseDocx(wordBuffer);
const { metrics, duplicates } = extractMetrics(parsedDocx.paragraphs, parsedDocx.tables);
const cases = extractCaseRows(parsedDocx.tables);
const monthInfo = detectMonth(parsedDocx.paragraphs);
const { validations, resolvedMonth } = validate({
  metrics,
  cases,
  monthCandidates: monthInfo.candidates,
  monthOverride,
  duplicates
});

if (validations.length > 0) {
  console.error('Validation failed:');
  validations.forEach((v) => console.error(`- ${v}`));
  process.exit(1);
}

if (!resolvedMonth) {
  console.error('Month could not be resolved.');
  process.exit(1);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(excelBuffer);

const ensureSheet = (name, headers) => {
  let sheet = workbook.getWorksheet(name);
  if (!sheet) {
    sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
  }
  if (sheet.rowCount === 0) sheet.addRow(headers);
  return sheet;
};

const effective = applyCarryOverRules(metrics);
const metricMap = new Map(metrics.map((m) => [m.name, m]));
const auditSheet = ensureSheet('Audit', ['metric_name', 'prev_value', 'new_value', 'delta', 'source_snippet', 'source_location', 'cell_written']);

Object.entries(mapping).forEach(([name, location]) => {
  const metric = metricMap.get(name);
  if (!metric) return;
  const sheet = workbook.getWorksheet(location.sheet) || workbook.addWorksheet(location.sheet);
  const cell = sheet.getCell(location.cell);
  const prevValue = typeof cell.value === 'number' ? cell.value : null;
  const newValue = effective.get(name) ?? metric.value;
  cell.value = newValue;
  const delta = typeof prevValue === 'number' ? newValue - prevValue : null;
  auditSheet.addRow([name, prevValue, newValue, delta, metric.source.textSnippet, metric.source.type, `${location.sheet}!${location.cell}`]);
});

const summarySheet = ensureSheet('SummaryMetrics', ['month', 'metric_name', 'value', 'source_info_json']);
metrics.forEach((metric) => summarySheet.addRow([resolvedMonth, metric.name, metric.value, JSON.stringify(metric.source)]));

const caseSheet = ensureSheet('CaseFacts', ['month', 'section', 'normalized_json', 'source_info_json']);
cases.forEach((row) => caseSheet.addRow([resolvedMonth, row.section, JSON.stringify(row.normalized), JSON.stringify(row.source)]));

const logSheet = ensureSheet('ImportsLog', ['timestamp', 'month', 'word_hash', 'excel_hash', 'status']);
logSheet.addRow([new Date().toISOString(), resolvedMonth, wordHash, excelHash, 'generated']);

const outBuffer = await workbook.xlsx.writeBuffer();
const outPath = path.join(root, `updated-${resolvedMonth}.xlsx`);
await fs.writeFile(outPath, Buffer.from(outBuffer));

console.log(`Generated ${outPath}`);

