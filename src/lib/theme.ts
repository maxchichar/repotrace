export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'repotrace-theme';

// Runs before the body paints, so saved/system dark mode never flashes light.
// The string is static application code; no report or user content is interpolated.
export const themeBootstrap = `(function(){var t;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})();`;
let memoryPreference: Theme | undefined;
function preference(): Theme | undefined {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* A blocked store must not prevent switching themes. */
  }
  return memoryPreference;
}
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event('repotrace-theme-change'));
}
export function setTheme(theme: Theme) {
  memoryPreference = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Session-only fallback. */
  }
  apply(theme);
}
export function themeSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
export function serverThemeSnapshot(): Theme {
  return 'light';
}
export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const systemChanged = () => apply(preference() ?? (media.matches ? 'dark' : 'light'));
  const storageChanged = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    memoryPreference = undefined;
    systemChanged();
  };
  window.addEventListener('repotrace-theme-change', onChange);
  window.addEventListener('storage', storageChanged);
  media.addEventListener('change', systemChanged);
  return () => {
    window.removeEventListener('repotrace-theme-change', onChange);
    window.removeEventListener('storage', storageChanged);
    media.removeEventListener('change', systemChanged);
  };
}
