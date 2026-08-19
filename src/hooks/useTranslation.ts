'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '../context/AudioContext';

export interface AyahTranslation {
  ayah: number;
  text: string;
}

interface TranslationState {
  /** Text of the currently playing Ayah, or null if not yet available. */
  translationText: string | null;
  /** True only while the per-Surah translation data is being fetched. */
  isLoadingTranslation: boolean;
  /** Non-null when a translation fetch failed; audio keeps playing regardless. */
  translationError: string | null;
  /** The Surah the currently displayed translation belongs to. */
  translationSurahId: number | null;
  /** The Ayah the currently displayed translation belongs to. */
  translationAyahNumber: number | null;
  /** Retry the failed translation fetch without touching audio. */
  retryTranslation: () => void;
}

/**
 * useTranslation
 *
 * Follows the English audio's currentSurahId + currentAyahNumber from
 * AudioContext and surfaces the matching Rowwad (english_rwwad) translation.
 *
 * Active when:
 *  - currentLanguage === 'english'  (English-only mode)
 *  - currentLanguage === 'combined' AND combinedAyahLang === 'english'
 *    (English half of combined mode)
 *
 * Design rules:
 *  - Never blocks or restarts audio.
 *  - Loads the full Surah translation once, then serves per-Ayah from cache.
 *  - Race-condition-safe: ignores responses from superseded fetch requests.
 */
export function useTranslation(): TranslationState {
  const { currentSurahId, currentAyahNumber, currentLanguage, combinedAyahLang } = useAudio();

  // Active when English-only mode OR English half of combined mode
  const isEnglishActive =
    currentLanguage === 'english' ||
    (currentLanguage === 'combined' && combinedAyahLang === 'english');

  // Per-Surah cache: surahId → sorted ayah translations
  const surahCacheRef = useRef<Map<number, AyahTranslation[]>>(new Map());

  // Monotonically increasing request counter — used to discard stale responses
  const requestIdRef = useRef(0);

  const [translationText, setTranslationText] = useState<string | null>(null);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationSurahId, setTranslationSurahId] = useState<number | null>(null);
  const [translationAyahNumber, setTranslationAyahNumber] = useState<number | null>(null);

  // Retry counter – incrementing forces a re-fetch on the same Surah
  const [retryCounter, setRetryCounter] = useState(0);
  const retryTranslation = useCallback(() => {
    // Also evict the (presumably bad) cached data for this Surah so we re-fetch
    if (currentSurahId !== null) {
      surahCacheRef.current.delete(currentSurahId);
    }
    setRetryCounter((c) => c + 1);
  }, [currentSurahId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Effect 1: Load the Surah's translation data
  //   Runs when surahId or active-language status changes.
  //   Does NOT run per-Ayah — Ayah selection is derived in Effect 2.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Only active for English or English half of combined
    if (!isEnglishActive || !currentSurahId) {
      setTranslationText(null);
      setTranslationError(null);
      setIsLoadingTranslation(false);
      setTranslationSurahId(null);
      setTranslationAyahNumber(null);
      return;
    }

    const surahId = currentSurahId;

    // If already cached, no network request needed
    if (surahCacheRef.current.has(surahId)) {
      setIsLoadingTranslation(false);
      setTranslationError(null);
      // Ayah selection will happen in Effect 2
      return;
    }

    // Start a new request
    const thisRequestId = ++requestIdRef.current;

    setIsLoadingTranslation(true);
    setTranslationError(null);
    // Clear stale Ayah text immediately on Surah change
    setTranslationText(null);
    setTranslationSurahId(null);
    setTranslationAyahNumber(null);

    let active = true;

    (async () => {
      try {
        const res = await fetch(`/api/quran/translation/${surahId}`);
        const data = await res.json();

        // Discard if a newer request superseded this one, or component unmounted
        if (!active || thisRequestId !== requestIdRef.current) return;

        if (!res.ok) {
          throw new Error(data.error || 'Translation unavailable');
        }

        if (!Array.isArray(data.ayahs)) {
          throw new Error('Unexpected translation response');
        }

        // Store in cache
        surahCacheRef.current.set(surahId, data.ayahs as AyahTranslation[]);
        setIsLoadingTranslation(false);
        // Ayah selection will fire from Effect 2 reacting to the state change
      } catch (err) {
        if (!active || thisRequestId !== requestIdRef.current) return;
        console.error('[useTranslation] Fetch failed:', err);
        setIsLoadingTranslation(false);
        setTranslationError(
          err instanceof Error ? err.message : 'Failed to load translation',
        );
      }
    })();

    return () => {
      active = false;
    };
  // retryCounter intentionally included to allow manual retry
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSurahId, isEnglishActive, retryCounter]);

  // ─────────────────────────────────────────────────────────────────────────
  // Effect 2: Derive the current Ayah's text from the cached Surah data.
  //   Runs whenever the Ayah number changes OR whenever the cache is populated.
  //   This is a pure read — no network I/O.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEnglishActive || !currentSurahId || !currentAyahNumber) {
      // Clear text when switching away from English half (e.g. Arabic half in combined)
      if (!isEnglishActive) {
        setTranslationText(null);
        setTranslationSurahId(null);
        setTranslationAyahNumber(null);
      }
      return;
    }

    const cached = surahCacheRef.current.get(currentSurahId);
    if (!cached) {
      // Data not yet loaded — Effect 1 is handling the fetch
      return;
    }

    const ayahData = cached.find((a) => a.ayah === currentAyahNumber);
    if (ayahData) {
      setTranslationText(ayahData.text);
      setTranslationSurahId(currentSurahId);
      setTranslationAyahNumber(currentAyahNumber);
      setTranslationError(null);
    } else {
      // Ayah not found in translation data (shouldn't normally happen)
      setTranslationText(null);
    }
  }, [currentSurahId, currentAyahNumber, isEnglishActive, isLoadingTranslation]);
  //                                                        ^^^^^^^^^^^^^^^^^^
  // isLoadingTranslation acts as a proxy "trigger" for when the cache is freshly
  // populated (it flips from true→false after a successful fetch).

  return {
    translationText,
    isLoadingTranslation,
    translationError,
    translationSurahId,
    translationAyahNumber,
    retryTranslation,
  };
}
