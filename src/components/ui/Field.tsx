import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control = 'w-full rounded-xl border border-line bg-surface-2 px-3 text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] duration-200 ease-soft focus:border-primary focus:shadow-[0_0_0_4px_var(--primary-soft)] focus:outline-none aria-[invalid=true]:border-coral';

/** Label + control + hint/error. `children` receives the generated id for the control. */
export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; children: (id: string) => ReactNode; className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      {error && <p role="alert" className="text-xs text-coral">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, 'h-11', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, 'min-h-24 py-2.5', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, ...rest }, ref) {
    return <select ref={ref} aria-invalid={invalid || undefined} className={cn(control, 'h-11 pr-8', className)} {...rest} />;
  },
);
