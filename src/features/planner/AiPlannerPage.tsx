import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, CalendarPlus, Check, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { generateStudyPlan } from '@/services/ai/aiService';
import type { PlanResult, StudyPlanInput } from '@/services/ai/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAiTask } from '@/features/ai/useAiTask';
import { AiStatus } from '@/features/ai/AiStatus';
import { ProviderBadge } from '@/features/ai/ProviderBadge';
import { AskNovaButton } from '@/features/ai/AskNovaButton';
import { useAddPlanToCalendar, useDeletePlan, usePlans, useSavePlan, type StudyPlan } from './plansApi';
import { PlanForm, type PlanRequest } from './PlanForm';
import { PlanTimeline } from './PlanTimeline';
import { countdownLabel } from './calendar';

interface Draft { id?: string; plan: PlanResult; inputs: PlanRequest; subjectId: string | null; addedAt: string | null }

const fromRow = (p: StudyPlan): Draft => ({
  id: p.id, plan: p.plan as unknown as PlanResult, inputs: p.inputs as unknown as PlanRequest, subjectId: p.subject_id, addedAt: p.added_to_calendar_at,
});

export default function AiPlannerPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { preferences } = useAuth();
  const plans = usePlans();
  const savePlan = useSavePlan();
  const addToCalendar = useAddPlanToCalendar();
  const deletePlan = useDeletePlan();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmReAdd, setConfirmReAdd] = useState(false);
  const [deleting, setDeleting] = useState<StudyPlan | null>(null);
  const [now] = useState(() => new Date());
  // State for rendering (Regenerate); the ref feeds the async onSuccess callback.
  const [lastRequest, setLastRequest] = useState<{ input: PlanRequest; subjectId: string | null } | null>(null);
  const requestRef = useRef(lastRequest);

  const planId = params.get('plan');
  const loaded = planId ? plans.data?.find((p) => p.id === planId) ?? null : null;
  const current: Draft | null = draft ?? (loaded ? fromRow(loaded) : null);

  const gen = useAiTask(generateStudyPlan, {
    onSuccess: (plan) => {
      const req = requestRef.current;
      if (req) setDraft({ plan, inputs: req.input, subjectId: req.subjectId, addedAt: null });
    },
  });
  const generate = (input: PlanRequest, { subjectId }: { subjectId: string | null }) => {
    requestRef.current = { input, subjectId };
    setLastRequest({ input, subjectId });
    setDraft(null);
    setParams({}, { replace: true });
    void gen.run(input as StudyPlanInput);
  };

  async function save(d: Draft): Promise<StudyPlan> {
    const row = await savePlan.mutateAsync({
      id: d.id, title: `${d.inputs.subject} plan`, subject_id: d.subjectId, exam_date: d.inputs.examDate, inputs: d.inputs, plan: d.plan,
    });
    setDraft(fromRow(row));
    setParams({ plan: row.id }, { replace: true });
    return row;
  }

  async function addNow() {
    if (!current) return;
    const row = await save(current);
    const n = await addToCalendar.mutateAsync({ plan: row, preferredTime: preferences.study.preferredTimes[0] ?? 'evening' });
    setDraft({ ...fromRow(row), addedAt: new Date().toISOString() });
    const first = current.plan.sessions[0]?.date ?? current.inputs.examDate;
    toast.success(`Added ${n} item${n === 1 ? '' : 's'} to your calendar`, {
      action: { label: 'Open planner', onClick: () => navigate(`/planner?view=week&date=${first}`) },
    });
  }
  const onAdd = () => (current?.addedAt ? setConfirmReAdd(true) : void addNow());

  const open = (p: StudyPlan) => { setDraft(null); setParams({ plan: p.id }, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/planner" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" /> Planner</Link>
      <PageHeader title="Plan with Nova" subtitle="Tell Nova about your exam — it charts the sessions, you tweak them, then they land on your calendar." />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card className="self-start">
          <PlanForm
            key={current?.id ?? 'new'}
            busy={gen.status === 'loading'}
            initial={current ? { subjectId: current.subjectId, inputs: current.inputs } : undefined}
            onSubmit={generate}
          />
        </Card>

        <section className="flex min-w-0 flex-col gap-4">
          {gen.status !== 'idle' && gen.status !== 'success' && <AiStatus task={gen} loadingLabel="Nova is charting your path…" emptyTitle="Nova couldn't fit a plan" />}
          {current ? (
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl">{current.inputs.subject} plan</h2>
                {!current.id && <ProviderBadge meta={gen.meta} />}
                {current.addedAt && <span className="inline-flex items-center gap-1 text-xs text-teal"><Check className="size-3.5" /> On your calendar</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void save(current).then(() => toast.success('Plan saved'))} loading={savePlan.isPending && !addToCalendar.isPending}>
                  <Save className="size-4" /> {current.id ? 'Save changes' : 'Save plan'}
                </Button>
                <Button onClick={onAdd} loading={addToCalendar.isPending} disabled={current.plan.sessions.length === 0}><CalendarPlus className="size-4" /> Add to calendar</Button>
                {lastRequest && !current.id && (
                  <Button variant="ghost" onClick={() => generate(lastRequest.input, { subjectId: lastRequest.subjectId })}><RefreshCw className="size-4" /> Regenerate</Button>
                )}
                {current.id && <AskNovaButton context={{ type: 'plan', id: current.id }} variant="ghost" />}
              </div>
              <PlanTimeline plan={current.plan} examDate={current.inputs.examDate} onChange={(plan) => setDraft({ ...current, plan })} />
            </Card>
          ) : gen.status === 'idle' && (
            <Card className="flex flex-col items-center gap-2 py-12 text-center">
              <span aria-hidden className="font-display text-3xl text-gold">✦</span>
              <p className="max-w-sm text-ink-muted">Your plan appears here. Low-confidence topics get more time, earlier — and every topic gets spaced review.</p>
            </Card>
          )}
        </section>
      </div>

      {(plans.data?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl">Your plans</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.data!.map((p) => (
              <li key={p.id}>
                <Card className="flex h-full flex-col gap-2 p-4">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-ink-muted">
                    Exam {format(parseISO(p.exam_date), 'MMM d')} · {countdownLabel(parseISO(p.exam_date), now)}
                    {p.added_to_calendar_at && <span className="ml-1 text-teal">· on calendar ✓</span>}
                  </p>
                  <div className="mt-auto flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => open(p)} disabled={p.id === current?.id}>Open</Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${p.title}`} onClick={() => setDeleting(p)}><Trash2 className="size-4" /></Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog open={confirmReAdd} onOpenChange={setConfirmReAdd} title="Add these sessions again?"
        body="This plan is already on your calendar. Adding it again creates a second copy of every session."
        confirmLabel="Add again" onConfirm={async () => { setConfirmReAdd(false); await addNow(); }} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }} danger title="Delete this plan?"
        body="Sessions already on your calendar stay there." confirmLabel="Delete"
        onConfirm={async () => {
          const id = deleting!.id;
          await deletePlan.mutateAsync(id);
          setDeleting(null);
          if (id === current?.id) { setDraft(null); setParams({}, { replace: true }); }
        }} />
    </div>
  );
}
