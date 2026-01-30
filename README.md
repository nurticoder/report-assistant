# Report Assistant

Deterministic Word (.docx) + Excel (.xlsx) ingestion that fails closed on ambiguity. No AI is used to compute or extract numbers.

## Features
- Two-file workflow: current month Word + previous month Excel
- Deterministic parsing (docx XML + strict regex dictionary)
- Fail-closed validations before generation
- Excel updates via ExcelJS with audit/history sheets
- Mapping editor for required metrics
- CLI validation + generation

## Setup

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

Open http://localhost:3000

## Run tests

```bash
npm test
```

## Generate fixtures (optional)

```bash
npm run generate-fixtures
```

## CLI

```bash
node scripts/validate-and-generate.mjs --word path/to/report.docx --excel path/to/previous.xlsx --month 2026-01
```

## Configuration
- `config/metricDictionary.json`: strict phrase/regex dictionary for summary metrics (Kyrgyz/Russian/English).
- `config/requiredMetrics.json`: required metrics list (analysis must find all).
- `config/metricCellMap.json`: mapping from metric -> sheet + cell.
- `config/metricRules.json`: numeric bounds and negative allowances.
- `config/crossChecks.json`: total/component consistency checks.
- `config/caseFieldMap.json`: case table header mapping.
- `config/caseRules.json`: case count + duplicate checks.
- `config/carryOverRules.json`: explicit carry-over rules used in update logic.

## Fail-closed behavior
- Missing required metrics or mappings blocks generation.
- Ambiguous month detection blocks generation unless you supply a manual override.
- Metrics must be numeric and within bounds.
- Cross-checks must pass.
- Duplicate case IDs block generation.
- Excel files with macros (.xlsm/vbaProject.bin) or pivot caches are blocked.

## Output sheets
- `SummaryMetrics`: month, metric_name, value, source_info_json
- `CaseFacts`: month, section, normalized_json, source_info_json
- `ImportsLog`: timestamp, month, word_hash, excel_hash, status
- `Audit`: metric_name, prev_value, new_value, delta, source_snippet, source_location, cell_written

## Troubleshooting
- Validation blocked due to mapping: open the Mapping Editor, fill sheet/cell, then re-analyze.
- Month unresolved: input a manual `YYYY-MM` override and re-analyze.
- Cross-check failed: verify total/component metrics in the Word report.
- Excel contains macros/pivots: export to a clean `.xlsx` without macros/pivots, then retry.

## Notes
- The system never guesses cell addresses or metric values.
- AI is only used for potential error explanations (not numeric extraction).

