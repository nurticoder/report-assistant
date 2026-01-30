import { NextResponse } from 'next/server';
import { getMetricCellMap, writeMetricCellMap } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET() {
  const mapping = await getMetricCellMap();
  return NextResponse.json(mapping);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid mapping payload.' }, { status: 400 });
    }
    await writeMetricCellMap(data);
    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to save mapping.' }, { status: 500 });
  }
}

