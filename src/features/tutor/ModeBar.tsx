import { Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/Field';
import { DIFFICULTIES, TUTOR_MODES, type Difficulty, type TutorMode } from '@/services/ai/schemas';
import { MODE_META } from './modes';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export function ModeBar({ mode, onMode, difficulty, onDifficulty, fast, onFast }: {
  mode: TutorMode; onMode: (m: TutorMode) => void; difficulty: Difficulty; onDifficulty: (d: Difficulty) => void;
  fast: boolean; onFast: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Tutor mode" className="flex gap-1.5 overflow-x-auto pb-1">
        {TUTOR_MODES.map((m) => {
          const meta = MODE_META[m];
          const Icon = meta.icon;
          const on = m === mode;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onMode(m)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition',
                on ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
              )}
            >
              <Icon className="size-4" aria-hidden /> {meta.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Difficulty" value={difficulty} onChange={(e) => onDifficulty(e.target.value as Difficulty)} className="h-9 w-auto text-sm">
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
        </Select>
        <button
          type="button"
          role="switch"
          aria-checked={fast}
          onClick={() => onFast(!fast)}
          title="Fast answers use Groq; Gemini is the default for depth."
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition',
            fast ? 'border-gold bg-gold-soft text-gold' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
          )}
        >
          <Zap className="size-4" aria-hidden /> Fast {fast ? 'on' : 'off'}
        </button>
      </div>
    </div>
  );
}
