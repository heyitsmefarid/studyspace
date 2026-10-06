import { format, parseISO } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { ACTIVITIES, type PlanResult, type PlanSession } from '@/services/ai/schemas';
import { groupByDate } from './calendar';

const PRIORITY_DOT: Record<PlanSession['priority'], string> = { high: 'bg-coral', medium: 'bg-gold', low: 'bg-teal' };
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);

export function PlanTimeline({ plan, examDate, onChange, readOnly }: {
  plan: PlanResult; examDate: string; onChange?: (p: PlanResult) => void; readOnly?: boolean;
}) {
  // Keep each session's index in the flat list so edits map back to it.
  const indexed = plan.sessions.map((s, i) => ({ ...s, i }));
  const days = [...groupByDate(indexed).entries()];
  const edit = (i: number, patch: Partial<PlanSession>) => onChange?.({ ...plan, sessions: plan.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const remove = (i: number) => onChange?.({ ...plan, sessions: plan.sessions.filter((_, j) => j !== i) });

  return (
    <div className="flex flex-col gap-4">
      {plan.summary && <p className="text-ink-muted">{plan.summary}</p>}
      {plan.trimmed > 0 && <p className="rounded-lg bg-gold-soft px-3 py-2 text-sm">{plan.trimmed} session{plan.trimmed === 1 ? ' was' : 's were'} dropped to fit your hours.</p>}
      <ol className="stagger flex flex-col gap-3 [--stagger-step:50ms]">
        {days.map(([date, sessions]) => (
          <li key={date}>
            <h3 className="sticky top-14 z-10 -mx-1 bg-bg/90 px-1 py-1 text-sm font-semibold backdrop-blur md:top-0">
              {format(parseISO(date), 'EEE, MMM d')} <span className="font-normal text-ink-muted">· {hm(sessions.reduce((n, s) => n + s.durationMinutes, 0))}</span>
            </h3>
            <ul className="mt-1 flex flex-col gap-1.5">
              {sessions.map((s) => (
                <li key={s.i} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-line bg-surface p-2">
                  <span className={cn('size-2 rounded-full', PRIORITY_DOT[s.priority])} role="img" aria-label={`${s.priority} priority`} />
                  {readOnly ? (
                    <p className="min-w-0 text-sm">
                      <span className="tabular text-ink-muted">{s.startTime ?? '—'}</span> · <span className="capitalize">{s.activity}</span> · <strong>{s.topic}</strong> · {s.durationMinutes} min
                    </p>
                  ) : (
                    <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-[6.5rem_9rem_1fr_5.5rem]">
                      <Input type="time" aria-label="Start time" value={s.startTime ?? ''} onChange={(e) => edit(s.i, { startTime: e.target.value || null })} className="h-9 text-sm" />
                      <Select aria-label="Activity" value={s.activity} onChange={(e) => edit(s.i, { activity: e.target.value as PlanSession['activity'] })} className="h-9 text-sm capitalize">
                        {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                      </Select>
                      <Input aria-label="Topic" maxLength={120} value={s.topic} onChange={(e) => edit(s.i, { topic: e.target.value })} className="col-span-2 h-9 text-sm sm:col-span-1" />
                      <Input type="number" aria-label="Minutes" min={15} max={180} step={5} value={s.durationMinutes}
                        onChange={(e) => edit(s.i, { durationMinutes: Math.min(180, Math.max(15, Number(e.target.value) || 15)) })} className="h-9 text-sm" />
                    </div>
                  )}
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`Remove ${s.topic}`} onClick={() => remove(s.i)}><Trash2 className="size-4" /></Button>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="flex items-center gap-2 rounded-xl border border-gold bg-gold-soft px-3 py-2 font-semibold text-gold">
          <span aria-hidden className="inline-block animate-twinkle">★</span> Exam day — {format(parseISO(examDate), 'EEEE, MMM d')}
        </li>
      </ol>
    </div>
  );
}
