import { useNavigate } from 'react-router';
import { BookOpen, CalendarPlus, FilePlus2, Layers, ListChecks, Sparkles, type LucideIcon } from 'lucide-react';
import { useCreateNote } from '@/features/notes/api';

export function QuickActions() {
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const tiles: { label: string; icon: LucideIcon; onClick: () => void; tone: string }[] = [
    { label: 'New note', icon: FilePlus2, tone: 'text-primary', onClick: () => { createNote.mutate({}, { onSuccess: (n) => navigate(`/notes/${n.id}`) }); } },
    { label: 'Flashcards', icon: Layers, tone: 'text-teal', onClick: () => navigate('/decks?new=1') },
    { label: 'Start a quiz', icon: ListChecks, tone: 'text-coral', onClick: () => navigate('/quizzes') },
    { label: 'Ask Nova', icon: Sparkles, tone: 'text-gold', onClick: () => navigate('/tutor') },
    { label: 'Study session', icon: BookOpen, tone: 'text-star-me', onClick: () => navigate('/study') },
    { label: 'Add task', icon: CalendarPlus, tone: 'text-primary', onClick: () => navigate('/planner?new=1') },
  ];
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {tiles.map(({ label, icon: Icon, onClick, tone }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          disabled={label === 'New note' && createNote.isPending}
          className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface p-2 text-center text-xs font-semibold transition hover:border-line-strong hover:bg-surface-2 disabled:opacity-60 sm:text-sm"
        >
          <Icon className={`size-5 ${tone}`} aria-hidden />
          {label}
        </button>
      ))}
    </nav>
  );
}
