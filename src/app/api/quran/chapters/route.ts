import { NextResponse } from 'next/server';
import { fetchQuranChapters } from '@/lib/quran-foundation';

export async function GET() {
  try {
    const chapters = await fetchQuranChapters();
    return NextResponse.json(chapters);
  } catch (error: any) {
    // The fetchQuranChapters function already safely logs the error to the console without secrets
    return NextResponse.json(
      { error: 'Failed to fetch Quran chapters from the API.' },
      { status: 500 }
    );
  }
}
