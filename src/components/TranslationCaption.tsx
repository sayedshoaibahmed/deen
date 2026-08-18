'use client';

import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { surahs } from '../data/surahs';

interface TranslationCaptionProps {
  /** When false, the entire block is hidden but the hook continues running. */
  show: boolean;
}

/**
 * TranslationCaption
 *
 * Displays the Rowwad (english_rwwad) translation of the currently playing
 * English Ayah. Visibility is controlled by the `show` prop; toggling it
 * never pauses or restarts audio.
 *
 * Audio and translation are fully decoupled:
 *  - If translation fails, audio continues unaffected.
 *  - Loading translation never delays audio start.
 */
export function TranslationCaption({ show }: TranslationCaptionProps) {
  const {
    translationText,
    isLoadingTranslation,
    translationError,
    translationSurahId,
    translationAyahNumber,
    retryTranslation,
  } = useTranslation();

  // Always render the hook; conditionally render the UI
  if (!show) return null;

  const surah = translationSurahId
    ? surahs.find((s) => s.id === translationSurahId)
    : null;

  return (
    <section
      role="region"
      aria-label="English translation"
      className="mt-6 mb-8 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-6 py-5 transition-colors duration-500"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium tracking-widest uppercase text-neutral-400 dark:text-neutral-500 select-none">
          English Translation
        </span>
        {surah && translationAyahNumber && !isLoadingTranslation && !translationError && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {surah.englishName} · Ayah {translationAyahNumber}
          </span>
        )}
      </div>

      {/* Content area */}
      {isLoadingTranslation && (
        <p
          aria-live="polite"
          className="text-sm text-neutral-400 dark:text-neutral-500 animate-pulse font-light"
        >
          Loading translation…
        </p>
      )}

      {translationError && !isLoadingTranslation && (
        <div aria-live="assertive" className="flex items-center gap-3">
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-light">
            Translation unavailable.
          </p>
          <button
            onClick={retryTranslation}
            className="text-xs underline underline-offset-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoadingTranslation && !translationError && translationText && (
        <p
          aria-live="polite"
          className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 font-light"
        >
          {translationText}
        </p>
      )}

      {!isLoadingTranslation && !translationError && !translationText && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500 font-light">
          —
        </p>
      )}
    </section>
  );
}
