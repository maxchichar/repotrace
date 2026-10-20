import * as React from 'react';
import { cn } from '@/lib/utils';
export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-md border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg-default)] shadow-xs outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
