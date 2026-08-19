import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6 selection:bg-neutral-100 dark:selection:bg-neutral-800 transition-colors duration-500">
      
      <div className="absolute top-8 right-6">
        <ThemeToggle />
      </div>

      <main className="max-w-2xl w-full flex flex-col items-center">
        {/* Header Section */}
        <div className="text-center mb-24 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-light tracking-wide mb-6">
            Quran
          </h1>
          <p className="text-neutral-400 dark:text-neutral-500 text-lg md:text-xl font-light tracking-[0.2em] uppercase">
            Listen. Reflect.
          </p>
        </div>

        {/* Mode Selection */}
        <div className="w-full px-4">
          <p className="text-center text-xs font-medium tracking-widest uppercase text-neutral-400 dark:text-neutral-500 mb-8">
            What would you like to listen to?
          </p>

          <div className="flex flex-col gap-4 w-full">
            {/* Arabic Recitation */}
            <Link
              href="/listen/arabic"
              className="group flex items-center justify-between p-6 border border-neutral-100 dark:border-neutral-800 rounded-2xl hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm dark:hover:bg-neutral-900 bg-white dark:bg-[#111] transition-all duration-300 ease-out"
            >
              <div className="flex flex-col">
                <span className="text-2xl font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white transition-colors mb-1">
                  العربية
                </span>
                <span className="text-xs font-medium tracking-wider text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors uppercase">
                  Arabic Recitation
                </span>
              </div>
              <svg
                className="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-400 dark:group-hover:text-neutral-500 transition-colors"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </Link>

            {/* English Translation */}
            <Link
              href="/listen/english"
              className="group flex items-center justify-between p-6 border border-neutral-100 dark:border-neutral-800 rounded-2xl hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm dark:hover:bg-neutral-900 bg-white dark:bg-[#111] transition-all duration-300 ease-out"
            >
              <div className="flex flex-col">
                <span className="text-2xl font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white transition-colors mb-1">
                  English
                </span>
                <span className="text-xs font-medium tracking-wider text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors uppercase">
                  English Translation
                </span>
              </div>
              <svg
                className="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-400 dark:group-hover:text-neutral-500 transition-colors"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </Link>

            {/* Arabic + English Combined */}
            <Link
              href="/listen/combined"
              className="group flex items-center justify-between p-6 border border-neutral-100 dark:border-neutral-800 rounded-2xl hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm dark:hover:bg-neutral-900 bg-white dark:bg-[#111] transition-all duration-300 ease-out"
            >
              <div className="flex flex-col">
                <span className="text-2xl font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white transition-colors mb-1">
                  العربية · English
                </span>
                <span className="text-xs font-medium tracking-wider text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors uppercase">
                  Arabic Recitation · English Translation
                </span>
              </div>
              <svg
                className="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-400 dark:group-hover:text-neutral-500 transition-colors"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </Link>

            {/* Arabic + Urdu Combined */}
            <Link
              href="/listen/combined-urdu"
              className="group flex items-center justify-between p-6 border border-neutral-100 dark:border-neutral-800 rounded-2xl hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm dark:hover:bg-neutral-900 bg-white dark:bg-[#111] transition-all duration-300 ease-out"
            >
              <div className="flex flex-col">
                <span className="text-2xl font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white transition-colors mb-1 font-arabic">
                  العربية · اردو
                </span>
                <span className="text-xs font-medium tracking-wider text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors uppercase">
                  Arabic Recitation · Urdu Translation
                </span>
              </div>
              <svg
                className="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-400 dark:group-hover:text-neutral-500 transition-colors"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
