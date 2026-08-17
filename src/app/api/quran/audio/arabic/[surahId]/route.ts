import { NextResponse } from 'next/server';
import { getArabicChapterAudio } from '@/lib/quran-foundation';

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

    const audioData = await getArabicChapterAudio(surahNumber);
    // Return clean response: { surahNumber, audioUrl, reciter }
    return NextResponse.json(audioData);
  } catch (error: any) {
    // If our service layer threw a specific status error
    if (error && typeof error === 'object' && error.status) {
      return NextResponse.json(
        { error: error.message || 'Arabic audio unavailable', surah: error.surahNumber || parseInt((await params).surahId, 10) || null, status: error.status },
        { status: error.status === 404 ? 404 : 500 }
      );
    }
    
    // We do not leak secrets, just return a safe 500
    return NextResponse.json(
      { error: 'Failed to fetch Quran audio from the API.', status: 500 },
      { status: 500 }
    );
  }
}
