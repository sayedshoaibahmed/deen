'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { surahs } from '../data/surahs';
import { getArabicSurahAyahAudio } from '../lib/quranenc';
import { getUrduSurahAudio } from '../lib/urdu';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Language = 'arabic' | 'english' | 'combined' | 'combined-urdu';

export type SavedProgress = {
  surahId: number;
  position: number;
  ayahId?: number;
  /** For combined / combined-urdu mode: which language half was playing */
  combinedLang?: 'arabic' | 'english' | 'urdu';
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
  englishQueue: { ayah: number; audioUrl: string }[] | null;
  /** Arabic per-Ayah queue — only populated in combined / combined-urdu mode */
  arabicAyahQueue: { ayah: number; audioUrl: string }[] | null;
  /** Urdu per-Ayah queue — only populated in combined-urdu mode */
  urduQueue: { ayah: number; audioUrl: string }[] | null;
  currentAyahNumber: number | null;
  /** Which language half is currently active in combined/combined-urdu mode; null otherwise */
  combinedAyahLang: 'arabic' | 'english' | 'urdu' | null;
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

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'quran_listening_progress';
/**
 * In-memory queue cache. Stores completed results and in-flight Promises.
 * Key format: `urdu-{surahNumber}` or `english-{surahNumber}`.
 * - Result entries: { ayah: number; audioUrl: string }[]
 * - In-flight entries: Promise<{ ayah: number; audioUrl: string }[]>
 * Sharing in-flight Promises prevents duplicate concurrent requests for the same Surah.
 */
const queueCache: Record<string, { ayah: number; audioUrl: string }[] | Promise<{ ayah: number; audioUrl: string }[]>> = {};

function loadProgressFromStorage(): Record<Language, SavedProgress | null> {
  if (typeof window === 'undefined') return { arabic: null, english: null, combined: null, 'combined-urdu': null };
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        arabic: parsed.arabic ?? null,
        english: parsed.english ?? null,
        combined: parsed.combined ?? null,
        'combined-urdu': parsed['combined-urdu'] ?? null,
      };
    }
  } catch (e) {
    console.error('Failed to parse progress from localStorage', e);
  }
  return { arabic: null, english: null, combined: null, 'combined-urdu': null };
}

