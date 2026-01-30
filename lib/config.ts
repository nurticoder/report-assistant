import { promises as fs } from 'fs';
import path from 'path';

const root = process.cwd();

async function readJson<T>(file: string): Promise<T> {
  const content = await fs.readFile(path.join(root, file), 'utf8');
  const cleaned = content.replace(/^\uFEFF/, '');
  return JSON.parse(cleaned) as T;
}

export async function getMetricCellMap() {
  return readJson<Record<string, { sheet: string; cell: string }>>('config/metricCellMap.json');
}

export async function getRequiredMetrics() {
  return readJson<string[]>('config/requiredMetrics.json');
}

export async function getMetricDictionary() {
  return readJson<Record<string, { patterns: Array<{ regex: string }> }>>('config/metricDictionary.json');
}

export async function getMetricRules() {
  return readJson<{ defaults: { min: number; max: number; allowNegative: boolean }; overrides: Record<string, { min?: number; max?: number; allowNegative?: boolean }> }>('config/metricRules.json');
}

export async function getCrossChecks() {
  return readJson<Array<{ total: string; components: string[]; reason: string }>>('config/crossChecks.json');
}

export async function getCaseFieldMap() {
  return readJson<{ section: string; headerMap: Record<string, string> }>('config/caseFieldMap.json');
}

export async function getCaseRules() {
  return readJson<{ caseCountMetric: string; caseIdField: string; duplicatePolicy: 'fail' | 'warn' }>('config/caseRules.json');
}

export async function getCarryOverRules() {
  return readJson<Array<{ sourceMetric: string; targetMetric: string; operation: 'add' | 'replace'; description: string }>>('config/carryOverRules.json');
}

export async function writeMetricCellMap(data: Record<string, { sheet: string; cell: string }>) {
  const file = path.join(root, 'config/metricCellMap.json');
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

