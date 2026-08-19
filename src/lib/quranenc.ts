/**
 * Total number of ayahs for each of the 114 Surahs.
 * Essential for generating the ordered Ayah audio queue.
 */
export const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
  89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
  12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
  30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];

export interface AyahAudio {
  ayah: number;
  audioUrl: string;
}

/**
 * Returns the ordered Ayah audio sources for a requested Surah.
 * Uses QuranEnc's official english_rwwad audio structure.
 * URL structure: https://d.quranenc.com/data/audio/english_rwwad/{sura_3digits}{aya_3digits}.mp3
 */
export function getEnglishSurahAudio(surahNumber: number): AyahAudio[] {
  if (surahNumber < 1 || surahNumber > 114) {
    throw { status: 400, message: 'Invalid Surah ID' };
  }

  const count = SURAH_AYAH_COUNTS[surahNumber - 1];
  const s = String(surahNumber).padStart(3, '0');
  
  const ayahs: AyahAudio[] = [];
  for (let i = 1; i <= count; i++) {
    const a = String(i).padStart(3, '0');
    ayahs.push({
      ayah: i,
      audioUrl: `https://d.quranenc.com/data/audio/english_rwwad/${s}${a}.mp3`
    });
  }

  return ayahs;
}

/**
 * Returns the ordered per-Ayah Arabic recitation audio sources for a requested Surah.
 * Uses the EveryAyah CDN — Mishary Rashid Al-Afasy (same reciter as existing Arabic integration).
 * URL structure: https://everyayah.com/data/Alafasy_128kbps/{sura_3digits}{aya_3digits}.mp3
 *
 * Used exclusively for the "Arabic + English" combined listening mode.
 * The existing whole-Surah Arabic playback (from Quran Foundation) is unaffected.
 */
export function getArabicSurahAyahAudio(surahNumber: number): AyahAudio[] {
  if (surahNumber < 1 || surahNumber > 114) {
    throw { status: 400, message: 'Invalid Surah ID' };
  }

  const count = SURAH_AYAH_COUNTS[surahNumber - 1];
  const s = String(surahNumber).padStart(3, '0');

  const ayahs: AyahAudio[] = [];
  for (let i = 1; i <= count; i++) {
    const a = String(i).padStart(3, '0');
    ayahs.push({
      ayah: i,
      audioUrl: `https://everyayah.com/data/Alafasy_128kbps/${s}${a}.mp3`
    });
  }

  return ayahs;
}
