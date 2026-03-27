import { NextResponse } from 'next/server';
import { getTopGames } from '@/app/lib/queries';

export async function GET() {
  try {
    const games = await getTopGames();
    return NextResponse.json({ games });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
