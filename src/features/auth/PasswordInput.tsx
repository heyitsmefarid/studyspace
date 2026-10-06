import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Field';
import { passwordStrength, STRENGTH_LABELS } from './passwordStrength';

const STAR = 'M12 2c.6 4.4 1.9 5.7 6.3 6.3-4.4.6-5.7 1.9-6.3 6.3-.6-4.4-1.9-5.7-6.3-6.3C10.1 7.7 11.4 6.4 12 2z';

export function PasswordInput({ id, value, onChange, autoComplete, invalid, showStrength }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; showStrength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const score = passwordStrength(value);
  return (
    <div>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} invalid={invalid} value={value}
          onChange={(e) => onChange(e.target.value)} className="pr-11" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-ink-faint transition-colors hover:text-ink">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <span className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <svg key={n} viewBox="0 0 24 24" className={cn('size-3.5 transition-[color,scale,filter] duration-300 ease-float',
                n <= score ? 'scale-110 text-gold drop-shadow-[0_0_4px_var(--gold)]' : 'text-line-strong')}>
                <path d={STAR} fill="currentColor" />
              </svg>
            ))}
          </span>
          <span className="text-xs text-ink-muted">{score === 0 ? 'At least 8 characters' : `${STRENGTH_LABELS[score]} password`}</span>
        </div>
      )}
    </div>
  );
}
