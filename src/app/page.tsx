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

        {/* Choices Section */}
        <div className="flex flex-col md:flex-row gap-8 w-full justify-center px-4">
          <Link
            href="/listen/arabic"
            className="flex-1 group flex flex-col items-center justify-center p-14 border border-neutral-100 dark:border-neutral-800 rounded-3xl hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm dark:hover:bg-neutral-900 bg-white dark:bg-[#111] transition-all duration-300 ease-out"
          >
            <span className="text-4xl md:text-5xl mb-6 text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white transition-colors">
              العربية
            </span>
            <span className="text-sm font-medium tracking-wider text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors uppercase">
              Arabic Recitation
            </span>
          </Link>

          <Link
            href="/listen/english"
            className="flex-1 group flex flex-col items-center justify-center p-14 border border-neutral-100 dark:border-neutral-800 rounded-3xl hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm dark:hover:bg-neutral-900 bg-white dark:bg-[#111] transition-all duration-300 ease-out"
          >
            <span className="text-4xl md:text-5xl font-light mb-6 text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white transition-colors">
              English
            </span>
            <span className="text-sm font-medium tracking-wider text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors uppercase">
              English Translation
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
