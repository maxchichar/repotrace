import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]',
        className,
      )}
      {...props}
    />
  );
}
