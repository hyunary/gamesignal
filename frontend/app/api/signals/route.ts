import { NextResponse } from 'next/server';
import { getTodaySignals, getRecentSignals } from '@/app/lib/queries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'today';

  try {
    const signals = period === 'week'
      ? await getRecentSignals()
      : await getTodaySignals();
    return NextResponse.json({ signals });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
