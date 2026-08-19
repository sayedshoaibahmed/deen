/**
 * Urdu audio resolver — Al Quran Cloud CDN (islamic.network)
 * Reciter: Shamshad Ali Khan (edition: ur.khan, bitrate: 64kbps)
 *
 * URL pattern: https://cdn.islamic.network/quran/audio/64/ur.khan/{globalAyahNumber}.mp3
 * where globalAyahNumber is the 1-indexed sequential ayah number across the whole Quran (1–6236).
 *
 * This pattern is fully deterministic from the known per-surah ayah counts.
 * No API call to api.alquran.cloud is needed. This eliminates all 504/timeout failures
 * that were caused by the upstream metadata API under concurrent load.
 *
 * IMPORTANT: Do NOT change this to go back through the API. The CDN URLs were verified
 * from a live API response and confirmed stable. The audio files themselves are served
 * from cdn.islamic.network (a separate CDN), which is not affected by API rate limits.
 */

import { SURAH_AYAH_COUNTS } from './quranenc';

const CDN_BASE = 'https://cdn.islamic.network/quran/audio/64/ur.khan';

/** Precomputed cumulative global-ayah-number offset for each surah (0-indexed by surahNumber-1). */
const SURAH_GLOBAL_OFFSET: number[] = (() => {
  const offsets: number[] = new Array(114);
  let total = 0;
  for (let i = 0; i < 114; i++) {
    offsets[i] = total;
    total += SURAH_AYAH_COUNTS[i];
  }
  return offsets;
})();

export interface AyahAudio {
  /** Ayah position within this surah (1-indexed) */
  ayah: number;
  /** Direct CDN audio URL */
  audioUrl: string;
}

/**
 * Returns the Urdu ayah audio queue for a given Surah entirely from local computation.
 * No network request is made. Returns synchronously.
 *
 * `ayah` here is the numberInSurah (1-indexed), matching the shape used by
 * englishQueue and arabicAyahQueue in AudioContext.
 */
export function getUrduSurahAudio(surahNumber: number): AyahAudio[] {
  if (surahNumber < 1 || surahNumber > 114) {
    throw { status: 400, message: 'Invalid Surah ID' };
  }

  const offset = SURAH_GLOBAL_OFFSET[surahNumber - 1];
  const count = SURAH_AYAH_COUNTS[surahNumber - 1];
  const ayahs: AyahAudio[] = [];

  for (let i = 1; i <= count; i++) {
    ayahs.push({
      ayah: i,
      audioUrl: `${CDN_BASE}/${offset + i}.mp3`,
    });
  }

  return ayahs;
}

/**
 * @deprecated The API-based fetcher is no longer needed.
 * Kept as a no-op export for any future reference; remove in a later cleanup.
 */
export { getUrduSurahAudio as urduAyahsToQueue };
