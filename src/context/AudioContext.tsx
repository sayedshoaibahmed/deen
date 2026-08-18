'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { surahs } from '../data/surahs';

type Language = 'arabic' | 'english';

export type SavedProgress = {
  surahId: number;
  position: number;
  ayahId?: number;
};

interface AudioContextType {
  currentLanguage: Language | null;
  currentSurahId: number | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  savedProgress: Record<Language, SavedProgress | null>;
  isLoadingAudio: boolean;
  audioError: string | null;
  englishQueue: {ayah: number, audioUrl: string}[] | null;
  currentAyahNumber: number | null;
  playSurah: (id: number, language: Language, startTime?: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (time: number) => void;
  retryAudio: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}

const STORAGE_KEY = 'quran_listening_progress';

function loadProgressFromStorage(): Record<Language, SavedProgress | null> {
  if (typeof window === 'undefined') return { arabic: null, english: null };
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to parse progress from localStorage', e);
  }
  return { arabic: null, english: null };
}

function saveProgressToStorage(progress: Record<Language, SavedProgress | null>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const [currentSurahId, setCurrentSurahId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // isLoadingAudio = true ONLY when current audio cannot play yet (genuine stall)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [englishQueue, setEnglishQueue] = useState<{ayah: number, audioUrl: string}[] | null>(null);
  const [currentAyahNumber, setCurrentAyahNumber] = useState<number | null>(null);
  const [savedProgress, setSavedProgress] = useState<Record<Language, SavedProgress | null>>({ arabic: null, english: null });

  // Refs
  const savedProgressRef = useRef(savedProgress);
  // Primary playback element
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Preload element for the NEXT English Ayah
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number>(0);
  const lastSaveTimeRef = useRef(0);
  const [retryCounter, setRetryCounter] = useState(0);

  // Stable refs for event handler closures (avoids stale closure issues)
  const stateRef = useRef({ currentLanguage, currentSurahId, currentAyahNumber, englishQueue, isPlaying });
  useEffect(() => {
    stateRef.current = { currentLanguage, currentSurahId, currentAyahNumber, englishQueue, isPlaying };
  }, [currentLanguage, currentSurahId, currentAyahNumber, englishQueue, isPlaying]);

  // Load progress on mount
  useEffect(() => {
    const loaded = loadProgressFromStorage();
    setSavedProgress(loaded);
    savedProgressRef.current = loaded;
  }, []);

  useEffect(() => {
    savedProgressRef.current = savedProgress;
  }, [savedProgress]);

  const retryAudio = () => setRetryCounter(c => c + 1);

  const syncProgress = useCallback((lang: Language, surahId: number, time: number, ayahId?: number) => {
    setSavedProgress((prev) => {
      const next = { ...prev, [lang]: { surahId, position: time, ayahId } };
      saveProgressToStorage(next);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // PRELOADING HELPER
  // Preloads the next Ayah URL into preloadRef so it is buffered ahead of time.
  // Does NOT affect the loading state shown to the user.
  // ─────────────────────────────────────────────────────────────────────────
  const preloadNextAyah = useCallback((queue: {ayah: number, audioUrl: string}[], nextAyahNumber: number) => {
    const nextAyah = queue.find(a => a.ayah === nextAyahNumber);
    if (!nextAyah) return;

    if (!preloadRef.current) {
      preloadRef.current = new Audio();
      preloadRef.current.preload = 'auto';
    }

    const preload = preloadRef.current;
    // Only reload if URL changed
    if (preload.src !== nextAyah.audioUrl) {
      preload.src = nextAyah.audioUrl;
      preload.load();
      console.log(`[Preload] Preloading Ayah ${nextAyahNumber}: ${nextAyah.audioUrl}`);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN AUDIO EVENT LISTENERS (mount once)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      const state = stateRef.current;
      if (state.currentLanguage && state.currentSurahId) {
        const now = Date.now();
        if (now - lastSaveTimeRef.current > 5000) {
          syncProgress(
            state.currentLanguage,
            state.currentSurahId,
            audio.currentTime,
            state.currentLanguage === 'english' ? (state.currentAyahNumber || undefined) : undefined
          );
          lastSaveTimeRef.current = now;
        }

        // Preload next ayah when 10 seconds remain on current ayah
        if (
          state.currentLanguage === 'english' &&
          state.englishQueue &&
          state.currentAyahNumber &&
          audio.duration &&
          audio.duration - audio.currentTime < 10
        ) {
          const nextAyahNum = state.currentAyahNumber + 1;
          if (nextAyahNum <= state.englishQueue.length) {
            preloadNextAyah(state.englishQueue, nextAyahNum);
          }
        }
      }
    };

    const handleDurationChange = () => setDuration(audio.duration);

    // Show loading indicator only when audio is genuinely stalled mid-play
    const handleWaiting = () => {
      const state = stateRef.current;
      if (state.isPlaying) {
        setIsLoadingAudio(true);
      }
    };

    const handlePlaying = () => {
      setIsLoadingAudio(false);
      setAudioError(null);
    };

    const handleEnded = () => {
      const state = stateRef.current;
      if (!state.currentLanguage || !state.currentSurahId) return;

      if (state.currentLanguage === 'english') {
        if (state.englishQueue && state.currentAyahNumber) {
          const nextAyah = state.currentAyahNumber + 1;

          if (nextAyah <= state.englishQueue.length) {
            // ── Swap preloaded audio into primary element ──────────────────
            const nextAyahObj = state.englishQueue.find(a => a.ayah === nextAyah);
            if (nextAyahObj && preloadRef.current && preloadRef.current.src === nextAyahObj.audioUrl) {
              // The next ayah was preloaded - swap src directly for instant start
              const preloadedSrc = preloadRef.current.src;
              if (audioRef.current && audioRef.current.src !== preloadedSrc) {
                audioRef.current.src = preloadedSrc;
                setCurrentTime(0);
                setIsLoadingAudio(false);
                audioRef.current.play().catch(e => {
                  if (e.name !== 'AbortError') {
                    console.error('Preloaded playback failed:', e);
                    setAudioError('Playback failed or was interrupted');
                  }
                });
              }
            }
            // ──────────────────────────────────────────────────────────────

            syncProgress('english', state.currentSurahId, 0, nextAyah);
            setCurrentAyahNumber(nextAyah);
          } else {
            // Last Ayah → advance to next Surah
            if (state.currentSurahId < 114) {
              syncProgress('english', state.currentSurahId + 1, 0, 1);
              setCurrentAyahNumber(null);
              setEnglishQueue(null);
              setCurrentSurahId(state.currentSurahId + 1);
            } else {
              setIsPlaying(false);
            }
          }
        }
      } else {
        // Arabic: Surah-level progression
        if (state.currentSurahId < 114) {
          syncProgress('arabic', state.currentSurahId + 1, 0);
          setCurrentSurahId(state.currentSurahId + 1);
        } else {
          setIsPlaying(false);
        }
      }
    };

    const handleError = () => {
      const state = stateRef.current;
      if (!state.isPlaying) return;
      // Only surface errors when actively playing
      if (audio.error && audio.error.code !== MediaError.MEDIA_ERR_ABORTED) {
        setIsLoadingAudio(false);
        setAudioError('Audio playback error. Please retry.');
      }
    };

    const handleBeforeUnload = () => {
      const state = stateRef.current;
      if (state.currentLanguage && state.currentSurahId && audio) {
        syncProgress(
          state.currentLanguage,
          state.currentSurahId,
          audio.currentTime,
          state.currentLanguage === 'english' ? (state.currentAyahNumber || undefined) : undefined
        );
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('error', handleError);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('error', handleError);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [syncProgress, preloadNextAyah]); // stable callbacks only

  // Save progress on pause
  useEffect(() => {
    if (!isPlaying && currentLanguage && currentSurahId && audioRef.current) {
      syncProgress(
        currentLanguage,
        currentSurahId,
        audioRef.current.currentTime,
        currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined
      );
    }
  }, [isPlaying, currentLanguage, currentSurahId, currentAyahNumber, syncProgress]);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH ENGLISH QUEUE (once per Surah, not per Ayah)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    if (currentLanguage === 'english' && currentSurahId) {
      setAudioError(null);

      async function fetchQueue() {
        // Only show loading if we truly have nothing queued yet
        if (!englishQueue) setIsLoadingAudio(true);
        try {
          const res = await fetch(`/api/quran/audio/english/${currentSurahId}`, { signal: controller.signal });
          const data = await res.json();
          if (!active) return;
          if (!res.ok) throw new Error(data.error || 'Failed to load English audio');
          if (data.ayahs) {
            setEnglishQueue(data.ayahs);
            // Restore saved Ayah position or start from 1
            if (!currentAyahNumber || currentSurahId !== savedProgressRef.current.english?.surahId) {
              const saved = savedProgressRef.current.english;
              setCurrentAyahNumber(saved?.surahId === currentSurahId && saved.ayahId ? saved.ayahId : 1);
            }
          }
        } catch (err: unknown) {
          if (!active) return;
          if (err instanceof Error && err.name === 'AbortError') return;
          console.error(err);
          setAudioError(err instanceof Error ? err.message : 'Failed to load English audio');
          setIsPlaying(false);
        } finally {
          if (active) setIsLoadingAudio(false);
        }
      }

      fetchQueue();
    } else if (currentLanguage !== 'english') {
      setEnglishQueue(null);
    }

    return () => {
      active = false;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSurahId, currentLanguage, retryCounter]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD AUDIO – fires when Ayah changes (English) or Surah changes (Arabic)
  // For English: does NOT set isLoadingAudio unless the preload element
  //              hasn't buffered yet, keeping the UI clean between Ayahs.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const applySeek = () => {
      if (pendingSeekRef.current > 0 && audioRef.current) {
        audioRef.current.currentTime = pendingSeekRef.current;
        setCurrentTime(pendingSeekRef.current);
        pendingSeekRef.current = 0;
      }
    };

    async function loadAudio() {
      if (!currentSurahId || !currentLanguage || !audioRef.current) return;

      // ── ENGLISH ──────────────────────────────────────────────────────────
      if (currentLanguage === 'english') {
        if (!englishQueue || !currentAyahNumber) return;

        const ayahObj = englishQueue.find(a => a.ayah === currentAyahNumber);
        if (!ayahObj) return;

        // Check if preloaded element already has this URL ready
        const preload = preloadRef.current;
        const preloadHasIt = preload && preload.src === ayahObj.audioUrl && preload.readyState >= 2;

        if (audioRef.current.src === ayahObj.audioUrl) {
          // Already loaded – just apply seek and play
          applySeek();
          if (isPlaying) {
            audioRef.current.play().catch(e => {
              if (e.name !== 'AbortError') setAudioError('Playback failed');
            });
          }
          return;
        }

        // Switch src. Only show loading state if the preload element isn't ready
        setAudioError(null);
        if (!preloadHasIt) {
          setIsLoadingAudio(true);
        }

        audioRef.current.src = ayahObj.audioUrl;
        setCurrentTime(0);

        const startPlayback = () => {
          applySeek();
          setIsLoadingAudio(false);
          if (isPlaying && active) {
            audioRef.current!.play().catch(e => {
              if (e.name !== 'AbortError') {
                console.error('English playback failed:', e);
                setAudioError('Playback failed or was interrupted');
              }
            });
          }
        };

        if (preloadHasIt || audioRef.current.readyState >= 2) {
          // Already buffered (via preload swap or cached) – start immediately
          startPlayback();
        } else {
          // Wait for canplay – faster than loadedmetadata for starting playback
          const onCanPlay = () => {
            if (!active) return;
            audioRef.current!.removeEventListener('canplay', onCanPlay);
            startPlayback();
          };
          audioRef.current.addEventListener('canplay', onCanPlay);
        }

        // Preload the NEXT ayah immediately
        const nextAyahNum = currentAyahNumber + 1;
        if (nextAyahNum <= englishQueue.length) {
          preloadNextAyah(englishQueue, nextAyahNum);
        }
        return;
      }

      // ── ARABIC ───────────────────────────────────────────────────────────
      setIsLoadingAudio(true);
      setAudioError(null);

      try {
        const res = await fetch(`/api/quran/audio/arabic/${currentSurahId}`, { signal: controller.signal });
        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          throw new Error(data.details || data.error || 'Failed to load audio');
        }

        if (data.audioUrl) {
          if (audioRef.current.src !== data.audioUrl) {
            setAudioError(null);
            audioRef.current.src = data.audioUrl;
            setCurrentTime(0);

            const startArabicPlayback = () => {
              applySeek();
              setIsLoadingAudio(false);
              if (isPlaying && active) {
                audioRef.current!.play().catch(e => {
                  if (e.name !== 'AbortError') {
                    console.error('Arabic playback failed:', e);
                    setAudioError('Playback failed or was interrupted');
                  }
                });
              }
            };

            if (audioRef.current.readyState >= 2) {
              startArabicPlayback();
            } else {
              const onCanPlay = () => {
                if (!active) return;
                audioRef.current!.removeEventListener('canplay', onCanPlay);
                startArabicPlayback();
              };
              audioRef.current.addEventListener('canplay', onCanPlay);
            }
          } else {
            setIsLoadingAudio(false);
          }
        } else {
          throw new Error('No audio URL in response');
        }
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error(err);
        setAudioError(err instanceof Error ? (err.message || 'Error loading audio') : 'Error loading audio');
        setIsPlaying(false);
        setIsLoadingAudio(false);
      }
    }

    loadAudio();

    return () => {
      active = false;
      controller.abort();
    };
  // isPlaying is intentionally included so playback resumes after pause
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSurahId, currentLanguage, retryCounter, englishQueue, currentAyahNumber, preloadNextAyah]);

  // ─────────────────────────────────────────────────────────────────────────
  // PLAY / PAUSE sync
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && audioRef.current.src) {
      audioRef.current.play().catch(e => {
        if (e.name !== 'AbortError') {
          console.error('Play/pause failed:', e);
          setIsPlaying(false);
        }
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  const playSurah = (id: number, language: Language, startTime: number = 0) => {
    if (currentLanguage && currentSurahId && audioRef.current) {
      syncProgress(currentLanguage, currentSurahId, audioRef.current.currentTime, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    // Clear preload element on explicit Surah change
    if (preloadRef.current) {
      preloadRef.current.src = '';
      preloadRef.current.load();
    }
    setAudioError(null);
    setIsLoadingAudio(false);
    pendingSeekRef.current = startTime;
    setCurrentLanguage(language);
    setCurrentSurahId(id);
    setCurrentAyahNumber(null);
    setEnglishQueue(null);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (currentSurahId) setIsPlaying(prev => !prev);
  };

  const playNext = () => {
    if (currentSurahId !== null && currentSurahId < 114 && currentLanguage) {
      if (audioRef.current) {
        syncProgress(currentLanguage, currentSurahId, audioRef.current.currentTime, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
      }
      if (preloadRef.current) { preloadRef.current.src = ''; preloadRef.current.load(); }
      setCurrentSurahId(currentSurahId + 1);
      setCurrentAyahNumber(null);
      setEnglishQueue(null);
      setIsPlaying(true);
    }
  };

  const playPrevious = () => {
    if (currentSurahId !== null && currentSurahId > 1 && currentLanguage) {
      if (audioRef.current) {
        syncProgress(currentLanguage, currentSurahId, audioRef.current.currentTime, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
      }
      if (preloadRef.current) { preloadRef.current.src = ''; preloadRef.current.load(); }
      setCurrentSurahId(currentSurahId - 1);
      setCurrentAyahNumber(null);
      setEnglishQueue(null);
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (currentLanguage && currentSurahId) {
        syncProgress(currentLanguage, currentSurahId, time, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
      }
    }
  };

  const hasNext = currentSurahId !== null && currentSurahId < 114;
  const hasPrevious = currentSurahId !== null && currentSurahId > 1;

  return (
    <AudioContext.Provider
      value={{
        currentLanguage,
        currentSurahId,
        isPlaying,
        currentTime,
        duration,
        savedProgress,
        isLoadingAudio,
        audioError,
        englishQueue,
        currentAyahNumber,
        playSurah,
        togglePlayPause,
        playNext,
        playPrevious,
        seek,
        hasNext,
        hasPrevious,
        retryAudio,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
