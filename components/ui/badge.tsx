import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'success' | 'danger' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink/5 text-ink',
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger'
  };
  return <span className={cn('badge', tones[tone], className)} {...props} />;
}

