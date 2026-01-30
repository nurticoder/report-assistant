import { parseDocx } from '@/lib/docx';
import { extractMetrics } from '@/lib/metrics';
import { extractCaseRows } from '@/lib/cases';
import { detectMonth } from '@/lib/month';
import { validateAnalysis } from '@/lib/validate';
import {
  getCarryOverRules,
  getCaseFieldMap,
  getCaseRules,
  getCrossChecks,
  getMetricCellMap,
  getMetricDictionary,
  getMetricRules,
  getRequiredMetrics
} from '@/lib/config';
import type { AnalyzeResponse } from '@/lib/types';

export async function analyzeReport(params: {
  wordBuffer: ArrayBuffer;
  wordFilename?: string;
  monthOverride?: string | null;
  mappingOverride?: Record<string, { sheet: string; cell: string }> | null;
}) {
  const { wordBuffer, wordFilename, monthOverride, mappingOverride } = params;

  const [dictionary, requiredMetrics, metricRules, crossChecks, caseFieldMap, caseRules, carryOverRules] = await Promise.all([
    getMetricDictionary(),
    getRequiredMetrics(),
    getMetricRules(),
    getCrossChecks(),
    getCaseFieldMap(),
    getCaseRules(),
    getCarryOverRules()
  ]);

  const metricCellMap = mappingOverride && Object.keys(mappingOverride).length > 0
    ? { ...(await getMetricCellMap()), ...mappingOverride }
    : await getMetricCellMap();

  const parsedDocx = await parseDocx(wordBuffer);
  const { metrics, duplicates } = extractMetrics(parsedDocx.paragraphs, parsedDocx.tables, dictionary);
  const cases = extractCaseRows(parsedDocx.tables, caseFieldMap);
  const monthInfo = detectMonth(parsedDocx.paragraphs, wordFilename);

  const { validations, resolvedMonth, canGenerate } = validateAnalysis({
    metrics,
    cases,
    requiredMetrics,
    metricCellMap,
    metricRules,
    crossChecks,
    caseRules,
    monthCandidates: monthInfo.candidates,
    monthOverride,
    duplicateMetrics: duplicates,
    carryOverRules
  });

  const response: AnalyzeResponse = {
    month: resolvedMonth,
    metrics,
    casesPreview: cases.slice(0, 50),
    validations
  };

  return { response, canGenerate, metricCellMap, requiredMetrics, cases };
}

