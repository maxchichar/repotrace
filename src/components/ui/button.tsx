import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-[var(--success)] text-white hover:bg-[var(--success-hover)] shadow-sm',
        outline:
          'border border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--fg-default)] hover:bg-[var(--surface-muted)]',
        ghost: 'text-[var(--fg-muted)] hover:bg-[var(--surface-muted)]',
      },
      size: { default: 'h-11 px-4', sm: 'h-9 px-3', icon: 'size-11' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
