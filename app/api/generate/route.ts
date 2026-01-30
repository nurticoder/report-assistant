import { NextResponse } from 'next/server';
import { analyzeReport } from '@/lib/analyze';
import { detectExcelRisks, updateWorkbook } from '@/lib/excel';
import { sha256 } from '@/lib/hash';
import { getCarryOverRules } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const wordFile = formData.get('word') as File | null;
    const excelFile = formData.get('excel') as File | null;
    const monthOverride = formData.get('monthOverride') as string | null;
    const mappingOverrideRaw = formData.get('mappingOverride') as string | null;

    if (!wordFile || !excelFile) {
      return NextResponse.json({ error: 'Missing Word or Excel file.' }, { status: 400 });
    }

    const [wordBuffer, excelBuffer] = await Promise.all([
      wordFile.arrayBuffer(),
      excelFile.arrayBuffer()
    ]);

    const mappingOverride = mappingOverrideRaw ? JSON.parse(mappingOverrideRaw) : null;
    const excelRisks = await detectExcelRisks(excelBuffer, excelFile.name);

    const { response, canGenerate, metricCellMap, cases } = await analyzeReport({
      wordBuffer,
      wordFilename: wordFile.name,
      monthOverride,
      mappingOverride
    });

    if (excelRisks.length > 0) {
      response.validations.push({
        id: 'excel-risk',
        status: 'fail',
        message: 'Excel file contains unsupported features. Generation blocked.',
        details: excelRisks.join(' ')
      });
    }

    if (!canGenerate || response.validations.some((v) => v.status === 'fail')) {
      return NextResponse.json({ error: 'Validation failed.', validations: response.validations }, { status: 400 });
    }

    if (!response.month) {
      return NextResponse.json({ error: 'Month missing.', validations: response.validations }, { status: 400 });
    }

    const wordHash = sha256(wordBuffer);
    const excelHash = sha256(excelBuffer);
    const carryOverRules = await getCarryOverRules();

    const output = await updateWorkbook({
      buffer: excelBuffer,
      metrics: response.metrics,
      cases,
      mapping: metricCellMap,
      month: response.month,
      wordHash,
      excelHash,
      carryOverRules
    });

    return new NextResponse(Buffer.from(output), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="updated-${response.month}.xlsx"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Generate failed.' }, { status: 500 });
  }
}

