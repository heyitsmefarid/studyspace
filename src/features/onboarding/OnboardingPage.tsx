import { useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyMessage, assertOk } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { Logo } from '@/components/sky/Logo';
import { StarBackdrop } from '@/features/auth/LoginPage';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdateProfile } from '@/features/auth/useProfileMutations';
import { ColorSwatches } from '@/features/subjects/SubjectPicker';
import { SUBJECT_COLORS, nextSubjectColor } from '@/features/subjects/colors';
import { buildWelcomeNote } from './welcomeNote';

const STAR_COLORS = ['#7CC4FF', '#FF9ECF', ...SUBJECT_COLORS];
const SUGGESTIONS = ['Biology', 'Chemistry', 'Math', 'Physics', 'History', 'English'];
const STEPS = ['Name your star', 'Pick your star colour', 'Your subjects', 'Your timezone'] as const;

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['Asia/Manila', 'UTC'];
  }
}

function StepStars({ step }: { step: number }) {
  return (
    <svg viewBox="0 0 160 24" className="h-6 w-40" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      <polyline points="10,16 60,6 110,14 150,8" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
      {[[10, 16], [60, 6], [110, 14], [150, 8]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i <= step ? 4 : 3} fill={i <= step ? 'var(--gold)' : 'var(--ink-faint)'}
          style={i <= step ? { filter: 'drop-shadow(0 0 6px var(--gold))' } : undefined} />
      ))}
    </svg>
  );
}

export default function OnboardingPage() {
  const { profile, user, refreshProfile } = useAuth();
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [color, setColor] = useState(profile?.star_color ?? STAR_COLORS[0]!);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => timezones(), []);

  const addSubject = (raw: string) => {
    const s = raw.trim().slice(0, 60);
    if (!s || subjects.length >= 12 || subjects.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    setSubjects((list) => [...list, s]);
    setDraft('');
  };
  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSubject(draft); }
  };

  async function finish() {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      await updateProfile.mutateAsync({ display_name: name.trim(), star_color: color, timezone: tz });
      const { data: existing } = await supabase.from('subjects').select('name, color').eq('owner_id', user.id);
      const used = (existing ?? []).map((s) => s.color);
      const have = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
      const rows = subjects.filter((s) => !have.has(s.toLowerCase())).map((s) => {
        const c = nextSubjectColor(used);
        used.push(c);
        return { owner_id: user.id, name: s, color: c };
      });
      if (rows.length) assertOk(await supabase.from('subjects').insert(rows));
      assertOk(await supabase.from('notes').insert({ owner_id: user.id, ...buildWelcomeNote(name.trim()) }));
      await updateProfile.mutateAsync({ onboarded_at: new Date().toISOString() });
      await refreshProfile();
      toast.success('Your sky is ready ✦');
      navigate('/', { replace: true });
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canNext = step === 0 ? name.trim().length > 0 && name.trim().length <= 40 : true;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <StarBackdrop />
      <Card className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-between"><Logo size="sm" /><StepStars step={step} /></div>
        <h1 className="mt-6 font-display text-2xl">{STEPS[step]}</h1>

        <div className="mt-5 min-h-48">
          {step === 0 && (
            <Field label="What should we call you?" hint="Your partner sees this name.">
              {(id) => <Input id={id} autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canNext) setStep(1); }} />}
            </Field>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <ColorSwatches value={color} onChange={setColor} colors={STAR_COLORS} />
              <div className="relative h-28 overflow-hidden rounded-2xl border border-line bg-surface-2" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className="absolute rounded-full animate-twinkle"
                    style={{ left: `${8 + ((i * 37) % 84)}%`, top: `${12 + ((i * 53) % 70)}%`, width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
                      background: color, boxShadow: `0 0 10px ${color}`, animationDelay: `${(i % 5) * 0.4}s` }} />
                ))}
              </div>
              <p className="text-sm text-ink-muted">Every study session becomes a star in this colour.</p>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <Field label="Add a subject" hint="Press Enter after each one (up to 12).">
                {(id) => <Input id={id} value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} onKeyDown={onDraftKey} placeholder="e.g. Biology" />}
              </Field>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-sm text-primary">
                    {s}
                    <button onClick={() => setSubjects((l) => l.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X className="size-3.5" /></button>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.filter((s) => !subjects.includes(s)).map((s) => (
                  <button key={s} onClick={() => addSubject(s)} className="rounded-full border border-line px-3 py-1 text-sm text-ink-muted hover:border-line-strong">+ {s}</button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <Field label="Timezone" hint="Streaks and daily limits follow your local midnight.">
              {(id) => (
                <Select id={id} value={tz} onChange={(e) => setTz(e.target.value)}>
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </Select>
              )}
            </Field>
          )}
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-coral">{error}</p>}
        <div className="mt-6 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>Back</Button>
          {step < STEPS.length - 1
            ? <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Next</Button>
            : <Button onClick={finish} loading={busy}>Light up my sky</Button>}
        </div>
      </Card>
    </main>
  );
}
