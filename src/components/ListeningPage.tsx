'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { surahs } from '../data/surahs';
import { useAudio } from '../context/AudioContext';

import { ThemeToggle } from './ThemeToggle';
import { TranslationCaption } from './TranslationCaption';

interface ListeningPageProps {
  title: string;
}

export function ListeningPage({ title }: ListeningPageProps) {
  const pathname = usePathname();
  const isArabic = pathname.includes('/arabic');
  const language = isArabic ? 'arabic' : 'english';

  const { currentSurahId, currentLanguage, isPlaying, playSurah, togglePlayPause, savedProgress } = useAudio();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  // Sync selectedSurahId with the currently playing Surah when it changes (e.g. auto-advance)
  React.useEffect(() => {
    if (currentSurahId !== null && currentLanguage === language) {
      setSelectedSurahId(currentSurahId);
    }
  }, [currentSurahId, currentLanguage, language]);

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
    playSurah(id, language);
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

          {/* Compact Language Switcher */}
          <div className="flex items-center gap-4 text-sm font-medium tracking-wide">
            <Link 
              href="/listen/arabic" 
              className={`transition-colors ${isArabic ? 'text-foreground' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
            >
              Arabic
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <Link 
              href="/listen/english" 
              className={`transition-colors ${!isArabic ? 'text-foreground' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
            >
              English
            </Link>
          </div>
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

        {/* Translation toggle — English only */}
        {!isArabic && (
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

        {/* Translation caption — English only, controlled by toggle */}
        {!isArabic && <TranslationCaption show={showTranslation} />}

        {/* Start Playing Button */}
        <div className="flex flex-col items-center justify-center mb-12 gap-4 h-[72px]">
          {(() => {
            const progress = savedProgress[language];
            const progressSurah = progress ? surahs.find(s => s.id === progress.surahId) : null;
            
            // If they explicitly selected a Surah that isn't currently playing
            if (selectedSurahId && (currentSurahId !== selectedSurahId || currentLanguage !== language)) {
              return (
                <button 
                  className="flex items-center gap-3 px-8 py-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-white transition-colors"
                  onClick={() => playSurah(selectedSurahId, language)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <span className="font-medium tracking-wide text-sm uppercase">Start Listening</span>
                </button>
              );
            }

            // If there's progress and they haven't overridden it by selecting a Surah
            if (progress && progressSurah && (currentSurahId === null || currentLanguage !== language)) {
              return (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-center text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    <span className="block text-neutral-800 dark:text-neutral-200">{progressSurah.englishName}</span>
                    <span className="block font-light">
                      {Math.floor(progress.position / 60)}:{Math.floor(progress.position % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <button 
                    className="flex items-center gap-3 px-8 py-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-white transition-colors"
                    onClick={() => {
                      setSelectedSurahId(progress.surahId);
                      playSurah(progress.surahId, language, progress.position);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span className="font-medium tracking-wide text-sm uppercase">Continue Listening</span>
                  </button>
                </div>
              );
            }

            // If nothing is playing and no progress, show default Start Listening (Surah 1)
            if (currentSurahId === null || currentLanguage !== language) {
              return (
                <button 
                  className="flex items-center gap-3 px-8 py-4 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-white transition-colors"
                  onClick={() => playSurah(1, language)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <span className="font-medium tracking-wide text-sm uppercase">Start Listening</span>
                </button>
              );
            }

            // Hide the button container logic is handled by setting a fixed height container above
            // and returning null here, so the layout doesn't jump aggressively if possible.
            return null;
          })()}
        </div>

        {/* Surah List */}
        <div className="flex flex-col gap-2">
          {filteredSurahs.map((surah) => {
            const isPlayingThis = currentSurahId === surah.id && currentLanguage === language;
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
                  <span className={`font-light w-8 text-left ${isActive ? 'text-neutral-900 dark:text-white font-medium' : 'text-neutral-400 dark:text-neutral-500'}`}>
                    {surah.id.toString().padStart(2, '0')}
                  </span>
                  <span className={`font-medium ${isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-800 dark:text-neutral-300'}`}>
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

      </div>
    </div>
  );
}
