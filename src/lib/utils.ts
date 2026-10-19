import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const number = (n: number) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(n);
export const percent = (n: number) => `${n.toFixed(1)}%`;
export const shortDate = (s: string) =>
  new Date(s).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
