'use client';

import React from 'react';
import { AudioProvider } from '../context/AudioContext';
import { BottomPlayer } from './BottomPlayer';
import { ThemeProvider } from '../context/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AudioProvider>
        {children}
        <BottomPlayer />
      </AudioProvider>
    </ThemeProvider>
  );
}
