import { NextResponse } from 'next/server';
import { getEnglishSurahAudio } from '@/lib/quranenc';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ surahId: string }> }
) {
  try {
    const { surahId } = await params;
    const surahNumber = parseInt(surahId, 10);
    
    // Server-side validation
    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return NextResponse.json({ error: 'Invalid Surah ID', surah: surahNumber, status: 400 }, { status: 400 });
    }

    const ayahs = getEnglishSurahAudio(surahNumber);
    
    return NextResponse.json({
      surahNumber,
      ayahs
    });
  } catch (error: any) {
    if (error && typeof error === 'object' && error.status) {
      return NextResponse.json(
        { error: error.message || 'English audio unavailable', surah: error.surahNumber || parseInt((await params).surahId, 10) || null, status: error.status },
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch English audio sources.', status: 500 },
      { status: 500 }
    );
  }
}
