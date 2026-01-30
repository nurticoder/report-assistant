import type { DocxTable } from '@/lib/docx';
import { ParsedCaseRow } from '@/lib/types';

function normalizeHeader(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function extractCaseRows(tables: DocxTable[], config: { section: string; headerMap: Record<string, string> }) {
  const results: ParsedCaseRow[] = [];

  tables.forEach((table, tableIndex) => {
    if (table.rows.length < 2) return;
    const headerRow = table.rows[0].map(normalizeHeader);
    const mappedHeaders = headerRow.map((header) => config.headerMap[header] || null);
    const matchedCount = mappedHeaders.filter(Boolean).length;
    if (matchedCount < 2) return;

    table.rows.slice(1).forEach((row, rowOffset) => {
      if (row.every((cell) => cell.trim().length === 0)) return;
      const normalized: Record<string, string> = {};
      row.forEach((cell, idx) => {
        const key = mappedHeaders[idx];
        if (key) {
          normalized[key] = cell.trim();
        }
      });
      results.push({
        section: config.section,
        normalized,
        rawCells: row,
        header: headerRow,
        source: { tableIndex, row: rowOffset + 1 }
      });
    });
  });

  return results;
}

