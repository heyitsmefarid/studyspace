import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { ReviewSession } from './ReviewSession';

export default function ReviewPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const all = params.get('all') === '1';
  const shuffle = params.get('shuffle') === '1';

  useEffect(() => {
    document.body.dataset.focus = 'true';
    return () => { delete document.body.dataset.focus; };
  }, []);

  return (
    <div>
      <Link to={`/decks/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" /> Deck</Link>
      <ReviewSession key={`${id}:${all}:${shuffle}`} deckId={id!} all={all} shuffle={shuffle} />
    </div>
  );
}
