import { NextResponse } from 'next/server';
import { getPipelineStatus } from '@/app/lib/queries';

export async function GET() {
  try {
    const runs = await getPipelineStatus();
    return NextResponse.json({ runs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
