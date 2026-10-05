import { SubjectManager } from '@/features/subjects/SubjectManager';

export function SubjectsSection() {
  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">Subjects colour your notes, decks, quizzes and the constellations in your sky.</p>
      <SubjectManager />
    </div>
  );
}
