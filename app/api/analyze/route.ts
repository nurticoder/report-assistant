import { NextResponse } from 'next/server';
import { analyzeReport } from '@/lib/analyze';
import { detectExcelRisks } from '@/lib/excel';

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

    const { response } = await analyzeReport({
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

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Analyze failed.' }, { status: 500 });
  }
}

