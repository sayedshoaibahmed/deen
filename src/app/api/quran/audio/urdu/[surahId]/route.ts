import { NextResponse } from 'next/server';
import { getUrduSurahAudio } from '@/lib/urdu';

/**
 * GET /api/quran/audio/urdu/[surahId]
 *
 * Returns the Urdu (Shamshad Ali Khan) ayah audio queue for a Surah.
 * Audio URLs are generated locally — no upstream API call is made.
 * This route is kept for API surface consistency and potential future use,
 * but the primary consumer (AudioContext) now calls getUrduSurahAudio() directly.
 *
 * Response shape:
 *   { surahNumber: number, ayahs: { ayah: number, audioUrl: string }[] }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surahId: string }> },
) {
  try {
    const { surahId } = await params;
    const surahNumber = parseInt(surahId, 10);

    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return NextResponse.json(
        { error: 'Invalid Surah ID', status: 400 },
        { status: 400 },
      );
    }

    const ayahs = getUrduSurahAudio(surahNumber);
    return NextResponse.json({ surahNumber, ayahs });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error('[urdu audio route]', error);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to generate Urdu audio sources.', status: err?.status ?? 500 },
      { status: err?.status ?? 500 },
    );
  }
}
