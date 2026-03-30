import { NextResponse } from 'next/server';
import { getNewsByDate, getNewsDateList } from '@/app/lib/queries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || undefined;
  const listOnly = searchParams.get('list') === 'true';

  try {
    if (listOnly) {
      const dates = await getNewsDateList();
      return NextResponse.json({ dates });
    }
    const data = await getNewsByDate(date);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
