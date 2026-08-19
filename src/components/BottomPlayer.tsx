'use client';

import React from 'react';
import { useAudio } from '../context/AudioContext';
import { surahs } from '../data/surahs';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BottomPlayer() {
  const {
    currentLanguage,
    currentSurahId,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
    seek,
    isLoadingAudio,
    audioError,
    retryAudio,
    englishQueue,
    urduQueue,
    currentAyahNumber,
    combinedAyahLang,
  } = useAudio();

  if (!currentSurahId) return null;

  const currentSurah = surahs.find((s) => s.id === currentSurahId);
  if (!currentSurah) return null;

  // ── Progress calculation ─────────────────────────────────────────────────
  let progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (currentLanguage === 'combined' && englishQueue && englishQueue.length > 0 && currentAyahNumber) {
    // Combined (English): 2 steps per ayah (Arabic + English)
    const totalSteps = englishQueue.length * 2;
    const currentAyahIdx = currentAyahNumber - 1; // 0-indexed
    const langOffset = combinedAyahLang === 'english' ? 1 : 0;
    const currentStep = currentAyahIdx * 2 + langOffset;
    const ayahProgress = duration > 0 ? currentTime / duration : 0;
    progressPercent = ((currentStep + ayahProgress) / totalSteps) * 100;
  } else if (currentLanguage === 'combined-urdu' && urduQueue && urduQueue.length > 0 && currentAyahNumber) {
    // Combined (Urdu): 2 steps per ayah (Arabic + Urdu)
    const totalSteps = urduQueue.length * 2;
    const currentAyahIdx = currentAyahNumber - 1; // 0-indexed
    const langOffset = combinedAyahLang === 'urdu' ? 1 : 0;
    const currentStep = currentAyahIdx * 2 + langOffset;
    const ayahProgress = duration > 0 ? currentTime / duration : 0;
    progressPercent = ((currentStep + ayahProgress) / totalSteps) * 100;
  } else if (currentLanguage === 'english' && englishQueue && englishQueue.length > 0) {
    const totalAyahs = englishQueue.length;
    const currentAyahIdx = currentAyahNumber ? currentAyahNumber - 1 : 0;
    const ayahProgress = duration > 0 ? currentTime / duration : 0;
    progressPercent = ((currentAyahIdx + ayahProgress) / totalAyahs) * 100;
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentLanguage === 'english' || currentLanguage === 'combined' || currentLanguage === 'combined-urdu') {
      // Seeking across ayahs based on a combined progress bar is complex
      // without knowing individual durations. Disabled for now.
      return;
    }
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const newPercent = x / bounds.width;
    seek(newPercent * duration);
  };

  // ── Subtitle for the track-info section ─────────────────────────────────
  const subtitle = () => {
    if (audioError) {
      return (
        <p
          className="text-xs text-red-500 font-medium truncate mt-0.5 cursor-pointer hover:underline"
          onClick={retryAudio}
        >
          {audioError} (Retry)
        </p>
      );
    }
    if (isLoadingAudio) {
      return (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium animate-pulse truncate mt-0.5">
          Loading audio...
        </p>
      );
    }
    if (currentLanguage === 'combined' && currentAyahNumber) {
      const langLabel = combinedAyahLang === 'english' ? 'English' : 'Arabic';
      return (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
          {langLabel} · Ayah {currentAyahNumber}
        </p>
      );
    }
    if (currentLanguage === 'combined-urdu' && currentAyahNumber) {
      const langLabel = combinedAyahLang === 'urdu' ? 'Urdu' : 'Arabic';
      return (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
          {langLabel} · Ayah {currentAyahNumber}
        </p>
      );
    }
    if (currentLanguage === 'english' && currentAyahNumber) {
      return (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
          Ayah {currentAyahNumber}
        </p>
      );
    }
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-arabic truncate mt-0.5">
        {currentSurah.arabicName}
      </p>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#111] border-t border-neutral-100 dark:border-neutral-800 px-4 py-4 md:px-8 z-50 transition-colors duration-500">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">

        {/* Track Info */}
        <div className="flex-1 w-full text-center md:text-left truncate">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {currentSurah.id}. {currentSurah.englishName}
          </p>
          {subtitle()}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center flex-[2] w-full max-w-md">
          <div className="flex items-center justify-center gap-8 mb-3">
            <button
              onClick={playPrevious}
              disabled={!hasPrevious}
              aria-label="Previous Surah"
              className={`transition-colors ${
                hasPrevious
                  ? 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  : 'text-neutral-200 dark:text-neutral-700 cursor-not-allowed'
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                <line x1="5" y1="19" x2="5" y2="5"></line>
              </svg>
            </button>

            <button
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-12 h-12 flex items-center justify-center bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              )}
            </button>

            <button
              onClick={playNext}
              disabled={!hasNext}
              aria-label="Next Surah"
              className={`transition-colors ${
                hasNext
                  ? 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  : 'text-neutral-200 dark:text-neutral-700 cursor-not-allowed'
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full flex items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
            <span className="w-8 text-right">{formatTime(currentTime)}</span>
            <div
              className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-neutral-900 dark:bg-neutral-200 rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="w-8">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 hidden md:block"></div>

      </div>
    </div>
  );
}
