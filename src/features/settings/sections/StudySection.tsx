import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdatePreferences } from '@/features/auth/useProfileMutations';
import type { Preferences } from '@/lib/preferences';

type Study = Preferences['study'];
const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
const NUMBERS: { key: keyof Omit<Study, 'preferredTimes'>; label: string; min: number; max: number }[] = [
  { key: 'focusMin', label: 'Focus minutes', min: 5, max: 120 },
  { key: 'shortMin', label: 'Short break minutes', min: 1, max: 30 },
  { key: 'longMin', label: 'Long break minutes', min: 5, max: 60 },
  { key: 'longEvery', label: 'Long break every N focus blocks', min: 2, max: 8 },
  { key: 'newCardsPerDay', label: 'New flashcards per day', min: 0, max: 200 },
  { key: 'dailyGoalMin', label: 'Daily study goal (minutes)', min: 10, max: 600 },
];

export function StudySection() {
  const { preferences } = useAuth();
  const update = useUpdatePreferences();
  const [study, setStudy] = useState<Study>(preferences.study);

  const toggleTime = (t: (typeof TIMES)[number]) => setStudy((s) => {
    const has = s.preferredTimes.includes(t);
    const next = has ? s.preferredTimes.filter((x) => x !== t) : [...s.preferredTimes, t];
    return { ...s, preferredTimes: next.length ? next : s.preferredTimes };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {NUMBERS.map(({ key, label, min, max }) => (
          <Field key={key} label={label}>
            {(id) => <Input id={id} type="number" min={min} max={max} value={study[key]}
              onChange={(e) => setStudy((s) => ({ ...s, [key]: Number(e.target.value) }))} />}
          </Field>
        ))}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Preferred study times</p>
        <div className="flex flex-wrap gap-2">
          {TIMES.map((t) => (
            <button key={t} onClick={() => toggleTime(t)} aria-pressed={study.preferredTimes.includes(t)}
              className={cn('rounded-full border px-3 py-1.5 text-sm capitalize',
                study.preferredTimes.includes(t) ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-muted')}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <Button className="self-start" loading={update.isPending}
        onClick={async () => { await update.mutateAsync({ study }); toast.success('Study preferences saved'); }}>
        Save
      </Button>
    </div>
  );
}
