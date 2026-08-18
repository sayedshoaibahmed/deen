import React from 'react';
import Link from 'next/link';

export default function AttributionPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#111] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center p-8 transition-colors duration-500">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-8">
          Sources & Attribution
        </h1>
        
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-8 md:p-12 text-left mb-8 transition-colors duration-500">
          <h2 className="text-xl font-medium mb-4">English Quran Translation & Audio</h2>
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
            The English audio translation and the Ayah-level translation captions used in this application are both provided by the Rowwad Translation Center, via QuranEnc.
          </p>
          <ul className="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
            <li>
              <strong className="text-neutral-900 dark:text-neutral-100">Translation:</strong> English Translation — Rowwad Translation Center
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-neutral-100">Audio & Text Source:</strong>{' '}
              <a href="https://quranenc.com" target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white underline decoration-neutral-300 dark:decoration-neutral-700 underline-offset-4 transition-colors">QuranEnc</a>
            </li>
            <li>
              <strong className="text-neutral-900 dark:text-neutral-100">Translation key:</strong>{' '}
              <code className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">english_rwwad</code>
            </li>
          </ul>
        </div>
        
        <Link 
          href="/"
          className="inline-flex items-center text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
