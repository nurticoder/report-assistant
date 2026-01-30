import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export type DocxParagraph = { text: string; index: number };
export type DocxTable = { rows: string[][] };

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractTextFromRuns(runs: any): string {
  const runArray = asArray(runs);
  const texts: string[] = [];
  for (const run of runArray) {
    const t = run?.['w:t'];
    if (typeof t === 'string') {
      texts.push(t);
    } else if (t && typeof t === 'object' && typeof t['#text'] === 'string') {
      texts.push(t['#text']);
    }
  }
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

function extractTextFromParagraph(p: any): string {
  const runs = p?.['w:r'];
  return extractTextFromRuns(runs);
}

function extractTextFromCell(cell: any): string {
  const paragraphs = asArray(cell?.['w:p']);
  const parts = paragraphs.map(extractTextFromParagraph).filter(Boolean);
  return parts.join(' | ').replace(/\s+/g, ' ').trim();
}

export async function parseDocx(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('DOCX missing word/document.xml');
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const doc = parser.parse(documentXml);
  const body = doc?.['w:document']?.['w:body'];
  if (!body) {
    throw new Error('DOCX missing w:body');
  }

  const elements = [...asArray(body['w:p']).map((p: any) => ({ type: 'p', node: p })), ...asArray(body['w:tbl']).map((t: any) => ({ type: 'tbl', node: t }))];

  const paragraphs: DocxParagraph[] = [];
  const tables: DocxTable[] = [];

  let paragraphIndex = 0;

  for (const element of elements) {
    if (element.type === 'p') {
      const text = extractTextFromParagraph(element.node);
      if (text) {
        paragraphs.push({ text, index: paragraphIndex++ });
      }
    } else if (element.type === 'tbl') {
      const rows: string[][] = [];
      const tr = asArray(element.node?.['w:tr']);
      for (const row of tr) {
        const cells = asArray(row?.['w:tc']);
        const rowText = cells.map(extractTextFromCell);
        if (rowText.some((value) => value.length > 0)) {
          rows.push(rowText);
        }
      }
      if (rows.length > 0) {
        tables.push({ rows });
      }
    }
  }

  return { paragraphs, tables };
}

