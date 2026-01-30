import fs from 'fs/promises';
import path from 'path';
import ExcelJS from 'exceljs';
import { describe, it, expect } from 'vitest';
import { updateWorkbook } from '../lib/excel';

async function ensureXlsxFixture() {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  await fs.mkdir(fixturesDir, { recursive: true });
  const xlsxPath = path.join(fixturesDir, 'sample.xlsx');
  try {
    await fs.access(xlsxPath);
    return xlsxPath;
  } catch {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template');
    sheet.getCell('B2').value = 0;
    sheet.getCell('B3').value = 0;
    sheet.getCell('B4').value = 0;
    sheet.getCell('B5').value = 0;
    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    await fs.writeFile(xlsxPath, Buffer.from(xlsxBuffer));
    return xlsxPath;
  }
}

describe('Workbook update', () => {
  it('writes mapped metric cells', async () => {
    const xlsxPath = await ensureXlsxFixture();
    const buffer = await fs.readFile(xlsxPath);

    const output = await updateWorkbook({
      buffer,
      metrics: [
        { name: 'Total Cases', value: 3, source: { type: 'paragraph', textSnippet: 'Total cases: 3' } },
        { name: 'In Production', value: 1, source: { type: 'paragraph', textSnippet: 'In production: 1' } },
        { name: 'Closed Cases', value: 2, source: { type: 'paragraph', textSnippet: 'Closed cases: 2' } },
        { name: 'New Cases', value: 3, source: { type: 'paragraph', textSnippet: 'New cases: 3' } },
        { name: 'Previous Month Leftover', value: 0, source: { type: 'paragraph', textSnippet: 'Previous month leftover: 0' } }
      ],
      cases: [],
      mapping: {
        'Total Cases': { sheet: 'Template', cell: 'B2' },
        'In Production': { sheet: 'Template', cell: 'B3' },
        'Closed Cases': { sheet: 'Template', cell: 'B4' },
        'New Cases': { sheet: 'Template', cell: 'B5' }
      },
      month: '2026-01',
      wordHash: 'wordhash',
      excelHash: 'excelhash',
      carryOverRules: [
        { sourceMetric: 'Previous Month Leftover', targetMetric: 'In Production', operation: 'add', description: 'Carry over previous month leftover into In Production.' }
      ]
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(output));
    const sheet = workbook.getWorksheet('Template');
    expect(sheet?.getCell('B2').value).toBe(3);
    expect(sheet?.getCell('B3').value).toBe(1);
    expect(sheet?.getCell('B4').value).toBe(2);
    expect(sheet?.getCell('B5').value).toBe(3);
  });
});

