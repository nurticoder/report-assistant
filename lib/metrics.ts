import { ParsedMetric, SourceInfo } from '@/lib/types';
import type { DocxParagraph, DocxTable } from '@/lib/docx';

export type MetricMatch = { name: string; value: number; source: SourceInfo };

function parseNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, '').replace(/,/g, '.');
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function extractMetrics(
  paragraphs: DocxParagraph[],
  tables: DocxTable[],
  dictionary: Record<string, { patterns: Array<{ regex: string }> }>
) {
  const metrics: ParsedMetric[] = [];
  const duplicates: string[] = [];

  for (const [name, def] of Object.entries(dictionary)) {
    const matches: MetricMatch[] = [];
    for (const paragraph of paragraphs) {
      for (const pattern of def.patterns) {
        const regex = new RegExp(pattern.regex, 'i');
        const match = paragraph.text.match(regex);
        if (match && match[1]) {
          const value = parseNumber(match[1]);
          if (value !== null) {
            matches.push({
              name,
              value,
              source: { type: 'paragraph', textSnippet: paragraph.text.slice(0, 160) }
            });
          }
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
              if (value !== null) {
                matches.push({
                  name,
                  value,
                  source: {
                    type: 'table',
                    tableIndex,
                    row: rowIndex,
                    col: colIndex,
                    textSnippet: cell.slice(0, 160)
                  }
                });
              }
            }
          }
        });
      });
    });

    if (matches.length > 1) {
      duplicates.push(name);
    }

    if (matches.length > 0) {
      const chosen = matches[0];
      metrics.push({ name, value: chosen.value, source: chosen.source });
    }
  }

  return { metrics, duplicates };
}

