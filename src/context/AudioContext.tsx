'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
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

// Abstract function for audio source
function getSurahAudio(language: Language, surahNumber: number) {
  return `/test.ogg?lang=${language}&surah=${surahNumber}`;
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
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [englishQueue, setEnglishQueue] = useState<{ayah: number, audioUrl: string}[] | null>(null);
  const [currentAyahNumber, setCurrentAyahNumber] = useState<number | null>(null);

  const [savedProgress, setSavedProgress] = useState<Record<Language, SavedProgress | null>>({ arabic: null, english: null });
  const savedProgressRef = useRef(savedProgress);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number>(0);

  // Load progress on mount
  useEffect(() => {
    const loaded = loadProgressFromStorage();
    setSavedProgress(loaded);
    savedProgressRef.current = loaded;
  }, []);

  // Update ref whenever savedProgress changes to use in unmount handler
  useEffect(() => {
    savedProgressRef.current = savedProgress;
  }, [savedProgress]);

  const [retryCounter, setRetryCounter] = useState(0);

  const retryAudio = () => setRetryCounter(c => c + 1);

  // Sync progress function
  const syncProgress = (lang: Language, surahId: number, time: number, ayahId?: number) => {
    setSavedProgress((prev) => {
      const next = { ...prev, [lang]: { surahId, position: time, ayahId } };
      saveProgressToStorage(next);
      return next;
    });
  };

  // Debounced save for timeupdate (e.g., every 5 seconds)
  const lastSaveTimeRef = useRef(0);

  // Use refs for latest state so event listeners don't need re-binding
  const stateRef = useRef({ currentLanguage, currentSurahId, currentAyahNumber, englishQueue, isPlaying });
  useEffect(() => {
    stateRef.current = { currentLanguage, currentSurahId, currentAyahNumber, englishQueue, isPlaying };
  }, [currentLanguage, currentSurahId, currentAyahNumber, englishQueue, isPlaying]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      const state = stateRef.current;
      if (state.currentLanguage && state.currentSurahId) {
        const now = Date.now();
        if (now - lastSaveTimeRef.current > 5000) {
          syncProgress(state.currentLanguage, state.currentSurahId, audio.currentTime, state.currentLanguage === 'english' ? (state.currentAyahNumber || undefined) : undefined);
          lastSaveTimeRef.current = now;
        }
      }
    };
    
    const handleDurationChange = () => setDuration(audio.duration);
    
    const handleEnded = () => {
      const state = stateRef.current;
      if (state.currentLanguage && state.currentSurahId) {
        if (state.currentLanguage === 'english') {
          // English: Ayah-level progression
          if (state.englishQueue && state.currentAyahNumber) {
            if (state.currentAyahNumber < state.englishQueue.length) {
              console.log('Next Ayah:', state.currentAyahNumber + 1, 'of', state.englishQueue.length);
              // Next Ayah
              const nextAyah = state.currentAyahNumber + 1;
              syncProgress('english', state.currentSurahId, 0, nextAyah);
              setCurrentAyahNumber(nextAyah);
            } else {
              console.log('Next Surah! currentAyahNumber:', state.currentAyahNumber, 'length:', state.englishQueue.length);
              // Next Surah
              if (state.currentSurahId < 114) {
                syncProgress('english', state.currentSurahId + 1, 0, 1);
                setCurrentAyahNumber(null); // will be reset by the queue fetcher
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
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    
    const logEvent = (e: Event) => console.log(`Audio Event: ${e.type}, src: ${audio.src}, currentTime: ${audio.currentTime}, readyState: ${audio.readyState}, error: ${audio.error ? audio.error.code : 'none'}`);
    ['play', 'playing', 'pause', 'error', 'waiting', 'stalled', 'suspend', 'abort', 'emptied', 'loadedmetadata'].forEach(evt => {
      audio.addEventListener(evt, logEvent);
    });
    
    const handleBeforeUnload = () => {
      const state = stateRef.current;
      if (state.currentLanguage && state.currentSurahId && audio) {
        syncProgress(state.currentLanguage, state.currentSurahId, audio.currentTime, state.currentLanguage === 'english' ? (state.currentAyahNumber || undefined) : undefined);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Run only once on mount

  // Save on pause or unmount
  useEffect(() => {
    if (!isPlaying && currentLanguage && currentSurahId && audioRef.current) {
      syncProgress(currentLanguage, currentSurahId, audioRef.current.currentTime, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
    }
  }, [isPlaying, currentLanguage, currentSurahId, currentAyahNumber]);

  // Fetch English Queue
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (currentLanguage === 'english' && currentSurahId) {
      async function fetchQueue() {
        setIsLoadingAudio(true);
        setAudioError(null);
        try {
          const res = await fetch(`/api/quran/audio/english/${currentSurahId}`, { signal: controller.signal });
          const data = await res.json();
          if (!active) return;
          if (!res.ok) throw new Error(data.error || 'Failed to load English audio');
          if (data.ayahs) {
            setEnglishQueue(data.ayahs);
            // Restore ayah if needed, otherwise 1
            if (!currentAyahNumber || pendingSeekRef.current > 0 || currentSurahId !== savedProgressRef.current.english?.surahId) {
               const saved = savedProgressRef.current.english;
               setCurrentAyahNumber(saved?.surahId === currentSurahId && saved.ayahId ? saved.ayahId : 1);
            }
          }
        } catch (err: any) {
          if (!active) return;
          if (err.name === 'AbortError') return;
          console.error(err);
          setAudioError(err.message);
          setIsPlaying(false);
        } finally {
          if (active) setIsLoadingAudio(false);
        }
      }
      fetchQueue();
    } else {
      setEnglishQueue(null);
    }
    return () => { 
      active = false; 
      controller.abort();
    };
  }, [currentSurahId, currentLanguage, retryCounter]); // Retry will re-fetch the queue if it fails

  // Handle source changes and playback
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
      if (currentSurahId && currentLanguage && audioRef.current) {
        if (currentLanguage === 'english') {
          if (!englishQueue || !currentAyahNumber) return;
          const ayahObj = englishQueue.find(a => a.ayah === currentAyahNumber);
          if (ayahObj) {
            if (audioRef.current.src !== ayahObj.audioUrl) {
              setAudioError(null);
              setIsLoadingAudio(true);
              audioRef.current.src = ayahObj.audioUrl;
              setCurrentTime(0);

              if (audioRef.current.readyState >= 1) {
                applySeek();
                setIsLoadingAudio(false);
              } else {
                const onLoadedMetaData = () => {
                  applySeek();
                  setIsLoadingAudio(false);
                  audioRef.current!.removeEventListener('loadedmetadata', onLoadedMetaData);
                };
                audioRef.current.addEventListener('loadedmetadata', onLoadedMetaData);
              }

              if (isPlaying) {
                audioRef.current.play().catch(e => {
                  if (e.name !== 'AbortError') {
                    console.error("Playback failed:", e);
                    setAudioError("Playback failed or was interrupted");
                  }
                });
              }
            }
          }
          return;
        }

        // Real Arabic audio fetch
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
              setIsLoadingAudio(true);
              audioRef.current.src = data.audioUrl;
              setCurrentTime(0);

              if (audioRef.current.readyState >= 1) {
                applySeek();
                setIsLoadingAudio(false);
              } else {
                const onLoadedMetaData = () => {
                  applySeek();
                  setIsLoadingAudio(false);
                  audioRef.current!.removeEventListener('loadedmetadata', onLoadedMetaData);
                };
                audioRef.current.addEventListener('loadedmetadata', onLoadedMetaData);
              }

              if (isPlaying) {
                audioRef.current.play().catch(e => {
                  if (e.name !== 'AbortError') {
                    console.error("Playback failed:", e);
                    setAudioError("Playback failed or was interrupted");
                  }
                });
              }
            }
          } else {
             throw new Error('No audio URL in response');
          }
        } catch (err: any) {
          if (!active) return;
          if (err.name === 'AbortError') return;
          console.error(err);
          setAudioError(err.message || 'Error loading audio');
          setIsPlaying(false);
        } finally {
          if (active) setIsLoadingAudio(false);
        }
      }
    }

    loadAudio();

    return () => { 
      active = false; 
      controller.abort();
    };
  }, [currentSurahId, currentLanguage, retryCounter, englishQueue, currentAyahNumber]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && audioRef.current.src) {
        audioRef.current.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Playback failed:", e);
            setIsPlaying(false);
          }
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const playSurah = (id: number, language: Language, startTime: number = 0) => {
    console.log(`[Timing] playSurah initiated for ${language} ${id}`);
    console.time(`AudioReady-${language}-${id}`);
    if (currentLanguage && currentSurahId && audioRef.current) {
      // Save progress of current before switching
      syncProgress(currentLanguage, currentSurahId, audioRef.current.currentTime, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
      
      // Stop old audio immediately to avoid 4-5s delay or overlapping fetches
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    
    pendingSeekRef.current = startTime;
    setCurrentLanguage(language);
    setCurrentSurahId(id);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (currentSurahId) {
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (currentSurahId !== null && currentSurahId < 114 && currentLanguage) {
      if (audioRef.current) {
        syncProgress(currentLanguage, currentSurahId, audioRef.current.currentTime, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
      }
      setCurrentSurahId(currentSurahId + 1);
      if (currentLanguage === 'english') {
        setCurrentAyahNumber(null);
      }
      setIsPlaying(true);
    }
  };

  const playPrevious = () => {
    if (currentSurahId !== null && currentSurahId > 1 && currentLanguage) {
      if (audioRef.current) {
        syncProgress(currentLanguage, currentSurahId, audioRef.current.currentTime, currentLanguage === 'english' ? (currentAyahNumber || undefined) : undefined);
      }
      setCurrentSurahId(currentSurahId - 1);
      if (currentLanguage === 'english') {
        setCurrentAyahNumber(null);
      }
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
        retryAudio
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
