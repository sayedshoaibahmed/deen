'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { surahs } from '../data/surahs';
import { useAudio } from '../context/AudioContext';
import type { Language, SavedProgress } from '../context/AudioContext';

import { ThemeToggle } from './ThemeToggle';
import { TranslationCaption } from './TranslationCaption';

interface ListeningPageProps {
  title: string;
}

export function ListeningPage({ title }: ListeningPageProps) {
  const pathname = usePathname();
  const mode: Language = pathname.includes('/arabic')
    ? 'arabic'
    : pathname.includes('/combined-urdu')
    ? 'combined-urdu'
    : pathname.includes('/combined')
    ? 'combined'
    : 'english';

  const { currentSurahId, currentLanguage, isPlaying, playSurah, togglePlayPause, savedProgress } =
    useAudio();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  // Sync selectedSurahId with the currently playing Surah when it changes (e.g. auto-advance)
  React.useEffect(() => {
    if (currentSurahId !== null && currentLanguage === mode) {
      setSelectedSurahId(currentSurahId);
    }
  }, [currentSurahId, currentLanguage, mode]);

  const filteredSurahs = surahs.filter((surah) => {
    const q = searchQuery.toLowerCase();
    return (
      surah.id.toString().includes(q) ||
      surah.englishName.toLowerCase().includes(q) ||
      surah.arabicName.includes(q)
    );
  });

  const handleSurahClick = (id: number) => {
    setSelectedSurahId(id);
    playSurah(id, mode);
  };

  // ── Resume/Start button helper ────────────────────────────────────────────
  const progress: SavedProgress | null = savedProgress[mode];
  const progressSurah = progress ? surahs.find((s) => s.id === progress.surahId) : null;
  const isCurrentModeActive = currentSurahId !== null && currentLanguage === mode;

  const resumeSubtitle = (p: SavedProgress): string => {
    if (mode === 'combined' && p.ayahId) {
      const langLabel = p.combinedLang === 'english' ? 'English' : 'Arabic';
      return `Ayah ${p.ayahId} · ${langLabel}`;
    }
    if (mode === 'combined-urdu' && p.ayahId) {
      const langLabel = p.combinedLang === 'urdu' ? 'Urdu' : 'Arabic';
      return `Ayah ${p.ayahId} · ${langLabel}`;
    }
    return `${Math.floor(p.position / 60)}:${Math.floor(p.position % 60)
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32 transition-colors duration-500">
      <div className="max-w-3xl mx-auto px-6 py-12 relative">

        {/* Theme Toggle */}
        <div className="absolute top-8 right-6">
          <ThemeToggle />
        </div>

        {/* Header */}
        <header className="flex flex-col items-center mb-12">
          <Link href="/" className="text-2xl font-light tracking-widest uppercase mb-8 hover:opacity-70 transition-opacity">
            Quran
          </Link>

          <h1 className="text-2xl font-light text-neutral-800 dark:text-neutral-200 mb-6">{title}</h1>

          {/* Compact Language / Mode Switcher */}
          <nav aria-label="Listening mode" className="flex flex-wrap justify-center items-center gap-x-4 gap-y-3 text-sm font-medium tracking-wide">
            <Link
              href="/listen/arabic"
              aria-current={mode === 'arabic' ? 'page' : undefined}
              className={`whitespace-nowrap transition-colors ${
                mode === 'arabic'
                  ? 'text-foreground'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              Arabic
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">|</span>
            <Link
              href="/listen/english"
              aria-current={mode === 'english' ? 'page' : undefined}
              className={`whitespace-nowrap transition-colors ${
                mode === 'english'
                  ? 'text-foreground'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              English
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">|</span>
            <Link
              href="/listen/combined"
              aria-current={mode === 'combined' ? 'page' : undefined}
              className={`whitespace-nowrap transition-colors ${
                mode === 'combined'
                  ? 'text-foreground'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              Arabic + English
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">|</span>
            <Link
              href="/listen/combined-urdu"
              aria-current={mode === 'combined-urdu' ? 'page' : undefined}
              className={`whitespace-nowrap transition-colors ${
                mode === 'combined-urdu'
                  ? 'text-foreground'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              Arabic + Urdu
            </Link>
          </nav>
        </header>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search Surah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl px-6 py-4 text-neutral-800 dark:text-neutral-200 outline-none focus:border-neutral-300 dark:focus:border-neutral-600 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 font-light"
          />
        </div>

        {/* Translation toggle — English and Combined (English) modes only */}
        {(mode === 'english' || mode === 'combined') && (
          <div className="flex items-center justify-end mb-6">
            <button
              id="translation-toggle"
              role="switch"
              aria-checked={showTranslation}
              aria-label="Show English translation captions"
              onClick={() => setShowTranslation((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              {/* Pill toggle */}
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                  showTranslation
                    ? 'bg-neutral-800 dark:bg-neutral-200'
                    : 'bg-neutral-200 dark:bg-neutral-700'
                }`}
                aria-hidden="true"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white dark:bg-neutral-900 transition-transform duration-200 ${
                    showTranslation ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
              Show English Translation
            </button>
          </div>
        )}

        {/* Translation caption — English and Combined (English) modes only */}
        {(mode === 'english' || mode === 'combined') && (
          <TranslationCaption show={showTranslation} />
        )}

        {/* Start Playing Button */}
        <div className="flex flex-col items-center justify-center mb-12 gap-4 h-[72px]">
          {(() => {
            // If they explicitly selected a Surah that isn't currently playing in this mode
            if (selectedSurahId && (currentSurahId !== selectedSurahId || currentLanguage !== mode)) {
              return (
                <button
                  className="flex items-center gap-3 px-8 py-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-white transition-colors"
                  onClick={() => playSurah(selectedSurahId, mode)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <span className="font-medium tracking-wide text-sm uppercase">Start Listening</span>
                </button>
              );
            }

            // If there's saved progress and this mode isn't active yet
            if (progress && progressSurah && !isCurrentModeActive) {
              return (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-center text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    <span className="block text-neutral-800 dark:text-neutral-200">
                      {progressSurah.englishName}
                    </span>
                    <span className="block font-light">{resumeSubtitle(progress)}</span>
                  </div>
                  <button
                    className="flex items-center gap-3 px-8 py-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-white transition-colors"
                    onClick={() => {
                      setSelectedSurahId(progress.surahId);
                      // For combined modes: startTime=0, resume position is restored
                      // from savedProgressRef in the queue fetch effect.
                      // For Arabic/English: restore audio seek position.
                      playSurah(
                        progress.surahId,
                        mode,
                        (mode !== 'combined' && mode !== 'combined-urdu') ? progress.position : 0,
                      );
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span className="font-medium tracking-wide text-sm uppercase">
                      Continue Listening
                    </span>
                  </button>
                </div>
              );
            }

            // Nothing playing and no progress — default Start Listening (Surah 1)
            if (!isCurrentModeActive) {
              return (
                <button
                  className="flex items-center gap-3 px-8 py-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-white transition-colors"
                  onClick={() => playSurah(1, mode)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <span className="font-medium tracking-wide text-sm uppercase">Start Listening</span>
                </button>
              );
            }

            return null;
          })()}
        </div>

        {/* Surah List */}
        <div className="flex flex-col gap-2">
          {filteredSurahs.map((surah) => {
            const isPlayingThis = currentSurahId === surah.id && currentLanguage === mode;
            const isSelected = selectedSurahId === surah.id;
            const isActive = isPlayingThis || isSelected;

            return (
              <button
                key={surah.id}
                onClick={() => handleSurahClick(surah.id)}
                className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-neutral-100 dark:bg-neutral-800'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-6">
                  <span
                    className={`font-light w-8 text-left ${
                      isActive
                        ? 'text-neutral-900 dark:text-white font-medium'
                        : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    {surah.id.toString().padStart(2, '0')}
                  </span>
                  <span
                    className={`font-medium ${
                      isActive
                        ? 'text-neutral-900 dark:text-white'
                        : 'text-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {surah.englishName}
                  </span>
                  {isPlayingThis && isPlaying && (
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-1 h-2 bg-neutral-800 dark:bg-neutral-200 animate-[bounce_1s_infinite]"></div>
                      <div className="w-1 h-4 bg-neutral-800 dark:bg-neutral-200 animate-[bounce_1.2s_infinite]"></div>
                      <div className="w-1 h-3 bg-neutral-800 dark:bg-neutral-200 animate-[bounce_0.8s_infinite]"></div>
                    </div>
                  )}
                </div>
                <span className="text-xl text-neutral-800 dark:text-neutral-200 font-arabic">
                  {surah.arabicName}
                </span>
              </button>
            );
          })}
          {filteredSurahs.length === 0 && (
            <p className="text-center text-neutral-400 dark:text-neutral-500 py-12 font-light">
              No Surahs found.
            </p>
          )}
        </div>

        {/* Attribution — Urdu mode */}
        {mode === 'combined-urdu' && (
          <p className="mt-10 text-center text-xs text-neutral-400 dark:text-neutral-500 font-light">
            Urdu translation audio: Shamshad Ali Khan, via{' '}
            <a
              href="https://islamic.network"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              Al Quran Cloud (islamic.network)
            </a>
          </p>
        )}

      </div>
    </div>
  );
}
