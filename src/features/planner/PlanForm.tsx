import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { ClipboardList, Plus, Sparkles, Star, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { STUDY_TIMES, StudyPlanInputSchema, type StudyPlanInput } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { todayInZone } from '@/features/gamification/streak';
import { SubjectPicker } from '@/features/subjects/SubjectPicker';
import { subjectById, useSubjects } from '@/features/subjects/api';

type StudyTime = (typeof STUDY_TIMES)[number];
export type PlanRequest = Extract<ReturnType<typeof StudyPlanInputSchema.safeParse>, { success: true }>['data'];
interface TopicRow { key: string; name: string; confidence: number }

const TIME_LABEL: Record<StudyTime, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };
const CONFIDENCE = ['Lost', 'Shaky', 'Okay', 'Good', 'Solid'];
const row = (name = '', confidence = 3): TopicRow => ({ key: crypto.randomUUID(), name, confidence });

function Confidence({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={`How confident are you in ${label || 'this topic'}?`} className="flex shrink-0 items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} — ${CONFIDENCE[n - 1]}`} title={CONFIDENCE[n - 1]}
          onClick={() => onChange(n)} className="grid size-7 place-items-center rounded">
          <Star className={cn('size-4', n <= value ? 'fill-gold text-gold' : 'text-ink-faint')} aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function PlanForm({ onSubmit, busy, initial }: {
  onSubmit: (input: PlanRequest, meta: { subjectId: string | null }) => void; busy: boolean;
  initial?: { subjectId: string | null; inputs: Partial<StudyPlanInput> };
}) {
  const { profile, preferences } = useAuth();
  const subjects = useSubjects();
  const [subjectId, setSubjectId] = useState<string | null>(initial?.subjectId ?? null);
  const [subjectName, setSubjectName] = useState(initial?.subjectId ? '' : initial?.inputs.subject ?? '');
  const [examDate, setExamDate] = useState(initial?.inputs.examDate ?? '');
  const [topics, setTopics] = useState<TopicRow[]>(() => initial?.inputs.topics?.map((t) => row(t.name, t.confidence)) ?? [row()]);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState('');
  const [hours, setHours] = useState(initial?.inputs.hoursPerDay ?? Math.max(0.5, Math.round(preferences.study.dailyGoalMin / 30) / 2));
  const [times, setTimes] = useState<StudyTime[]>(initial?.inputs.preferredTimes ?? preferences.study.preferredTimes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tomorrow] = useState(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'));

  const patchTopic = (key: string, p: Partial<TopicRow>) => setTopics(topics.map((t) => (t.key === key ? { ...t, ...p } : t)));
  const addPasted = () => {
    const names = paste.split(/\r?\n/).map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    const kept = topics.filter((t) => t.name.trim());
    setTopics([...kept, ...names.map((n) => row(n.slice(0, 120)))].slice(0, 30));
    setPaste('');
    setPasting(false);
  };

  function submit() {
    const subject = subjectId ? subjectById(subjects.data, subjectId)?.name ?? '' : subjectName.trim();
    const parsed = StudyPlanInputSchema.safeParse({
      subject, today: todayInZone(profile?.timezone ?? 'Asia/Manila'), examDate,
      topics: topics.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim(), confidence: t.confidence })),
      hoursPerDay: hours, preferredTimes: times,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const key = String(i.path[0] ?? 'form');
        errs[key] ??= key === 'subject' ? 'Pick a subject or type its name'
          : key === 'topics' && i.code === 'too_small' && i.path.length === 1 ? 'Add at least one topic'
          : key === 'examDate' && i.code === 'invalid_format' ? 'Pick the exam date' : i.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit(parsed.data, { subjectId });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Subject</p>
        <SubjectPicker value={subjectId} onChange={setSubjectId} />
        {!subjectId && <Input aria-label="Subject name" placeholder="…or type the exam's subject" maxLength={80} value={subjectName} onChange={(e) => setSubjectName(e.target.value)} invalid={Boolean(errors.subject)} />}
        {errors.subject && <p role="alert" className="text-xs text-coral">{errors.subject}</p>}
      </div>
      <Field label="Exam date" error={errors.examDate}>
        {(id) => <Input id={id} type="date" min={tomorrow} value={examDate} onChange={(e) => setExamDate(e.target.value)} invalid={Boolean(errors.examDate)} />}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Topics <span className="font-normal text-ink-muted">· how confident are you?</span></legend>
        {topics.map((t, i) => (
          <div key={t.key} className="flex items-center gap-1.5">
            <Input aria-label={`Topic ${i + 1}`} placeholder={i === 0 ? 'e.g. Cell respiration' : 'Topic'} maxLength={120} value={t.name}
              onChange={(e) => patchTopic(t.key, { name: e.target.value })} className="h-10 min-w-0 flex-1 text-sm" />
            <Confidence value={t.confidence} onChange={(v) => patchTopic(t.key, { confidence: v })} label={t.name} />
            <Button variant="ghost" size="icon" className="size-9" aria-label={`Remove topic ${i + 1}`} disabled={topics.length === 1}
              onClick={() => setTopics(topics.filter((x) => x.key !== t.key))}><X className="size-4" /></Button>
          </div>
        ))}
        {errors.topics && <p role="alert" className="text-xs text-coral">{errors.topics}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" disabled={topics.length >= 30} onClick={() => setTopics([...topics, row()])}><Plus className="size-4" /> Add topic</Button>
          <Button variant="ghost" size="sm" onClick={() => setPasting(!pasting)}><ClipboardList className="size-4" /> Paste a list</Button>
        </div>
        {pasting && (
          <div className="flex flex-col gap-2">
            <Textarea aria-label="Paste topics, one per line" placeholder={'One topic per line\nGlycolysis\nKrebs cycle'} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <Button size="sm" variant="secondary" className="self-start" disabled={!paste.trim()} onClick={addPasted}>Add these topics</Button>
          </div>
        )}
      </fieldset>

      <Field label={`Hours per day (${hours})`} error={errors.hoursPerDay}>
        {(id) => <input id={id} type="range" min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-[var(--primary)]" />}
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">When do you like to study?</legend>
        <div className="flex flex-wrap gap-1.5">
          {STUDY_TIMES.map((t) => {
            const on = times.includes(t);
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => setTimes(on ? times.filter((x) => x !== t) : [...times, t])}
                className={cn('h-9 rounded-full border px-3 text-sm font-semibold', on ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface-2 text-ink-muted')}>
                {TIME_LABEL[t]}
              </button>
            );
          })}
        </div>
        {errors.preferredTimes && <p role="alert" className="mt-1 text-xs text-coral">Pick at least one time of day</p>}
      </fieldset>

      <Button type="submit" variant="gold" loading={busy}><Sparkles className="size-4" /> Plan with Nova</Button>
    </form>
  );
}
