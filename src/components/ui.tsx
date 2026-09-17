import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, Inbox } from 'lucide-react';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'up' | 'down';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-500',
    secondary: 'bg-panel text-txt hover:bg-panel/70 border border-line',
    outline: 'border border-line text-txt hover:bg-panel',
    ghost: 'text-muted hover:text-txt hover:bg-panel',
    up: 'bg-up text-white hover:brightness-110',
    down: 'bg-down text-white hover:brightness-110',
  };
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: 'neutral' | 'up' | 'down' | 'accent';
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-panel text-muted border-line',
    up: 'bg-up/10 text-up border-up/20',
    down: 'bg-down/10 text-down border-down/20',
    accent: 'bg-primary-500/10 text-primary-600 border-primary-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-panel ${className}`} />;
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="rounded-full bg-panel p-3 text-muted">
        <Inbox size={24} />
      </div>
      <p className="font-semibold">{title}</p>
      {message && <p className="max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
