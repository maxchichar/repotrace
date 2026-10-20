'use client';
import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { serverThemeSnapshot, setTheme, subscribeTheme, themeSnapshot } from '@/lib/theme';

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, serverThemeSnapshot);
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} mode`;
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
