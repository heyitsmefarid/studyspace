import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { friendlyMessage } from '@/lib/errors';
import { objectPath, uploadFile } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSaveCard, type Flashcard } from './api';
import { validateCard } from './cardForm';
import { CardImage } from './CardImage';

type CardType = 'qa' | 'mcq' | 'tf';
interface Draft {
  type: CardType; front: string; back: string; options: string[]; correct: string; topic: string;
  difficulty: '' | 'easy' | 'medium' | 'hard'; frontImage: string | null; backImage: string | null;
}

const fromCard = (c?: Flashcard): Draft => ({
  type: (c?.type as CardType) ?? 'qa',
  front: c?.front ?? '',
  back: c?.back ?? '',
  options: Array.isArray(c?.options) ? (c!.options as string[]) : ['', '', '', ''],
  correct: c?.correct_answer ?? '',
  topic: c?.topic ?? '',
  difficulty: (c?.difficulty as Draft['difficulty']) ?? '',
  frontImage: c?.front_image_path ?? null,
  backImage: c?.back_image_path ?? null,
});

const TYPES: { value: CardType; label: string }[] = [
  { value: 'qa', label: 'Q/A' }, { value: 'mcq', label: 'Multiple choice' }, { value: 'tf', label: 'True/False' },
];

function ImagePick({ label, path, onChange, deckId }: { label: string; path: string | null; onChange: (p: string | null) => void; deckId: string }) {
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(file?: File) {
    if (!file || !user) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return toast.error('Choose a PNG, JPEG, WebP or GIF image.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Images must be 5 MB or smaller.');
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const p = objectPath(user.id, deckId, `${crypto.randomUUID()}.${ext}`);
      await uploadFile('card-images', p, file);
      onChange(p);
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-3">
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {path ? (
        <div className="relative"><CardImage path={path} alt={label} />
          <button onClick={() => onChange(null)} className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-raised shadow-glow" aria-label={`Remove ${label}`}><X className="size-3.5" /></button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" loading={busy} onClick={() => ref.current?.click()}><ImagePlus className="size-4" /> {label}</Button>
      )}
    </div>
  );
}

export function CardEditor({ deckId, card, open, onOpenChange, nextPosition }: {
  deckId: string; card?: Flashcard; open: boolean; onOpenChange: (o: boolean) => void; nextPosition: number;
}) {
  const save = useSaveCard(deckId);
  const [d, setD] = useState<Draft>(() => fromCard(card));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function submit(addAnother: boolean) {
    const r = validateCard({
      type: d.type, front: d.front, back: d.back,
      options: d.type === 'mcq' ? d.options : undefined,
      correct_answer: d.type === 'qa' ? undefined : d.correct,
      topic: d.topic || undefined, difficulty: d.difficulty || undefined,
      front_image_path: d.frontImage, back_image_path: d.backImage,
    });
    if (!r.ok) return setErrors(r.errors);
    setErrors({});
    await save.mutateAsync({ id: card?.id, card: r.value, position: card?.position ?? nextPosition });
    toast.success('Card saved ✦');
    if (addAnother && !card) setD({ ...fromCard(), type: d.type, topic: d.topic, difficulty: d.difficulty });
    else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={card ? 'Edit card' : 'New card'} size="lg"
      footer={<>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        {!card && <Button variant="secondary" loading={save.isPending} onClick={() => submit(true)}>Save & add another</Button>}
        <Button loading={save.isPending} onClick={() => submit(false)}>Save card</Button>
      </>}>
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Card type" className="inline-flex self-start rounded-xl border border-line bg-surface-2 p-1">
          {TYPES.map((t) => (
            <button key={t.value} role="radio" aria-checked={d.type === t.value} onClick={() => set('type', t.value)}
              className={cn('h-9 rounded-lg px-3 text-sm font-semibold', d.type === t.value ? 'bg-primary-soft text-primary' : 'text-ink-muted')}>{t.label}</button>
          ))}
        </div>
        <Field label={d.type === 'tf' ? 'Statement' : 'Question'} error={errors.front}>
          {(id) => <Textarea id={id} maxLength={1000} value={d.front} onChange={(e) => set('front', e.target.value)} invalid={Boolean(errors.front)} />}
        </Field>
        <ImagePick label="Add front image" path={d.frontImage} onChange={(p) => set('frontImage', p)} deckId={deckId} />

        {d.type === 'mcq' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Options — pick the correct one</legend>
            {d.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" aria-label={`Option ${i + 1} is correct`} checked={o !== '' && d.correct === o}
                  onChange={() => set('correct', o)} className="size-4 accent-[var(--primary)]" />
                <Input aria-label={`Option ${i + 1}`} value={o} maxLength={200}
                  onChange={(e) => { const opts = [...d.options]; const wasCorrect = d.correct === opts[i]; opts[i] = e.target.value; setD((x) => ({ ...x, options: opts, correct: wasCorrect ? e.target.value : x.correct })); }} />
                {d.options.length > 2 && (
                  <Button variant="ghost" size="icon" aria-label={`Remove option ${i + 1}`} onClick={() => set('options', d.options.filter((_, j) => j !== i))}><X className="size-4" /></Button>
                )}
              </div>
            ))}
            {d.options.length < 6 && <Button size="sm" variant="ghost" className="self-start" onClick={() => set('options', [...d.options, ''])}><Plus className="size-4" /> Add option</Button>}
            {(errors.options || errors.correct_answer) && <p role="alert" className="text-xs text-coral">{errors.options ?? errors.correct_answer}</p>}
          </fieldset>
        )}
        {d.type === 'tf' && (
          <fieldset className="flex gap-4">
            <legend className="mb-1 text-sm font-medium">Answer</legend>
            {(['True', 'False'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="radio" name="tf" checked={d.correct === v} onChange={() => set('correct', v)} className="size-4 accent-[var(--primary)]" />{v}
              </label>
            ))}
            {errors.correct_answer && <p role="alert" className="text-xs text-coral">{errors.correct_answer}</p>}
          </fieldset>
        )}

        <Field label={d.type === 'qa' ? 'Answer' : 'Explanation (optional)'} error={errors.back}>
          {(id) => <Textarea id={id} maxLength={2000} value={d.back} onChange={(e) => set('back', e.target.value)} invalid={Boolean(errors.back)} />}
        </Field>
        <ImagePick label="Add back image" path={d.backImage} onChange={(p) => set('backImage', p)} deckId={deckId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topic">{(id) => <Input id={id} maxLength={60} value={d.topic} onChange={(e) => set('topic', e.target.value)} />}</Field>
          <Field label="Difficulty">
            {(id) => (
              <Select id={id} value={d.difficulty} onChange={(e) => set('difficulty', e.target.value as Draft['difficulty'])}>
                <option value="">—</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </Select>
            )}
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
