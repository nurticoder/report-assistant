import { ParsedCaseRow, ParsedMetric, ValidationResult } from '@/lib/types';

function isValidMonth(value: string) {
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
}

function formatLocation(source: { type?: string; tableIndex?: number; row?: number; col?: number }) {
  if (!source?.type) return undefined;
  if (source.type === 'paragraph') return 'Paragraph';
  if (source.type === 'table') {
    return `Table ${source.tableIndex ?? 0} Row ${source.row ?? 0} Col ${source.col ?? 0}`;
  }
  return undefined;
}

export function validateAnalysis(params: {
  metrics: ParsedMetric[];
  cases: ParsedCaseRow[];
  requiredMetrics: string[];
  metricCellMap: Record<string, { sheet: string; cell: string }>;
  metricRules: { defaults: { min: number; max: number; allowNegative: boolean }; overrides: Record<string, { min?: number; max?: number; allowNegative?: boolean }> };
  crossChecks: Array<{ total: string; components: string[]; reason: string }>;
  caseRules: { caseCountMetric: string; caseIdField: string; duplicatePolicy: 'fail' | 'warn' };
  monthCandidates: string[];
  monthOverride?: string | null;
  duplicateMetrics?: string[];
  carryOverRules: Array<{ sourceMetric: string; targetMetric: string; operation: 'add' | 'replace'; description: string }>;
}): { validations: ValidationResult[]; resolvedMonth: string | null; canGenerate: boolean } {
  const {
    metrics,
    cases,
    requiredMetrics,
    metricCellMap,
    metricRules,
    crossChecks,
    caseRules,
    monthCandidates,
    monthOverride,
    duplicateMetrics = [],
    carryOverRules
  } = params;

  const validations: ValidationResult[] = [];
  const metricMap = new Map(metrics.map((m) => [m.name, m]));

  const overrideProvided = typeof monthOverride === 'string' && monthOverride.trim().length > 0;
  const overrideValid = overrideProvided ? isValidMonth(monthOverride.trim()) : false;
  const resolvedMonth = overrideValid ? monthOverride!.trim() : monthCandidates.length === 1 ? monthCandidates[0] : null;

  if (overrideProvided && !overrideValid) {
    validations.push({
      id: 'month-override',
      status: 'fail',
      message: 'Month override is invalid. Use YYYY-MM format.'
    });
  }

  if (!resolvedMonth) {
    validations.push({
      id: 'month-detection',
      status: 'fail',
      message: 'Month could not be resolved. Provide a manual override (YYYY-MM).',
      details: monthCandidates.length > 1 ? `Multiple candidates detected: ${monthCandidates.join(', ')}` : 'No month found in report.'
    });
  } else {
    validations.push({
      id: 'month-detection',
      status: 'pass',
      message: `Month resolved as ${resolvedMonth}.`
    });
  }

  for (const name of requiredMetrics) {
    if (!metricMap.has(name)) {
      validations.push({
        id: `metric-required-${name}`,
        status: 'fail',
        message: `Required metric missing: ${name}`
      });
    } else {
      validations.push({
        id: `metric-required-${name}`,
        status: 'pass',
        message: `Required metric found: ${name}`
      });
    }
  }

  for (const name of requiredMetrics) {
    const mapping = metricCellMap[name];
    const validCell = mapping && /^[A-Z]+[1-9][0-9]*$/.test(mapping.cell) && mapping.sheet.trim().length > 0;
    if (!validCell) {
      validations.push({
        id: `mapping-${name}`,
        status: 'fail',
        message: `Missing or invalid Excel cell mapping for ${name}.`
      });
    } else {
      validations.push({
        id: `mapping-${name}`,
        status: 'pass',
        message: `Mapped ${name} to ${mapping.sheet}!${mapping.cell}.`
      });
    }
  }

  metrics.forEach((metric) => {
    const override = metricRules.overrides[metric.name] || {};
    const min = override.min ?? metricRules.defaults.min;
    const max = override.max ?? metricRules.defaults.max;
    const allowNegative = override.allowNegative ?? metricRules.defaults.allowNegative;
    const numeric = Number.isFinite(metric.value);
    if (!numeric) {
      validations.push({
        id: `numeric-${metric.name}`,
        status: 'fail',
        message: `Metric ${metric.name} is not numeric.`,
        location: formatLocation(metric.source)
      });
      return;
    }
    if (!allowNegative && metric.value < 0) {
      validations.push({
        id: `bounds-${metric.name}`,
        status: 'fail',
        message: `Metric ${metric.name} is negative (${metric.value}).`,
        location: formatLocation(metric.source)
      });
      return;
    }
    if (metric.value < min || metric.value > max) {
      validations.push({
        id: `bounds-${metric.name}`,
        status: 'fail',
        message: `Metric ${metric.name} is outside bounds (${min}-${max}).`,
        location: formatLocation(metric.source)
      });
      return;
    }
    validations.push({
      id: `bounds-${metric.name}`,
      status: 'pass',
      message: `Metric ${metric.name} is within expected bounds.`
    });
  });

  crossChecks.forEach((check, index) => {
    const total = metricMap.get(check.total);
    const components = check.components.map((name) => metricMap.get(name));
    if (!total || components.some((c) => !c)) {
      validations.push({
        id: `cross-check-${index}`,
        status: 'fail',
        message: `Cross-check skipped: missing metric for ${check.reason}.`
      });
      return;
    }
    const sum = components.reduce((acc, metric) => acc + (metric?.value ?? 0), 0);
    if (sum !== total.value) {
      validations.push({
        id: `cross-check-${index}`,
        status: 'fail',
        message: `Cross-check failed: ${check.reason}. Expected ${total.value}, got ${sum}.`
      });
    } else {
      validations.push({
        id: `cross-check-${index}`,
        status: 'pass',
        message: `Cross-check passed: ${check.reason}.`
      });
    }
  });

  if (caseRules.caseCountMetric) {
    const countMetric = metricMap.get(caseRules.caseCountMetric);
    if (!countMetric) {
      validations.push({
        id: 'case-count-metric',
        status: 'fail',
        message: `Case count metric missing: ${caseRules.caseCountMetric}`
      });
    } else if (cases.length !== countMetric.value) {
      validations.push({
        id: 'case-count-metric',
        status: 'fail',
        message: `Case row count (${cases.length}) does not match ${caseRules.caseCountMetric} (${countMetric.value}).`
      });
    } else {
      validations.push({
        id: 'case-count-metric',
        status: 'pass',
        message: 'Case row count matches metric.'
      });
    }
  }

  const seen = new Set<string>();
  let duplicateId: string | null = null;
  let duplicateRow: ParsedCaseRow | null = null;
  for (const row of cases) {
    const id = row.normalized[caseRules.caseIdField];
    if (!id) continue;
    if (seen.has(id)) {
      duplicateId = id;
      duplicateRow = row;
      break;
    }
    seen.add(id);
  }

  if (duplicateId) {
    validations.push({
      id: 'case-duplicates',
      status: 'fail',
      message: `Duplicate case ID detected: ${duplicateId}.`,
      location: `Table ${duplicateRow?.source.tableIndex ?? 0} Row ${duplicateRow?.source.row ?? 0}`
    });
  } else {
    validations.push({
      id: 'case-duplicates',
      status: 'pass',
      message: 'No duplicate case IDs detected.'
    });
  }

  if (duplicateMetrics.length > 0) {
    validations.push({
      id: 'metric-duplicates',
      status: 'fail',
      message: `Duplicate metric mentions found: ${duplicateMetrics.join(', ')}`
    });
  } else {
    validations.push({
      id: 'metric-duplicates',
      status: 'pass',
      message: 'No duplicate metric mentions detected.'
    });
  }

  carryOverRules.forEach((rule, index) => {
    const source = metricMap.get(rule.sourceMetric);
    const target = metricMap.get(rule.targetMetric);
    if (!source || !target) {
      validations.push({
        id: `carry-over-${index}`,
        status: 'fail',
        message: `Carry-over rule not satisfied: missing ${!source ? rule.sourceMetric : rule.targetMetric}.`,
        details: rule.description
      });
    } else {
      validations.push({
        id: `carry-over-${index}`,
        status: 'pass',
        message: `Carry-over rule ready: ${rule.description}`
      });
    }
  });

  const canGenerate = validations.every((v) => v.status === 'pass');
  return { validations, resolvedMonth, canGenerate };
}

export function summarizeSource(metric: ParsedMetric) {
  return {
    snippet: metric.source.textSnippet,
    location: formatLocation(metric.source)
  };
}