function saveProgressToStorage(progress: Record<Language, SavedProgress | null>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const [currentSurahId, setCurrentSurahId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // isLoadingAudio = true ONLY when current audio cannot play yet (genuine stall)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [englishQueue, setEnglishQueue] = useState<{ ayah: number; audioUrl: string }[] | null>(null);
  const [arabicAyahQueue, setArabicAyahQueue] = useState<{ ayah: number; audioUrl: string }[] | null>(null);
  const [urduQueue, setUrduQueue] = useState<{ ayah: number; audioUrl: string }[] | null>(null);
  const [currentAyahNumber, setCurrentAyahNumber] = useState<number | null>(null);
  const [combinedAyahLang, setCombinedAyahLang] = useState<'arabic' | 'english' | 'urdu' | null>(null);
  const [savedProgress, setSavedProgress] = useState<Record<Language, SavedProgress | null>>({
    arabic: null, english: null, combined: null, 'combined-urdu': null,
  });

  // Refs
  const savedProgressRef = useRef(savedProgress);
  // Primary playback element
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Preload element for the NEXT item in the queue
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number>(0);
  const lastSaveTimeRef = useRef(0);
  const [retryCounter, setRetryCounter] = useState(0);

  // Stable refs for event handler closures (avoids stale closure issues)
  const stateRef = useRef({
    currentLanguage,
    currentSurahId,
    currentAyahNumber,
    englishQueue,
    urduQueue,
    isPlaying,
    combinedAyahLang,
    arabicAyahQueue,
  });
  useEffect(() => {
    stateRef.current = {
      currentLanguage,
      currentSurahId,
      currentAyahNumber,
      englishQueue,
      urduQueue,
      isPlaying,
      combinedAyahLang,
      arabicAyahQueue,
    };
  }, [currentLanguage, currentSurahId, currentAyahNumber, englishQueue, urduQueue, isPlaying, combinedAyahLang, arabicAyahQueue]);

  // Load progress on mount
  useEffect(() => {
    const loaded = loadProgressFromStorage();
    setSavedProgress(loaded);
    savedProgressRef.current = loaded;
  }, []);

  useEffect(() => {
    savedProgressRef.current = savedProgress;
  }, [savedProgress]);

  const retryAudio = () => setRetryCounter((c) => c + 1);

  const syncProgress = useCallback((
    lang: Language,
    surahId: number,
    time: number,
    ayahId?: number,
    combinedLang?: 'arabic' | 'english' | 'urdu',
  ) => {
    setSavedProgress((prev) => {
      const entry: SavedProgress = {
        surahId,
        position: time,
        ...(ayahId !== undefined ? { ayahId } : {}),
        ...(combinedLang !== undefined ? { combinedLang } : {}),
      };
      const next = { ...prev, [lang]: entry };
      saveProgressToStorage(next);
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // PRELOADING HELPER
  // Preloads the next queue item into preloadRef so it is buffered ahead of time.
  // Does NOT affect the loading state shown to the user.
  // ─────────────────────────────────────────────────────────────────────────
  const preloadNextAyah = useCallback(
    (queue: { ayah: number; audioUrl: string }[], nextAyahNumber: number) => {
      const nextAyah = queue.find((a) => a.ayah === nextAyahNumber);
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
    },
    [],
  );

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
            (state.currentLanguage === 'english' || state.currentLanguage === 'combined' || state.currentLanguage === 'combined-urdu')
              ? (state.currentAyahNumber || undefined)
              : undefined,
            (state.currentLanguage === 'combined' || state.currentLanguage === 'combined-urdu')
              ? (state.combinedAyahLang || undefined)
              : undefined,
          );
          lastSaveTimeRef.current = now;
        }

        // Preload next item when 10 seconds remain on current
        if (audio.duration && audio.duration - audio.currentTime < 10) {
          if (state.currentLanguage === 'english' && state.englishQueue && state.currentAyahNumber) {
            const nextAyahNum = state.currentAyahNumber + 1;
            if (nextAyahNum <= state.englishQueue.length) {
              preloadNextAyah(state.englishQueue, nextAyahNum);
            }
          } else if (state.currentLanguage === 'combined' && state.currentAyahNumber) {
            if (state.combinedAyahLang === 'arabic' && state.englishQueue) {
              // While Arabic N plays → preload English N
              preloadNextAyah(state.englishQueue, state.currentAyahNumber);
            } else if (state.combinedAyahLang === 'english' && state.arabicAyahQueue) {
              // While English N plays → preload Arabic N+1
              const nextAyahNum = state.currentAyahNumber + 1;
              if (nextAyahNum <= state.arabicAyahQueue.length) {
                preloadNextAyah(state.arabicAyahQueue, nextAyahNum);
              }
            }
          } else if (state.currentLanguage === 'combined-urdu' && state.currentAyahNumber) {
            if (state.combinedAyahLang === 'arabic' && state.urduQueue) {
              // While Arabic N plays → preload Urdu N
              preloadNextAyah(state.urduQueue, state.currentAyahNumber);
            } else if (state.combinedAyahLang === 'urdu' && state.arabicAyahQueue) {
              // While Urdu N plays → preload Arabic N+1
              const nextAyahNum = state.currentAyahNumber + 1;
              if (nextAyahNum <= state.arabicAyahQueue.length) {
                preloadNextAyah(state.arabicAyahQueue, nextAyahNum);
              }
            }
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

      // ── COMBINED MODE (Arabic + English) ────────────────────────────────
      if (state.currentLanguage === 'combined') {
        const {
          combinedAyahLang: lang,
          arabicAyahQueue: arQueue,
          englishQueue: enQueue,
          currentAyahNumber: ayahNum,
          currentSurahId: surahId,
        } = state;

        if (!ayahNum) return;

        const totalAyahs = arQueue?.length || enQueue?.length || 0;

        if (lang === 'arabic') {
          // Arabic N ended → play English N
          const englishAyahObj = enQueue?.find((a) => a.ayah === ayahNum);

          // Preload swap: if English N was already buffered, play immediately
          if (
            englishAyahObj &&
            preloadRef.current &&
            preloadRef.current.src === englishAyahObj.audioUrl
          ) {
            const preloadedSrc = preloadRef.current.src;
            if (audioRef.current && audioRef.current.src !== preloadedSrc) {
              audioRef.current.src = preloadedSrc;
              setCurrentTime(0);
              setIsLoadingAudio(false);
              audioRef.current.play().catch((e) => {
                if (e.name !== 'AbortError') setAudioError('Playback failed or was interrupted');
              });
            }
          }

          syncProgress('combined', surahId, 0, ayahNum, 'english');
          setCombinedAyahLang('english');
          // currentAyahNumber stays the same

        } else {
          // English N ended → Arabic N+1 (or next Surah)
          const nextAyah = ayahNum + 1;

          if (nextAyah <= totalAyahs) {
            const arabicAyahObj = arQueue?.find((a) => a.ayah === nextAyah);

            // Preload swap: if Arabic N+1 was already buffered, play immediately
            if (
              arabicAyahObj &&
              preloadRef.current &&
              preloadRef.current.src === arabicAyahObj.audioUrl
            ) {
              const preloadedSrc = preloadRef.current.src;
              if (audioRef.current && audioRef.current.src !== preloadedSrc) {
                audioRef.current.src = preloadedSrc;
                setCurrentTime(0);
                setIsLoadingAudio(false);
                audioRef.current.play().catch((e) => {
                  if (e.name !== 'AbortError') setAudioError('Playback failed or was interrupted');
                });
              }
            }

            syncProgress('combined', surahId, 0, nextAyah, 'arabic');
            setCombinedAyahLang('arabic');
            setCurrentAyahNumber(nextAyah);

          } else {
            // Last Ayah of Surah → advance to next Surah
            if (surahId < 114) {
              syncProgress('combined', surahId + 1, 0, 1, 'arabic');
              setCombinedAyahLang('arabic');
              setCurrentAyahNumber(null);
              setEnglishQueue(null);
              setArabicAyahQueue(null);
              setCurrentSurahId(surahId + 1);
            } else {
              setIsPlaying(false);
            }
          }
        }
        return;
      }

      // ── COMBINED-URDU MODE (Arabic + Urdu) ──────────────────────────────
      if (state.currentLanguage === 'combined-urdu') {
        const {
          combinedAyahLang: lang,
          arabicAyahQueue: arQueue,
          urduQueue: urQueue,
          currentAyahNumber: ayahNum,
          currentSurahId: surahId,
        } = state;

        if (!ayahNum) return;

        const totalAyahs = arQueue?.length || urQueue?.length || 0;

        if (lang === 'arabic') {
          // Arabic N ended → play Urdu N
          const urduAyahObj = urQueue?.find((a) => a.ayah === ayahNum);

          if (urduAyahObj) {
            // Preload swap: if Urdu N was already buffered, play immediately
            if (
              preloadRef.current &&
              preloadRef.current.src === urduAyahObj.audioUrl
            ) {
              const preloadedSrc = preloadRef.current.src;
              if (audioRef.current && audioRef.current.src !== preloadedSrc) {
                audioRef.current.src = preloadedSrc;
                setCurrentTime(0);
                setIsLoadingAudio(false);
                audioRef.current.play().catch((e) => {
                  if (e.name !== 'AbortError') setAudioError('Playback failed or was interrupted');
                });
              }
            }
            syncProgress('combined-urdu', surahId, 0, ayahNum, 'urdu');
            setCombinedAyahLang('urdu');
            // currentAyahNumber stays the same
          } else {
            // Missing Urdu ayah — skip directly to Arabic N+1
            console.warn(`[combined-urdu] Missing Urdu audio for surah ${surahId}, ayah ${ayahNum} — skipping`);
            const nextAyah = ayahNum + 1;
            if (nextAyah <= totalAyahs) {
              syncProgress('combined-urdu', surahId, 0, nextAyah, 'arabic');
              setCombinedAyahLang('arabic');
              setCurrentAyahNumber(nextAyah);
            } else if (surahId < 114) {
              syncProgress('combined-urdu', surahId + 1, 0, 1, 'arabic');
              setCombinedAyahLang('arabic');
              setCurrentAyahNumber(null);
              setUrduQueue(null);
              setArabicAyahQueue(null);
              setCurrentSurahId(surahId + 1);
            } else {
              setIsPlaying(false);
            }
          }

        } else {
          // Urdu N ended → Arabic N+1 (or next Surah)
          const nextAyah = ayahNum + 1;

          if (nextAyah <= totalAyahs) {
            const arabicAyahObj = arQueue?.find((a) => a.ayah === nextAyah);

            // Preload swap: if Arabic N+1 was already buffered, play immediately
            if (
              arabicAyahObj &&
              preloadRef.current &&
              preloadRef.current.src === arabicAyahObj.audioUrl
            ) {
              const preloadedSrc = preloadRef.current.src;
              if (audioRef.current && audioRef.current.src !== preloadedSrc) {
                audioRef.current.src = preloadedSrc;
                setCurrentTime(0);
                setIsLoadingAudio(false);
                audioRef.current.play().catch((e) => {
                  if (e.name !== 'AbortError') setAudioError('Playback failed or was interrupted');
                });
              }
            }

            syncProgress('combined-urdu', surahId, 0, nextAyah, 'arabic');
            setCombinedAyahLang('arabic');
            setCurrentAyahNumber(nextAyah);

          } else {
            // Last Ayah of Surah → advance to next Surah
            if (surahId < 114) {
              syncProgress('combined-urdu', surahId + 1, 0, 1, 'arabic');
              setCombinedAyahLang('arabic');
              setCurrentAyahNumber(null);
              setUrduQueue(null);
              setArabicAyahQueue(null);
              setCurrentSurahId(surahId + 1);
            } else {
              setIsPlaying(false);
            }
          }
        }
        return;
      }

      // ── ENGLISH MODE ────────────────────────────────────────────────────
      if (state.currentLanguage === 'english') {
        if (state.englishQueue && state.currentAyahNumber) {
          const nextAyah = state.currentAyahNumber + 1;

          if (nextAyah <= state.englishQueue.length) {
            // Preload swap
            const nextAyahObj = state.englishQueue.find((a) => a.ayah === nextAyah);
            if (
              nextAyahObj &&
              preloadRef.current &&
              preloadRef.current.src === nextAyahObj.audioUrl
            ) {
              const preloadedSrc = preloadRef.current.src;
              if (audioRef.current && audioRef.current.src !== preloadedSrc) {
                audioRef.current.src = preloadedSrc;
                setCurrentTime(0);
                setIsLoadingAudio(false);
                audioRef.current.play().catch((e) => {
                  if (e.name !== 'AbortError') {
                    console.error('Preloaded playback failed:', e);
                    setAudioError('Playback failed or was interrupted');
                  }
                });
              }
            }

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
        return;
      }

      // ── ARABIC MODE (whole-Surah) ────────────────────────────────────────
      if (state.currentSurahId < 114) {
        syncProgress('arabic', state.currentSurahId + 1, 0);
        setCurrentSurahId(state.currentSurahId + 1);
      } else {
        setIsPlaying(false);
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
          (state.currentLanguage === 'english' || state.currentLanguage === 'combined' || state.currentLanguage === 'combined-urdu')
            ? (state.currentAyahNumber || undefined)
            : undefined,
          (state.currentLanguage === 'combined' || state.currentLanguage === 'combined-urdu')
            ? (state.combinedAyahLang || undefined)
            : undefined,
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
        (currentLanguage === 'english' || currentLanguage === 'combined' || currentLanguage === 'combined-urdu')
          ? (currentAyahNumber || undefined)
          : undefined,
        (currentLanguage === 'combined' || currentLanguage === 'combined-urdu') ? (combinedAyahLang || undefined) : undefined,
      );
    }
  }, [isPlaying, currentLanguage, currentSurahId, currentAyahNumber, combinedAyahLang, syncProgress]);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH QUEUES (English / Urdu + Arabic per-Ayah for combined modes)
  // Runs once per Surah change, not per Ayah.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    if ((currentLanguage === 'english' || currentLanguage === 'combined') && currentSurahId) {
      setAudioError(null);

      // For combined: compute Arabic ayah queue synchronously (deterministic URLs, no fetch needed)
      if (currentLanguage === 'combined') {
        setArabicAyahQueue(getArabicSurahAyahAudio(currentSurahId));
      } else {
        setArabicAyahQueue(null);
      }

      async function fetchEnglishQueue() {
        const cacheKey = `english-${currentSurahId}`;
        const cached = queueCache[cacheKey];
        if (cached) {
          if (!('then' in cached)) {
            // Already resolved
            setEnglishQueue(cached as { ayah: number; audioUrl: string }[]);
            restoreEnglishAyah();
            return;
          } else {
            // In-flight — await the shared promise
            try {
              const ayahs = await (cached as Promise<{ ayah: number; audioUrl: string }[]>);
              if (!active) return;
              setEnglishQueue(ayahs);
              restoreEnglishAyah();
            } catch {
              if (!active) return;
              // Already handled by the original request's catch block
            }
            return;
          }
        }

        if (!englishQueue) setIsLoadingAudio(true);
        const fetchPromise = (async () => {
          let res: Response | null = null;
          for (let i = 0; i < 3; i++) {
            try {
              res = await fetch(`/api/quran/audio/english/${currentSurahId}`, {
                signal: controller.signal,
              });
              if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) break;
            } catch (err: any) {
              if (err.name === 'AbortError') throw err;
            }
            if (i < 2) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
          }
          if (!res) throw new Error('Network error');
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to load English audio');
          if (!data.ayahs) throw new Error('No ayahs in response');
          return data.ayahs as { ayah: number; audioUrl: string }[];
        })();

        queueCache[cacheKey] = fetchPromise;
        try {
          const ayahs = await fetchPromise;
          queueCache[cacheKey] = ayahs; // replace Promise with resolved value
          if (!active) return;
          setEnglishQueue(ayahs);
          restoreEnglishAyah();
        } catch (err: unknown) {
          delete queueCache[cacheKey]; // remove failed in-flight entry so next retry works
          if (!active) return;
          if (err instanceof Error && err.name === 'AbortError') return;
          console.error(err);
          setAudioError(err instanceof Error ? err.message : 'Failed to load audio');
          setIsPlaying(false);
        } finally {
          if (active) setIsLoadingAudio(false);
        }
      }

      function restoreEnglishAyah() {
        if (currentLanguage === 'english') {
          if (!currentAyahNumber || currentSurahId !== savedProgressRef.current.english?.surahId) {
            const saved = savedProgressRef.current.english;
            setCurrentAyahNumber(
              saved?.surahId === currentSurahId && saved.ayahId ? saved.ayahId : 1,
            );
          }
        } else if (currentLanguage === 'combined') {
          if (!currentAyahNumber) {
            const saved = savedProgressRef.current.combined;
            const startAyah =
              saved?.surahId === currentSurahId && saved.ayahId ? saved.ayahId : 1;
            const startLang: 'arabic' | 'english' =
              saved?.surahId === currentSurahId && saved.combinedLang
                ? (saved.combinedLang as 'arabic' | 'english')
                : 'arabic';
            setCurrentAyahNumber(startAyah);
            setCombinedAyahLang(startLang);
          }
        }
      }

      fetchEnglishQueue();

    } else if (currentLanguage === 'combined-urdu' && currentSurahId) {
      // ── COMBINED-URDU: Arabic queue (sync) + Urdu queue (sync, local CDN URLs) ──
      setAudioError(null);
      setArabicAyahQueue(getArabicSurahAyahAudio(currentSurahId));

      // Urdu URLs are fully deterministic — generated locally, no network call.
      // This is instantaneous and immune to API timeouts or rate limits.
      const cacheKey = `urdu-${currentSurahId}`;
      const cached = queueCache[cacheKey];
      if (cached && !('then' in cached)) {
        // Already resolved — use immediately (type assertion: cached is the array)
        setUrduQueue(cached as { ayah: number; audioUrl: string }[]);
        restoreUrduAyah();
      } else {
        try {
          const ayahs = getUrduSurahAudio(currentSurahId);
          queueCache[cacheKey] = ayahs;
          if (active) {
            setUrduQueue(ayahs);
            restoreUrduAyah();
          }
        } catch (err: unknown) {
          if (active) {
            console.error('[combined-urdu] Failed to generate Urdu queue:', err);
            setAudioError('Urdu audio unavailable for this Surah.');
          }
        }
      }

      function restoreUrduAyah() {
        if (!currentAyahNumber) {
          const saved = savedProgressRef.current['combined-urdu'];
          const startAyah =
            saved?.surahId === currentSurahId && saved.ayahId ? saved.ayahId : 1;
          const startLang: 'arabic' | 'urdu' =
            saved?.surahId === currentSurahId && saved.combinedLang === 'urdu'
              ? 'urdu'
              : 'arabic';
          setCurrentAyahNumber(startAyah);
          setCombinedAyahLang(startLang);
        }
      }


    } else if (currentLanguage !== 'english' && currentLanguage !== 'combined' && currentLanguage !== 'combined-urdu') {
      // Arabic-only mode: clear all per-Ayah queues
      setEnglishQueue(null);
      setUrduQueue(null);
      setArabicAyahQueue(null);
    }

    return () => {
      active = false;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSurahId, currentLanguage, retryCounter]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD AUDIO – fires when Ayah / Surah / Language changes
  // For ayah-based modes (English, Combined): does NOT set isLoadingAudio
  //   unless the preload element hasn't buffered yet, keeping the UI clean.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let activeListener: { event: string; fn: () => void } | null = null;
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

      // ── COMBINED (Arabic + English) ───────────────────────────────────────
      if (currentLanguage === 'combined') {
        if (!currentAyahNumber || !combinedAyahLang) return;

        const currentQueue =
          combinedAyahLang === 'arabic' ? arabicAyahQueue : englishQueue;
        if (!currentQueue) return;

        const ayahObj = currentQueue.find((a) => a.ayah === currentAyahNumber);
        if (!ayahObj) return;

        const preload = preloadRef.current;
        const preloadHasIt =
          preload && preload.src === ayahObj.audioUrl && preload.readyState >= 2;

        if (audioRef.current.src === ayahObj.audioUrl) {
          // Already loaded – just play
          applySeek();
          if (isPlaying) {
            audioRef.current.play().catch((e) => {
              if (e.name !== 'AbortError') setAudioError('Playback failed');
            });
          }
          return;
        }

        // Switch src. Only show loading state if the preload element isn't ready
        setAudioError(null);
        if (!preloadHasIt) setIsLoadingAudio(true);

        audioRef.current.src = ayahObj.audioUrl;
        setCurrentTime(0);

        const startPlayback = () => {
          applySeek();
          setIsLoadingAudio(false);
          if (isPlaying && active) {
            audioRef.current!.play().catch((e) => {
              if (e.name !== 'AbortError') {
                console.error('Combined playback failed:', e);
                setAudioError('Playback failed or was interrupted');
              }
            });
          }
        };

        if (preloadHasIt || audioRef.current.readyState >= 2) {
          startPlayback();
        } else {
          const onCanPlay = () => {
            if (audioRef.current) audioRef.current.removeEventListener('canplay', onCanPlay);
            if (!active) return;
            startPlayback();
          };
          activeListener = { event: 'canplay', fn: onCanPlay };
          audioRef.current.addEventListener('canplay', onCanPlay);
        }

        // Preload next item immediately
        if (combinedAyahLang === 'arabic' && englishQueue) {
          // While Arabic N plays → preload English N
          preloadNextAyah(englishQueue, currentAyahNumber);
        } else if (combinedAyahLang === 'english' && arabicAyahQueue) {
          // While English N plays → preload Arabic N+1
          const nextAyahNum = currentAyahNumber + 1;
          if (nextAyahNum <= arabicAyahQueue.length) {
            preloadNextAyah(arabicAyahQueue, nextAyahNum);
          }
        }
        return;
      }

      // ── COMBINED-URDU (Arabic + Urdu) ────────────────────────────────────
      if (currentLanguage === 'combined-urdu') {
        if (!currentAyahNumber || !combinedAyahLang) return;

        const currentQueue =
          combinedAyahLang === 'arabic' ? arabicAyahQueue : urduQueue;
        if (!currentQueue) return;

        const ayahObj = currentQueue.find((a) => a.ayah === currentAyahNumber);
        if (!ayahObj) return;

        const preload = preloadRef.current;
        const preloadHasIt =
          preload && preload.src === ayahObj.audioUrl && preload.readyState >= 2;

        if (audioRef.current.src === ayahObj.audioUrl) {
          // Already loaded – just play
          applySeek();
          if (isPlaying) {
            audioRef.current.play().catch((e) => {
              if (e.name !== 'AbortError') setAudioError('Playback failed');
            });
          }
          return;
        }

        // Switch src. Only show loading state if the preload element isn't ready
        setAudioError(null);
        if (!preloadHasIt) setIsLoadingAudio(true);

        audioRef.current.src = ayahObj.audioUrl;
        setCurrentTime(0);

        const startPlayback = () => {
          applySeek();
          setIsLoadingAudio(false);
          if (isPlaying && active) {
            audioRef.current!.play().catch((e) => {
              if (e.name !== 'AbortError') {
                console.error('Combined-Urdu playback failed:', e);
                setAudioError('Playback failed or was interrupted');
              }
            });
          }
        };

        if (preloadHasIt || audioRef.current.readyState >= 2) {
          startPlayback();
        } else {
          const onCanPlay = () => {
            if (audioRef.current) audioRef.current.removeEventListener('canplay', onCanPlay);
            if (!active) return;
            startPlayback();
          };
          activeListener = { event: 'canplay', fn: onCanPlay };
          audioRef.current.addEventListener('canplay', onCanPlay);
        }

        // Preload next item immediately
        if (combinedAyahLang === 'arabic' && urduQueue) {
          // While Arabic N plays → preload Urdu N
          preloadNextAyah(urduQueue, currentAyahNumber);
        } else if (combinedAyahLang === 'urdu' && arabicAyahQueue) {
          // While Urdu N plays → preload Arabic N+1
          const nextAyahNum = currentAyahNumber + 1;
          if (nextAyahNum <= arabicAyahQueue.length) {
            preloadNextAyah(arabicAyahQueue, nextAyahNum);
          }
        }
        return;
      }

      // ── ENGLISH ──────────────────────────────────────────────────────────
      if (currentLanguage === 'english') {
        if (!englishQueue || !currentAyahNumber) return;

        const ayahObj = englishQueue.find((a) => a.ayah === currentAyahNumber);
        if (!ayahObj) return;

        const preload = preloadRef.current;
        const preloadHasIt =
          preload && preload.src === ayahObj.audioUrl && preload.readyState >= 2;

        if (audioRef.current.src === ayahObj.audioUrl) {
          // Already loaded – just apply seek and play
          applySeek();
          if (isPlaying) {
            audioRef.current.play().catch((e) => {
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
            audioRef.current!.play().catch((e) => {
              if (e.name !== 'AbortError') {
                console.error('English playback failed:', e);
                setAudioError('Playback failed or was interrupted');
              }
            });
          }
        };

        if (preloadHasIt || audioRef.current.readyState >= 2) {
          startPlayback();
        } else {
          const onCanPlay = () => {
            if (audioRef.current) audioRef.current.removeEventListener('canplay', onCanPlay);
            if (!active) return;
            startPlayback();
          };
          activeListener = { event: 'canplay', fn: onCanPlay };
          audioRef.current.addEventListener('canplay', onCanPlay);
        }

        // Preload next Ayah immediately
        const nextAyahNum = currentAyahNumber + 1;
        if (nextAyahNum <= englishQueue.length) {
          preloadNextAyah(englishQueue, nextAyahNum);
        }
        return;
      }

      // ── ARABIC (whole-Surah) ─────────────────────────────────────────────
      setIsLoadingAudio(true);
      setAudioError(null);

      try {
        const res = await fetch(`/api/quran/audio/arabic/${currentSurahId}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          throw new Error(data.details || data.error || 'Failed to load audio');
        }

        if (data.audioUrl) {
          if (audioRef.current.src !== data.audioUrl) {
            audioRef.current.src = data.audioUrl;
            audioRef.current.load();
          }

          setIsLoadingAudio(false); // Network fetch complete

          if (pendingSeekRef.current > 0) {
            const seekTime = pendingSeekRef.current;
            pendingSeekRef.current = 0;
            const onLoadedMetaData = () => {
              if (audioRef.current) audioRef.current.removeEventListener('loadedmetadata', onLoadedMetaData);
              if (!active) return;
              audioRef.current!.currentTime = seekTime;
              setCurrentTime(seekTime);
            };
            activeListener = { event: 'loadedmetadata', fn: onLoadedMetaData };
            audioRef.current.addEventListener('loadedmetadata', onLoadedMetaData);
          } else {
            if (audioRef.current.readyState >= 1) {
              audioRef.current.currentTime = 0;
              setCurrentTime(0);
            } else {
              const onLoadedMetaData = () => {
                if (audioRef.current) audioRef.current.removeEventListener('loadedmetadata', onLoadedMetaData);
                if (!active) return;
                audioRef.current!.currentTime = 0;
                setCurrentTime(0);
              };
              activeListener = { event: 'loadedmetadata', fn: onLoadedMetaData };
              audioRef.current.addEventListener('loadedmetadata', onLoadedMetaData);
            }
          }

          if (isPlaying && active) {
            audioRef.current.play().catch((e) => {
              if (e.name !== 'AbortError') {
                console.error('Arabic playback failed:', e);
                setAudioError('Playback failed or was interrupted');
              }
            });
          }
        } else {
          throw new Error('No audio URL in response');
        }
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error(err);
        setAudioError(
          err instanceof Error ? err.message || 'Error loading audio' : 'Error loading audio',
        );
        setIsPlaying(false);
        setIsLoadingAudio(false);
      }
    }

    loadAudio();

    return () => {
      active = false;
      controller.abort();
      if (activeListener && audioRef.current) {
        audioRef.current.removeEventListener(activeListener.event, activeListener.fn);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentSurahId,
    currentLanguage,
    retryCounter,
    englishQueue,
    urduQueue,
    currentAyahNumber,
    preloadNextAyah,
    combinedAyahLang,
    arabicAyahQueue,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // PLAY / PAUSE sync
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && audioRef.current.src) {
      audioRef.current.play().catch((e) => {
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
    // Save progress for the currently playing item before switching
    if (currentLanguage && currentSurahId && audioRef.current) {
      syncProgress(
        currentLanguage,
        currentSurahId,
        audioRef.current.currentTime,
        (currentLanguage === 'english' || currentLanguage === 'combined' || currentLanguage === 'combined-urdu')
          ? (currentAyahNumber || undefined)
          : undefined,
        (currentLanguage === 'combined' || currentLanguage === 'combined-urdu') ? (combinedAyahLang || undefined) : undefined,
      );
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    // Clear preload element on explicit Surah/mode change
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
    setUrduQueue(null);
    setArabicAyahQueue(null);
    setCombinedAyahLang('arabic'); // always start from Arabic half in combined modes
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (currentSurahId) setIsPlaying((prev) => !prev);
  };

  const playNext = () => {
    if (currentSurahId !== null && currentSurahId < 114 && currentLanguage) {
      if (audioRef.current) {
        syncProgress(
          currentLanguage,
          currentSurahId,
          audioRef.current.currentTime,
          (currentLanguage === 'english' || currentLanguage === 'combined' || currentLanguage === 'combined-urdu')
            ? (currentAyahNumber || undefined)
            : undefined,
          (currentLanguage === 'combined' || currentLanguage === 'combined-urdu') ? (combinedAyahLang || undefined) : undefined,
        );
      }
      if (preloadRef.current) {
        preloadRef.current.src = '';
        preloadRef.current.load();
      }
      setCurrentSurahId(currentSurahId + 1);
      setCurrentAyahNumber(null);
      setEnglishQueue(null);
      setUrduQueue(null);
      setArabicAyahQueue(null);
      setCombinedAyahLang('arabic');
      setIsPlaying(true);
    }
  };

  const playPrevious = () => {
    if (currentSurahId !== null && currentSurahId > 1 && currentLanguage) {
      if (audioRef.current) {
        syncProgress(
          currentLanguage,
          currentSurahId,
          audioRef.current.currentTime,
          (currentLanguage === 'english' || currentLanguage === 'combined' || currentLanguage === 'combined-urdu')
            ? (currentAyahNumber || undefined)
            : undefined,
          (currentLanguage === 'combined' || currentLanguage === 'combined-urdu') ? (combinedAyahLang || undefined) : undefined,
        );
      }
      if (preloadRef.current) {
        preloadRef.current.src = '';
        preloadRef.current.load();
      }
      setCurrentSurahId(currentSurahId - 1);
      setCurrentAyahNumber(null);
      setEnglishQueue(null);
      setUrduQueue(null);
      setArabicAyahQueue(null);
      setCombinedAyahLang('arabic');
      setIsPlaying(true);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (currentLanguage && currentSurahId) {
        syncProgress(
          currentLanguage,
          currentSurahId,
          time,
          (currentLanguage === 'english' || currentLanguage === 'combined' || currentLanguage === 'combined-urdu')
            ? (currentAyahNumber || undefined)
            : undefined,
          (currentLanguage === 'combined' || currentLanguage === 'combined-urdu') ? (combinedAyahLang || undefined) : undefined,
        );
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
        arabicAyahQueue,
        urduQueue,
        currentAyahNumber,
        combinedAyahLang,
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
