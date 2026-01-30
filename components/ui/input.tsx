import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-11 w-full rounded-xl border border-ink/15 bg-white/80 px-3 text-sm text-ink shadow-sm outline-none focus:border-ink/40 focus:ring-2 focus:ring-accent/20',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

