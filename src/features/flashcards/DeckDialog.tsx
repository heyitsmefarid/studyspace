import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { SubjectPicker } from '@/features/subjects/SubjectPicker';
import { useCreateDeck, useUpdateDeck, type Deck } from './api';

export function DeckDialog({ deck, open, onOpenChange }: { deck?: Deck; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { partner, preferences } = useAuth();
  const navigate = useNavigate();
  const create = useCreateDeck();
  const update = useUpdateDeck();
  const [title, setTitle] = useState(deck?.title ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [subjectId, setSubjectId] = useState<string | null>(deck?.subject_id ?? null);
  const [tags, setTags] = useState<string[]>(deck?.tags ?? []);
  const [tag, setTag] = useState('');
  const [shared, setShared] = useState(deck?.is_shared ?? preferences.privacy.shareByDefault);

  const addTag = () => {
    const t = tag.trim().toLowerCase().slice(0, 30);
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTag('');
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } };

  async function save() {
    const input = { title: title.trim(), description: description.trim(), subject_id: subjectId, tags, is_shared: shared };
    if (deck) {
      await update.mutateAsync({ id: deck.id, patch: input });
      onOpenChange(false);
    } else {
      const d = await create.mutateAsync(input);
      onOpenChange(false);
      navigate(`/decks/${d.id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={deck ? 'Edit deck' : 'New deck'}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={save} loading={create.isPending || update.isPending} disabled={!title.trim()}>{deck ? 'Save' : 'Create deck'}</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Title">{(id) => <Input id={id} autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div><p className="mb-1.5 text-sm font-medium">Subject</p><SubjectPicker value={subjectId} onChange={setSubjectId} /></div>
        <Field label="Tags" hint="Press Enter after each tag (up to 10).">
          {(id) => <Input id={id} value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={onTagKey} onBlur={addTag} />}
        </Field>
        {tags.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">
                #{t}<button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}><X className="size-3" /></button>
              </span>
            ))}
          </div>
        )}
        <Switch label={`Share with ${partner?.display_name ?? 'your partner'}`} hint="They can study it with their own progress." checked={shared} onCheckedChange={setShared} />
      </div>
    </Dialog>
  );
}
