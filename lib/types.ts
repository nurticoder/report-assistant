export type SourceInfo = {
  type: 'paragraph' | 'table';
  tableIndex?: number;
  row?: number;
  col?: number;
  textSnippet: string;
};

export type ParsedMetric = {
  name: string;
  value: number;
  source: SourceInfo;
};

export type ParsedCaseRow = {
  section: string;
  normalized: Record<string, string>;
  rawCells: string[];
  header: string[];
  source: { tableIndex: number; row: number };
};

export type ValidationStatus = 'pass' | 'fail';

export type ValidationResult = {
  id: string;
  status: ValidationStatus;
  message: string;
  location?: string;
  details?: string;
};

export type AnalyzeResponse = {
  month: string | null;
  metrics: ParsedMetric[];
  casesPreview: ParsedCaseRow[];
  validations: ValidationResult[];
};

