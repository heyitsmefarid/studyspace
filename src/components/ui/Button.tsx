import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg' | 'icon';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[linear-gradient(135deg,var(--primary),var(--primary-2))] text-primary-ink shadow-glow hover:-translate-y-px hover:shadow-[0_0_0_4px_var(--primary-soft),var(--glow)]',
  secondary: 'bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-raised',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-coral-soft text-coral hover:bg-coral hover:text-primary-ink',
  gold: 'bg-gold-soft text-gold hover:-translate-y-px hover:shadow-[0_0_0_4px_var(--gold-soft)]',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-11 w-11 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean; done?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, done, disabled, className, children, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center rounded-xl font-semibold transition-[translate,scale,box-shadow,background-color,border-color,color,filter] duration-200 ease-soft active:scale-[0.97] active:duration-[120ms] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {done && !loading && <Check className="size-4 animate-pop-in" aria-hidden />}
      {children}
    </button>
  );
});
