import { NextResponse } from 'next/server';
import { getMetricCellMap, getRequiredMetrics } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET() {
  const [mapping, requiredMetrics] = await Promise.all([getMetricCellMap(), getRequiredMetrics()]);
  return NextResponse.json({ mapping, requiredMetrics });
}

