import { NextResponse } from 'next/server';
import { SURAH_AYAH_COUNTS } from '@/lib/quranenc';

/**
 * Translation text for a single Ayah.
 */
export interface AyahTranslation {
  ayah: number;
  text: string;
}

/**
 * In-memory cache: surahNumber → AyahTranslation[].
 * Lives for the lifetime of the server process (resets on cold start / rebuild).
 */
const translationCache = new Map<number, AyahTranslation[]>();

/**
 * GET /api/quran/translation/[surahId]
 *
 * Returns the full Ayah-level translation for the requested Surah.
 * Source: QuranEnc "english_rwwad" (Rowwad Translation Center) — the same
 * translation used for the English audio tracks on this site.
 *
 * Response shape:
 *   { surahNumber: number, ayahs: AyahTranslation[] }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ surahId: string }> }
) {
  const { surahId } = await params;
  const surahNumber = parseInt(surahId, 10);

  if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return NextResponse.json(
      { error: 'Invalid Surah ID' },
      { status: 400 }
    );
  }

  // Serve from cache if available
  if (translationCache.has(surahNumber)) {
    return NextResponse.json({
      surahNumber,
      ayahs: translationCache.get(surahNumber),
    });
  }

  try {
    const url = `https://quranenc.com/api/v1/translation/sura/english_rwwad/${surahNumber}`;
    const res = await fetch(url, {
      // Revalidate every 24 h at the CDN/Next.js cache layer, but we also
      // maintain our own in-memory cache for the process lifetime.
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.error(`QuranEnc translation API error: ${res.status} for surah ${surahNumber}`);
      return NextResponse.json(
        { error: 'Translation service temporarily unavailable' },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (!Array.isArray(data?.result)) {
      console.error(`Unexpected response shape from QuranEnc for surah ${surahNumber}`);
      return NextResponse.json(
        { error: 'Unexpected response from translation service' },
        { status: 502 }
      );
    }

    // Validate Ayah count matches what we expect
    const expectedCount = SURAH_AYAH_COUNTS[surahNumber - 1];
    if (data.result.length !== expectedCount) {
      console.warn(
        `QuranEnc returned ${data.result.length} ayahs for surah ${surahNumber}; expected ${expectedCount}`
      );
    }

    const ayahs: AyahTranslation[] = data.result.map((item: { aya: string; translation: string }) => ({
      ayah: parseInt(item.aya, 10),
      text: item.translation,
    }));

    // Store in process-level cache
    translationCache.set(surahNumber, ayahs);

    return NextResponse.json({ surahNumber, ayahs });
  } catch (err) {
    console.error('Translation fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch translation' },
      { status: 500 }
    );
  }
}
