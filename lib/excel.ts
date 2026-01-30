import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { ParsedCaseRow, ParsedMetric } from '@/lib/types';
import { summarizeSource } from '@/lib/validate';

export async function detectExcelRisks(buffer: ArrayBuffer, filename?: string) {
  const errors: string[] = [];
  if (filename && filename.toLowerCase().endsWith('.xlsm')) {
    errors.push('Excel workbook is .xlsm with macros. ExcelJS cannot safely preserve macros.');
  }

  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files);
  if (entries.some((name) => name.toLowerCase().includes('vbaProject.bin'.toLowerCase()))) {
    errors.push('Excel workbook contains macros (vbaProject.bin).');
  }
  if (entries.some((name) => name.toLowerCase().includes('pivotcache') || name.toLowerCase().includes('pivottable'))) {
    errors.push('Excel workbook contains pivot caches/tables that ExcelJS may break.');
  }

  return errors;
}

function ensureSheet(workbook: ExcelJS.Workbook, name: string, headers: string[]) {
  let sheet = workbook.getWorksheet(name);
  if (!sheet) {
    sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
  }
  if (sheet.rowCount === 0) {
    sheet.addRow(headers);
  }
  return sheet;
}

export function applyCarryOverRules(
  metrics: ParsedMetric[],
  rules: Array<{ sourceMetric: string; targetMetric: string; operation: 'add' | 'replace'; description: string }>
) {
  const result = new Map(metrics.map((m) => [m.name, m.value]));
  const applied: Array<{ rule: string; targetMetric: string; previous: number; next: number }> = [];

  rules.forEach((rule) => {
    const source = result.get(rule.sourceMetric);
    const target = result.get(rule.targetMetric);
    if (source === undefined || target === undefined) return;
    const previous = target;
    const next = rule.operation === 'add' ? target + source : source;
    result.set(rule.targetMetric, next);
    applied.push({ rule: rule.description, targetMetric: rule.targetMetric, previous, next });
  });

  return { effectiveMetrics: result, applied };
}

export async function updateWorkbook(params: {
  buffer: ArrayBuffer;
  metrics: ParsedMetric[];
  cases: ParsedCaseRow[];
  mapping: Record<string, { sheet: string; cell: string }>;
  month: string;
  wordHash: string;
  excelHash: string;
  carryOverRules: Array<{ sourceMetric: string; targetMetric: string; operation: 'add' | 'replace'; description: string }>;
}) {
  const { buffer, metrics, cases, mapping, month, wordHash, excelHash, carryOverRules } = params;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));

  const { effectiveMetrics, applied } = applyCarryOverRules(metrics, carryOverRules);
  const metricMap = new Map(metrics.map((m) => [m.name, m]));

  const auditSheet = ensureSheet(workbook, 'Audit', [
    'metric_name',
    'prev_value',
    'new_value',
    'delta',
    'source_snippet',
    'source_location',
    'cell_written'
  ]);

  mapping && Object.entries(mapping).forEach(([metricName, location]) => {
    const metric = metricMap.get(metricName);
    if (!metric) return;
    const sheet = workbook.getWorksheet(location.sheet) || workbook.addWorksheet(location.sheet);
    const cell = sheet.getCell(location.cell);
    const prevValue = typeof cell.value === 'number' ? cell.value : null;
    const newValue = effectiveMetrics.get(metricName) ?? metric.value;
    cell.value = newValue;
    const delta = typeof prevValue === 'number' ? newValue - prevValue : null;
    const summary = summarizeSource(metric);
    auditSheet.addRow([
      metricName,
      prevValue,
      newValue,
      delta,
      summary.snippet,
      summary.location,
      `${location.sheet}!${location.cell}`
    ]);
  });

  if (applied.length > 0) {
    applied.forEach((item) => {
      auditSheet.addRow([
        `${item.targetMetric} (carry-over)`,
        item.previous,
        item.next,
        item.next - item.previous,
        item.rule,
        'Carry-over rule',
        'n/a'
      ]);
    });
  }

  const summarySheet = ensureSheet(workbook, 'SummaryMetrics', [
    'month',
    'metric_name',
    'value',
    'source_info_json'
  ]);
  metrics.forEach((metric) => {
    summarySheet.addRow([
      month,
      metric.name,
      metric.value,
      JSON.stringify(metric.source)
    ]);
  });

  const caseSheet = ensureSheet(workbook, 'CaseFacts', [
    'month',
    'section',
    'normalized_json',
    'source_info_json'
  ]);
  cases.forEach((row) => {
    caseSheet.addRow([
      month,
      row.section,
      JSON.stringify(row.normalized),
      JSON.stringify(row.source)
    ]);
  });

  const logSheet = ensureSheet(workbook, 'ImportsLog', [
    'timestamp',
    'month',
    'word_hash',
    'excel_hash',
    'status'
  ]);
  logSheet.addRow([new Date().toISOString(), month, wordHash, excelHash, 'generated']);

  const output = await workbook.xlsx.writeBuffer();
  return output;
}

